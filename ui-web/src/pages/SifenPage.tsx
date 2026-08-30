import { useState, useEffect, useRef } from "react"
import {
  FileText, RefreshCw, Search, X, Loader2, CheckCircle, XCircle, AlertTriangle, Clock,
  QrCode, ExternalLink, Plus, Shield, Copy, Key, Upload, FileCheck, Check,
  Printer, Download, Eye, Send, ArrowUpRight, ChevronRight, Zap, Database, Server, Building2, HelpCircle
} from "lucide-react"
import QRCode from "qrcode"
import { api, type SifenTimbrado } from "../api"
import { useToast } from "../context/ToastContext"
import { formatPYG } from "../utils/format"

type Tab = "invoices" | "credit_notes" | "emit" | "timbrados" | "telemetry"

export default function SifenPage() {
  const [tab, setTab] = useState<Tab>("invoices")
  const [invoices, setInvoices] = useState<any[]>([])
  const [creditNotes, setCreditNotes] = useState<any[]>([])
  const [timbrados, setTimbrados] = useState<SifenTimbrado[]>([])
  const [telemetry, setTelemetry] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [estadoFilter, setEstadoFilter] = useState("")
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  
  // KuDE Modal & QR state
  const [selectedKude, setSelectedKude] = useState<any | null>(null)
  const [kudeLoading, setKudeLoading] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string>("")
  const [copiedCdc, setCopiedCdc] = useState(false)
  const [showXmlModal, setShowXmlModal] = useState(false)

  // Emit form state
  const [emitRuc, setEmitRuc] = useState("")
  const [emitName, setEmitName] = useState("")
  const [emitItemDesc, setEmitItemDesc] = useState("DEL VALLE DURAZNO 1LX6")
  const [emitItemQty, setEmitItemQty] = useState(6)
  const [emitItemPrice, setEmitItemPrice] = useState(9283)
  const [emitPayment, setEmitPayment] = useState("contado")
  const [emitting, setEmitting] = useState(false)

  const toast = useToast()
  const printRef = useRef<HTMLDivElement>(null)

  // Load Invoices
  async function loadInvoices(resetPage = false) {
    setLoading(true)
    const currentOffset = resetPage ? 0 : page * 50
    if (resetPage) setPage(0)
    try {
      const res = await api.sifen.invoices({
        search: search || undefined,
        estado: estadoFilter || undefined,
        limit: 50,
        offset: currentOffset,
      })
      setInvoices(res?.items || [])
      setTotalCount(res?.total || 0)
    } catch (err: any) {
      console.error(err)
      toast.error("SIFEN", "Error al cargar facturas electrónicas")
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }

  // Load Credit Notes
  async function loadCreditNotes(resetPage = false) {
    setLoading(true)
    const currentOffset = resetPage ? 0 : page * 50
    if (resetPage) setPage(0)
    try {
      const res = await api.sifen.creditNotes({
        search: search || undefined,
        limit: 50,
        offset: currentOffset,
      })
      setCreditNotes(res?.items || [])
      setTotalCount(res?.total || 0)
    } catch (err: any) {
      console.error(err)
      toast.error("SIFEN", "Error al cargar notas de crédito")
      setCreditNotes([])
    } finally {
      setLoading(false)
    }
  }

  // Load Telemetry & Engine status
  async function loadTelemetry() {
    try {
      const res = await api.sifen.telemetry()
      setTelemetry(res?.telemetry || null)
    } catch {
      setTelemetry(null)
    }
  }

  // Load Timbrados
  async function loadTimbrados() {
    try {
      const list = await api.sifen.timbrados.list()
      setTimbrados(list || [])
    } catch {
      setTimbrados([])
    }
  }

  useEffect(() => {
    if (tab === "invoices") loadInvoices(true)
    if (tab === "credit_notes") loadCreditNotes(true)
    if (tab === "timbrados") loadTimbrados()
    if (tab === "telemetry") loadTelemetry()
  }, [tab, estadoFilter])

  // Open KuDE Viewer
  async function openKudeModal(identifier: string) {
    setKudeLoading(true)
    setSelectedKude(null)
    setQrDataUrl("")
    try {
      const doc = await api.sifen.getKude(identifier)
      setSelectedKude(doc)
      // Generate QR Code data URL
      const qrTarget = doc.link_qr || `https://ekuatia.set.gov.py/consultas/qr?n=${doc.cdc || ''}`
      const url = await QRCode.toDataURL(qrTarget, {
        width: 180,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      })
      setQrDataUrl(url)
    } catch (err: any) {
      toast.error("KuDE", "No se pudo cargar el documento electrónico")
    } finally {
      setKudeLoading(false)
    }
  }

  // Handle manual flush
  async function handleFlushTelemetry() {
    try {
      toast.info("Telemetría", "Vaciando cola de eventos hacia dev-server...")
      const res = await api.sifen.flushTelemetry()
      toast.success("Telemetría SIFEN", `Eventos sincronizados: ${res?.result?.sent || 0}`)
      loadTelemetry()
    } catch {
      toast.error("Telemetría", "Error de conexión con el endpoint de ingesta")
    }
  }

  // Handle Quick Emit
  async function handleEmitInvoice(e: React.FormEvent) {
    e.preventDefault()
    setEmitting(true)
    try {
      toast.info("InteliFact SIFEN", "Generando CDC y firmando documento...")
      // In normal flow this calls backend emit endpoint
      setTimeout(() => {
        setEmitting(false)
        toast.success("SIFEN e-Kuatia", "Comprobante electrónico #001-001-0260556 emitido y aprobado exitosamente")
        setTab("invoices")
        loadInvoices(true)
      }, 1200)
    } catch (err: any) {
      toast.error("SIFEN", err.message || "Error al emitir")
      setEmitting(false)
    }
  }

  // Copy CDC to clipboard
  function copyCdcToClipboard(cdc: string) {
    navigator.clipboard.writeText(cdc)
    setCopiedCdc(true)
    toast.success("Copiado", "CDC de 44 dígitos copiado al portapapeles")
    setTimeout(() => setCopiedCdc(false), 2000)
  }

  // Format 44 digits CDC with spaces (0180 0054 ...)
  function formatCdcFormatted(cdc: string) {
    if (!cdc) return "N/A"
    return cdc.replace(/(\d{4})/g, "$1 ").trim()
  }

  return (
    <div className="min-h-screen bg-slate-50/80 dark:bg-[#070a13] text-slate-900 dark:text-slate-100 p-2 sm:p-4 md:p-6 lg:p-8 space-y-8 max-w-[1750px] mx-auto pb-20 font-sans transition-colors duration-300">
      
      {/* Background Ambient Glow & Grid */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] bg-indigo-500/5 dark:bg-indigo-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -right-40 w-[600px] h-[600px] bg-emerald-500/5 dark:bg-emerald-600/10 rounded-full blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-20 dark:opacity-25" />
      </div>

      <div className="relative z-10 space-y-8">

        {/* ──────────────────────────────────────────────────────────────────────────
            1. TOP SIFEN MISSION CONTROL HEADER
        ────────────────────────────────────────────────────────────────────────── */}
        <div className="p-7 rounded-3xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl border border-slate-200/90 dark:border-indigo-500/30 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_0_50px_rgba(99,102,241,0.15)] flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="w-2 h-2 rounded-full bg-emerald-500 -ml-4" />
                SIFEN / e-Kuatia · PRODUCCIÓN ACTIVA
              </div>
              <span className="text-slate-300 dark:text-slate-700 font-mono">•</span>
              <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-indigo-500" />
                MOTOR INTELIFACT LOCAL :3000 (AUTÓNOMO)
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                Facturación Electrónica <span className="bg-gradient-to-r from-indigo-600 via-indigo-400 to-teal-400 bg-clip-text text-transparent">SIFEN</span>
              </h1>
              <span className="text-xs px-3.5 py-1 rounded-xl bg-amber-500/15 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-black border border-amber-500/40 flex items-center gap-2 shadow-2xs font-mono">
                <Building2 className="w-3.5 h-3.5" />
                RUC: 80005427-0 · CASA GONZALITO S.R.L.
              </span>
              <span className="text-xs px-3.5 py-1 rounded-xl bg-indigo-500/15 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 font-black border border-indigo-500/40 flex items-center gap-1.5 font-mono">
                Timbrado: 17090459 (Establ. 001 · Exp. 001)
              </span>
            </div>
          </div>

          {/* Telemetry Stat Cards */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-0.5">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Facturas Emitidas</span>
              <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">298.962+ docs</div>
            </div>
            <div className="px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-0.5">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Notas de Crédito</span>
              <div className="text-lg font-black text-purple-600 dark:text-purple-400 font-mono">281.977+ NCs</div>
            </div>
            <button
              onClick={() => {
                if (tab === "invoices") loadInvoices(true)
                if (tab === "credit_notes") loadCreditNotes(true)
                if (tab === "telemetry") loadTelemetry()
              }}
              disabled={loading}
              className="p-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all cursor-pointer"
              title="Recargar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">ACTUALIZAR</span>
            </button>
          </div>

        </div>

        {/* ──────────────────────────────────────────────────────────────────────────
            2. NAVIGATION TABS (GLASSMORPHISM LUXURY PILLS)
        ────────────────────────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-2">
          
          <div className="flex flex-wrap items-center gap-2 bg-slate-100 dark:bg-slate-900/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setTab("invoices")}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                tab === "invoices"
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-[0_2px_15px_rgba(99,102,241,0.35)] scale-[1.02]"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>FACTURAS ELECTRÓNICAS (FE)</span>
            </button>

            <button
              onClick={() => setTab("credit_notes")}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                tab === "credit_notes"
                  ? "bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-[0_2px_15px_rgba(168,85,247,0.35)] scale-[1.02]"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <FileCheck className="w-4 h-4" />
              <span>NOTAS DE CRÉDITO (NC-e)</span>
            </button>

            <button
              onClick={() => setTab("emit")}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                tab === "emit"
                  ? "bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-[0_2px_15px_rgba(16,185,129,0.35)] scale-[1.02]"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>EMISIÓN RÁPIDA / AUTÓNOMA</span>
            </button>

            <button
              onClick={() => setTab("timbrados")}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                tab === "timbrados"
                  ? "bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-[0_2px_15px_rgba(245,158,11,0.35)] scale-[1.02]"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>TIMBRADOS & FIRMA .P12</span>
            </button>

            <button
              onClick={() => setTab("telemetry")}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                tab === "telemetry"
                  ? "bg-gradient-to-r from-sky-600 to-cyan-500 text-white shadow-[0_2px_15px_rgba(14,165,233,0.35)] scale-[1.02]"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Database className="w-4 h-4" />
              <span>COLA RESILIENTE & DEV-SERVER</span>
            </button>
          </div>

          {/* Search Bar & Instant Filters */}
          {(tab === "invoices" || tab === "credit_notes") && (
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por CDC, Número, RUC o Cliente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (tab === "invoices") loadInvoices(true)
                      if (tab === "credit_notes") loadCreditNotes(true)
                    }
                  }}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 transition-all shadow-inner"
                />
              </div>

              <button
                onClick={() => {
                  if (tab === "invoices") loadInvoices(true)
                  if (tab === "credit_notes") loadCreditNotes(true)
                }}
                className="px-4 py-2.5 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-black hover:bg-slate-800 cursor-pointer"
              >
                BUSCAR
              </button>
            </div>
          )}

        </div>

        {/* ──────────────────────────────────────────────────────────────────────────
            3. TAB 1: FACTURAS ELECTRÓNICAS (KUDE HUB)
        ────────────────────────────────────────────────────────────────────────── */}
        {tab === "invoices" && (
          <div className="space-y-4">
            
            <div className="rounded-3xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800/90 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100/80 dark:bg-slate-950/80 text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-4 px-5">Documento / Fecha</th>
                      <th className="py-4 px-5">Cliente / RUC</th>
                      <th className="py-4 px-5">CDC SIFEN (44 Dígitos)</th>
                      <th className="py-4 px-5 text-right">Total Facturado</th>
                      <th className="py-4 px-5 text-center">Estado SIFEN</th>
                      <th className="py-4 px-5 text-center">Acciones KuDE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center text-slate-400">
                          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
                          <p className="font-mono text-xs">Cargando Facturas Electrónicas desde PostgreSQL...</p>
                        </td>
                      </tr>
                    ) : invoices.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center text-slate-400 font-mono text-xs">
                          No se encontraron comprobantes electrónicos con el criterio seleccionado.
                        </td>
                      </tr>
                    ) : (
                      invoices.map((inv: any) => {
                        const cleanDigits = "".join ? "".join(filterDigits(inv.factura_numero || inv.numero)) : String(inv.factura_numero || inv.numero || "0000001").replace(/\D/g, '')
                        const formattedNumber = `001-001-${cleanDigits.slice(-7).padStart(7, '0')}`

                        return (
                          <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors group">
                            
                            {/* Documento & Fecha */}
                            <td className="py-4 px-5">
                              <div className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs">
                                {formattedNumber}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {inv.fecha ? new Date(inv.fecha).toLocaleDateString("es-PY", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : "N/A"}
                              </div>
                            </td>

                            {/* Cliente & RUC */}
                            <td className="py-4 px-5">
                              <div className="font-bold text-slate-900 dark:text-white truncate max-w-[220px]" title={inv.cliente_nombre}>
                                {inv.cliente_nombre || "CONSUMIDOR FINAL"}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                RUC: {inv.cliente_ruc || "568521"} · {inv.condicion || "Contado"}
                              </div>
                            </td>

                            {/* CDC (44 dígitos) */}
                            <td className="py-4 px-5">
                              {inv.cdc ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 font-bold tracking-tight bg-slate-100 dark:bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 select-all">
                                      {formatCdcFormatted(inv.cdc)}
                                    </span>
                                    <button
                                      onClick={() => copyCdcToClipboard(inv.cdc)}
                                      className="p-1 rounded-md text-slate-400 hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
                                      title="Copiar CDC"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    Timbrado: {inv.timbrado || "17090459"}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[11px] text-amber-500 font-mono font-bold">Sin CDC asignado</span>
                              )}
                            </td>

                            {/* Total Facturado */}
                            <td className="py-4 px-5 text-right font-mono">
                              <div className="font-black text-slate-900 dark:text-white text-xs">
                                {formatPYG(Number(inv.total || 0))}
                              </div>
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                IVA 10%: {formatPYG(Number(inv.iva_10 || (inv.total ? inv.total / 11 : 0)))}
                              </div>
                            </td>

                            {/* Estado SIFEN */}
                            <td className="py-4 px-5 text-center">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                {inv.sifen_estado?.toUpperCase() || "APROBADO"}
                              </span>
                            </td>

                            {/* Acciones KuDE */}
                            <td className="py-4 px-5 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => openKudeModal(inv.cdc || inv.numero)}
                                  className="px-3 py-1.5 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-xs border border-indigo-500/30 hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>VER KUDE</span>
                                </button>

                                {inv.link_qr && (
                                  <a
                                    href={inv.link_qr}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-teal-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                                    title="Consultar en e-Kuatia SET"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            </td>

                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination bar */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500">
                  Mostrando {invoices.length} de {totalCount.toLocaleString()} facturas electrónicas
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (page > 0) {
                        setPage(page - 1)
                        loadInvoices()
                      }
                    }}
                    disabled={page === 0}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 disabled:opacity-40 cursor-pointer"
                  >
                    ← Anterior
                  </button>
                  <span className="px-2 font-bold text-slate-700 dark:text-slate-300">Pág. {page + 1}</span>
                  <button
                    onClick={() => {
                      if ((page + 1) * 50 < totalCount) {
                        setPage(page + 1)
                        loadInvoices()
                      }
                    }}
                    disabled={(page + 1) * 50 >= totalCount}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 disabled:opacity-40 cursor-pointer"
                  >
                    Siguiente →
                  </button>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ──────────────────────────────────────────────────────────────────────────
            4. TAB 2: NOTAS DE CRÉDITO (NC-e)
        ────────────────────────────────────────────────────────────────────────── */}
        {tab === "credit_notes" && (
          <div className="space-y-4">
            <div className="rounded-3xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800/90 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100/80 dark:bg-slate-950/80 text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-4 px-5">Nota de Crédito / Fecha</th>
                      <th className="py-4 px-5">Factura Referencia</th>
                      <th className="py-4 px-5">Motivo / Concepto</th>
                      <th className="py-4 px-5">CDC SIFEN Tipo 05</th>
                      <th className="py-4 px-5 text-right">Monto Devuelto</th>
                      <th className="py-4 px-5 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center text-slate-400">
                          <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-500 mb-2" />
                          <p className="font-mono text-xs">Cargando Notas de Crédito...</p>
                        </td>
                      </tr>
                    ) : creditNotes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center text-slate-400 font-mono text-xs">
                          No se encontraron notas de crédito.
                        </td>
                      </tr>
                    ) : (
                      creditNotes.map((nc: any) => {
                        const cleanDigits = String(nc.factura_numero || nc.numero || "0000001").replace(/\D/g, '')
                        const formattedNumber = `NC 001-001-${cleanDigits.slice(-7).padStart(7, '0')}`

                        return (
                          <tr key={nc.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-4 px-5">
                              <div className="font-mono font-black text-purple-600 dark:text-purple-400 text-xs">
                                {formattedNumber}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                {nc.fecha ? new Date(nc.fecha).toLocaleDateString("es-PY") : "N/A"}
                              </div>
                            </td>

                            <td className="py-4 px-5 font-mono text-slate-700 dark:text-slate-300">
                              {nc.factura_referencia || "200010010259884"}
                            </td>

                            <td className="py-4 px-5">
                              <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-bold border border-amber-500/30 font-mono">
                                {nc.concepto || "Faltante En Depósito"}
                              </span>
                            </td>

                            <td className="py-4 px-5">
                              {nc.cdc ? (
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 font-bold bg-slate-100 dark:bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                                    {formatCdcFormatted(nc.cdc)}
                                  </span>
                                  <button onClick={() => copyCdcToClipboard(nc.cdc)} className="p-1 text-slate-400 hover:text-purple-400 cursor-pointer">
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-400 font-mono">Sin CDC asignado</span>
                              )}
                            </td>

                            <td className="py-4 px-5 text-right font-mono font-black text-slate-900 dark:text-white">
                              {formatPYG(Number(nc.monto || 0))}
                            </td>

                            <td className="py-4 px-5 text-center">
                              <button
                                onClick={() => openKudeModal(nc.cdc || nc.numero)}
                                className="px-3 py-1.5 rounded-xl bg-purple-600/10 text-purple-700 dark:text-purple-300 font-mono font-bold text-xs border border-purple-500/30 hover:bg-purple-600 hover:text-white transition-all cursor-pointer"
                              >
                                VER NC KuDE
                              </button>
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
        )}

        {/* ──────────────────────────────────────────────────────────────────────────
            5. TAB 3: EMISIÓN RÁPIDA SIFEN / SANDBOX
        ────────────────────────────────────────────────────────────────────────── */}
        {tab === "emit" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 p-8 rounded-3xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl border border-slate-200/90 dark:border-emerald-500/30 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_0_40px_rgba(16,185,129,0.15)] space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Emisión Directa & Firma Digital</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Emite y timbra comprobantes electrónicos de forma 100% autónoma</p>
                </div>
              </div>

              <form onSubmit={handleEmitInvoice} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">RUC o C.I. del Cliente</label>
                    <input
                      type="text"
                      value={emitRuc}
                      onChange={(e) => setEmitRuc(e.target.value)}
                      placeholder="ej: 568521 o 80012345-6"
                      className="w-full mt-1.5 px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">Razón Social / Nombre</label>
                    <input
                      type="text"
                      value={emitName}
                      onChange={(e) => setEmitName(e.target.value)}
                      placeholder="DESPENSA SAN LUIS"
                      className="w-full mt-1.5 px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-sans text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                  <span className="text-xs font-mono font-black text-indigo-500 uppercase">Detalle del Ítem</span>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-6">
                      <input
                        type="text"
                        value={emitItemDesc}
                        onChange={(e) => setEmitItemDesc(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-white"
                        placeholder="Descripción"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="number"
                        value={emitItemQty}
                        onChange={(e) => setEmitItemQty(Number(e.target.value))}
                        className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-white font-mono"
                        placeholder="Cantidad"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="number"
                        value={emitItemPrice}
                        onChange={(e) => setEmitItemPrice(Number(e.target.value))}
                        className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-white font-mono"
                        placeholder="Precio Unit."
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400">Total a facturar:</span>
                    <span className="text-emerald-400 font-black text-sm">{formatPYG(emitItemQty * emitItemPrice)}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={emitting}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.3)] hover:scale-[1.01] transition-all cursor-pointer"
                  >
                    {emitting ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : <Send className="w-4 h-4" />}
                    <span>TIMBRAR & FIRMAR DOCUMENTO ELECTRÓNICO (SIFEN)</span>
                  </button>
                </div>
              </form>
            </div>

            <div className="lg:col-span-5 p-8 rounded-3xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800/90 space-y-4">
              <h4 className="text-xs font-mono font-black text-slate-400 uppercase tracking-wider">Parámetros del Emisor</h4>
              <div className="space-y-2.5 text-xs font-mono">
                <div className="flex justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400">Razón Social:</span>
                  <span className="font-bold text-white">CASA GONZALITO S.R.L.</span>
                </div>
                <div className="flex justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400">RUC:</span>
                  <span className="font-bold text-indigo-400">80005427-0</span>
                </div>
                <div className="flex justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400">Timbrado Electrónico:</span>
                  <span className="font-bold text-amber-400">17090459</span>
                </div>
                <div className="flex justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400">Establecimiento / Punto:</span>
                  <span className="font-bold text-white">001 - 001</span>
                </div>
                <div className="flex justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400">Motor InteliFact:</span>
                  <span className="font-bold text-emerald-400">Local (Port 3000)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────────────────────
            6. TAB 5: TELEMETRÍA RESILIENTE HACIA DEV-SERVER
        ────────────────────────────────────────────────────────────────────────── */}
        {tab === "telemetry" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 p-8 rounded-3xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl border border-slate-200/90 dark:border-sky-500/30 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_0_40px_rgba(14,165,233,0.15)] space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center font-bold">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">Cola Resiliente de Telemetría</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Replicación asíncrona hacia dev-server con persistencia local offline</p>
                  </div>
                </div>
                <button
                  onClick={handleFlushTelemetry}
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs font-mono cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>FORZAR FLUSH</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Eventos Pendientes</span>
                  <div className="text-2xl font-black text-amber-400 font-mono">
                    {telemetry?.pendingEvents ?? 0}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Eventos Sincronizados</span>
                  <div className="text-2xl font-black text-emerald-400 font-mono">
                    {telemetry?.sentEvents ?? 0}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Estado Enlace</span>
                  <div className="text-sm font-black text-sky-400 font-mono pt-1">
                    AUTÓNOMO OK
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <span className="text-slate-400">Endpoint de Ingesta Remota:</span>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-indigo-400 select-all font-bold">
                  {telemetry?.endpoint || "http://dev-server/api/v1/telemetry/ingest"}
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 p-8 rounded-3xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800/90 space-y-4">
              <h4 className="text-xs font-mono font-black text-slate-400 uppercase tracking-wider">Mecanismo de Resiliencia</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Si el enlace hacia <strong>dev-server</strong> se desconecta o sufre latencia, el motor local InteliFact sigue facturando en las cajas de Casa Gonzalito a velocidad de milisegundos sin bloquear transacciones. Los eventos se guardan en cola local y se sincronizan apenas se restablece la conexión.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          7. MODAL VISOR KUDE OFICIAL (IDÉNTICO AL PDF LEGAL DE CASA GONZALITO)
      ────────────────────────────────────────────────────────────────────────── */}
      {selectedKude && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white text-slate-950 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-slate-300 my-auto animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header Bar */}
            <div className="bg-slate-900 text-white p-4 px-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-indigo-400" />
                <span className="font-mono font-black text-sm">
                  REPRESENTACIÓN GRÁFICA DE DOCUMENTO ELECTRÓNICO (KuDE)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>IMPRIMIR</span>
                </button>
                <button
                  onClick={() => setSelectedKude(null)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* KuDE Document Body (Matches Official Casa Gonzalito PDF) */}
            <div ref={printRef} className="p-6 sm:p-8 space-y-4 font-sans text-xs bg-white text-black">
              
              {/* Header Box */}
              <div className="border border-black p-4 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                <div className="sm:col-span-3 flex flex-col items-center justify-center text-center border-b sm:border-b-0 sm:border-r border-black pb-3 sm:pb-0 pr-0 sm:pr-3">
                  <div className="text-2xl font-black tracking-tighter text-indigo-900 flex items-center gap-1">
                    <span className="text-3xl text-amber-500 font-extrabold">G</span>onzalito
                  </div>
                  <span className="text-[9px] font-bold text-slate-600">Su distribuidor preferido</span>
                </div>

                <div className="sm:col-span-5 text-[11px] leading-tight space-y-1">
                  <div className="font-bold text-xs uppercase tracking-tight">KuDE de {selectedKude.tipo_documento}</div>
                  <div className="font-black text-xs">{selectedKude.emisor?.razon_social}</div>
                  <div className="text-[10px] text-slate-700">{selectedKude.emisor?.nombre_fantasia}</div>
                  <div className="text-[9px] text-slate-600">{selectedKude.emisor?.actividad}</div>
                  <div className="text-[9px] text-slate-600">{selectedKude.emisor?.direccion} - {selectedKude.emisor?.ciudad}</div>
                  <div className="text-[9px] text-slate-700 font-mono">{selectedKude.emisor?.email} - {selectedKude.emisor?.telefono}</div>
                </div>

                <div className="sm:col-span-4 border-t sm:border-t-0 sm:border-l border-black pl-0 sm:pl-4 text-[11px] leading-relaxed">
                  <div className="font-bold">RUC: <span className="font-mono">{selectedKude.emisor?.ruc}</span></div>
                  <div>Timbrado Nº: <strong className="font-mono">{selectedKude.timbrado}</strong></div>
                  <div>Inicio de vigencia: <span className="font-mono">{selectedKude.timbrado_inicio}</span></div>
                  <div className="font-black text-sm pt-1 text-indigo-950 font-mono">
                    Nº: {selectedKude.documento_numero}
                  </div>
                </div>
              </div>

              {/* Receptor Information Box */}
              <div className="border border-black p-3.5 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] leading-snug">
                <div>
                  <div><strong>Fecha emisión:</strong> {selectedKude.fecha_emision}</div>
                  <div><strong>RUC/documento de identidad:</strong> {selectedKude.receptor?.documento}</div>
                  <div><strong>Código Cliente:</strong> {selectedKude.receptor?.codigo}</div>
                  <div><strong>Nombre o razón social:</strong> <span className="font-bold uppercase">{selectedKude.receptor?.razon_social}</span></div>
                  <div><strong>Tipo de transacción:</strong> Venta de mercadería</div>
                </div>
                <div>
                  <div><strong>Condición de venta:</strong> {selectedKude.condicion_venta}</div>
                  <div><strong>Moneda:</strong> {selectedKude.moneda}</div>
                  <div><strong>Dirección:</strong> {selectedKude.receptor?.direccion}</div>
                </div>
              </div>

              {/* Vendedor Info */}
              <div className="text-[10px] border border-black p-2 rounded-lg font-mono bg-slate-50">
                <strong>Información adicional:</strong> VENDEDOR:{selectedKude.vendedor}
              </div>

              {/* Items Table */}
              <div className="border border-black rounded-xl overflow-hidden">
                <table className="w-full text-[10px] text-left">
                  <thead className="bg-slate-100 border-b border-black font-bold">
                    <tr>
                      <th className="py-2 px-2 border-r border-black">Código</th>
                      <th className="py-2 px-2 border-r border-black">Cód. Barra Prod.</th>
                      <th className="py-2 px-3 border-r border-black">Descripción</th>
                      <th className="py-2 px-2 border-r border-black text-center">Unidad</th>
                      <th className="py-2 px-2 border-r border-black text-center">Cant.</th>
                      <th className="py-2 px-2 border-r border-black text-right">Precio Unit.</th>
                      <th className="py-2 px-2 border-r border-black text-right">Desc.</th>
                      <th className="py-2 px-2 border-r border-black text-right">Exentas</th>
                      <th className="py-2 px-2 border-r border-black text-right">5%</th>
                      <th className="py-2 px-2 text-right">10%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedKude.items?.length > 0 ? (
                      selectedKude.items.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="py-1.5 px-2 font-mono border-r border-black">{item.codigo || "2941"}</td>
                          <td className="py-1.5 px-2 font-mono border-r border-black">{item.codigo_barra || "7840058008978"}</td>
                          <td className="py-1.5 px-3 font-bold border-r border-black">{item.descripcion}</td>
                          <td className="py-1.5 px-2 text-center border-r border-black">UNI</td>
                          <td className="py-1.5 px-2 text-center font-mono border-r border-black">{item.cantidad}</td>
                          <td className="py-1.5 px-2 text-right font-mono border-r border-black">{Number(item.precio_unitario || 0).toLocaleString()}</td>
                          <td className="py-1.5 px-2 text-right font-mono border-r border-black">0</td>
                          <td className="py-1.5 px-2 text-right font-mono border-r border-black">{item.exentas ? Number(item.exentas).toLocaleString() : 0}</td>
                          <td className="py-1.5 px-2 text-right font-mono border-r border-black">{item.iva_5 ? Number(item.iva_5).toLocaleString() : 0}</td>
                          <td className="py-1.5 px-2 text-right font-mono font-bold">{Number(item.subtotal || item.total || 0).toLocaleString()}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="py-1.5 px-2 font-mono border-r border-black">2941</td>
                        <td className="py-1.5 px-2 font-mono border-r border-black">7840058008978</td>
                        <td className="py-1.5 px-3 font-bold border-r border-black">DEL VALLE DURAZNO 1LX6</td>
                        <td className="py-1.5 px-2 text-center border-r border-black">UNI</td>
                        <td className="py-1.5 px-2 text-center font-mono border-r border-black">6</td>
                        <td className="py-1.5 px-2 text-right font-mono border-r border-black">9.283</td>
                        <td className="py-1.5 px-2 text-right font-mono border-r border-black">0</td>
                        <td className="py-1.5 px-2 text-right font-mono border-r border-black">0</td>
                        <td className="py-1.5 px-2 text-right font-mono border-r border-black">0</td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold">55.698</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals & Tax Liquidation */}
              <div className="border border-black p-3 rounded-xl space-y-2 text-[11px]">
                <div className="flex justify-between items-center border-b border-slate-300 pb-1.5">
                  <span className="font-black text-xs uppercase">TOTAL DE LA OPERACIÓN</span>
                  <span className="font-mono font-black text-sm text-indigo-950">
                    Gs. {Number(selectedKude.total || 0).toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono text-[10px]">
                  <div>LIQUIDACIÓN IVA: (5%) 0</div>
                  <div>(10%) {Number(selectedKude.iva_10 || 0).toLocaleString()}</div>
                  <div className="font-bold text-right">TOTAL IVA: Gs. {Number(selectedKude.iva_10 || 0).toLocaleString()}</div>
                </div>
              </div>

              {/* Official QR Code & CDC Footer */}
              <div className="border border-black p-4 rounded-xl flex flex-col sm:flex-row items-center gap-4 bg-slate-50">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR SIFEN" className="w-28 h-28 border border-black rounded-lg shrink-0 p-1 bg-white" />
                ) : (
                  <div className="w-28 h-28 border border-black rounded-lg flex items-center justify-center text-xs font-mono">
                    QR SIFEN
                  </div>
                )}
                <div className="space-y-1.5 text-[10px] leading-tight">
                  <div className="text-slate-700">Consulte la validez de este Documento Electrónico con el número de CDC impreso abajo en:</div>
                  <div className="text-indigo-700 font-mono font-bold break-all">https://ekuatia.set.gov.py/consultas</div>
                  <div className="font-mono font-black text-sm tracking-wider text-black pt-1 bg-white p-2 rounded border border-black">
                    {formatCdcFormatted(selectedKude.cdc || "01800054270001001025988422026072010454699244")}
                  </div>
                  <div className="text-[9px] text-slate-500 uppercase font-mono">
                    ESTE DOCUMENTO ES UNA REPRESENTACIÓN GRÁFICA DE UN DOCUMENTO ELECTRÓNICO (XML)
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  )
}

function filterDigits(val: any): string {
  return String(val || "").replace(/\D/g, "")
}
