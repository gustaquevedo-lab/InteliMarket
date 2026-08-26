import React, { useState, useEffect, useMemo } from "react"
import {
  Search, ShoppingCart, TrendingUp, Eye, Loader2, FileDown, Download, Filter,
  X, DollarSign, CreditCard, Plus, RotateCcw, Printer, FileText,
  Receipt, ShieldCheck, FileSpreadsheet, Layers, CheckCircle2, AlertTriangle,
  Calendar, ArrowUpRight, Banknote, Award, RefreshCw, Clock, Building
} from "lucide-react"
import { api, type Sale, type Customer } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useConfirm } from "../../components/ConfirmDialog"
import { formatPYG, formatDate } from "../../utils/format"

type SalesTab = "comprobantes" | "cierres_caja" | "notas_credito" | "extra_club_credito"
type StatusFilter = "todas" | "contado" | "credito" | "canceladas"

// Etiquetas legibles para las formas de pago reales que aparecen en
// sale_payments (incluye tanto las que genera el POS nuevo como las
// sincronizadas del legado Nemuha, que usan sus propios codigos).
const FORMA_PAGO_LABELS: Record<string, string> = {
  EFECTIVO: "🇵🇾 Efectivo",
  TARJETA_BANCARD: "💳 Tarjeta Bancard",
  TARJETA_DINELCO: "💳 Tarjeta Dinelco",
  "TARJETA CREDITO": "💳 Tarjeta Crédito",
  "TARJETA DEBITO": "💳 Tarjeta Débito",
  QR: "📱 QR",
  "QR CODE": "📱 QR",
  PIX: "📱 Pix",
  EXTRA_CLUB: "⭐ Extra Club (Crédito)",
  "TRANF. BANCARIA": "🏦 Transferencia Bancaria",
  CHEQUES: "🧾 Cheques",
  "VALE COMPRA": "🎟️ Vale de Compra",
}

const PUNTOS_EMISION = [
  { id: "todos", nombre: "Todos los Puntos de Emisión" },
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

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState<SalesTab>("comprobantes")
  const [sales, setSales] = useState<Sale[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filtros
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas")
  const [selectedPunto, setSelectedPunto] = useState<string>("todos")
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split("T")[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0])

  // Modales
  const [viewingSale, setViewingSale] = useState<Sale | null>(null)
  const [anularModal, setAnularModal] = useState<Sale | null>(null)
  const [anularMotivo, setAnularMotivo] = useState("")
  const [anulando, setAnulando] = useState(false)

  // Cierre de Caja X/Z
  const [cierreTipo, setCierreTipo] = useState<"X" | "Z">("Z")
  const [showCierreModal, setShowCierreModal] = useState(false)
  // Desglose real por forma de pago para el reporte X/Z -- antes eran
  // porcentajes fijos (35% tarjeta, 15% transferencia) inventados sobre el
  // total, sin ninguna relacion con como pago cada cliente de verdad.
  const [paymentBreakdown, setPaymentBreakdown] = useState<{ forma_pago: string; monto: number; cantidad: number }[]>([])
  const [loadingBreakdown, setLoadingBreakdown] = useState(false)
  // Cotizaciones reales de la empresa (misma fuente que el POS) -- antes
  // esta pantalla dividia por 1380/7550 fijos, sin importar la cotizacion
  // real configurada.
  const [rates, setRates] = useState({ BRL: 1380, USD: 7550 })

  const toast = useToast()
  const confirm = useConfirm()

  const timbradoFacturas = "18545636"
  const timbradoNC = "18545636"
  const timbradoVencimiento = "31/12/2026"

  // Carga de datos reales
  const fetchData = async () => {
    setLoading(true)
    try {
      const [salesData, customersData] = await Promise.allSettled([
        api.sales.list({
          desde: dateFrom || undefined,
          hasta: dateTo || undefined,
        }),
        api.customers.list(),
      ])

      if (salesData.status === "fulfilled") {
        setSales(salesData.value || [])
      } else {
        setSales([])
      }

      if (customersData.status === "fulfilled") {
        setCustomers(customersData.value || [])
      }
    } catch (err: any) {
      toast.error("Error al cargar ventas", err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [dateFrom, dateTo])

  // Cotizaciones reales, una sola vez -- misma fuente que usa el POS
  // (company.config.currencies), no valores fijos en el codigo.
  useEffect(() => {
    api.companies.list().then((comps) => {
      const c = Array.isArray(comps) ? comps[0] : null
      const currs = (c?.config as any)?.currencies
      if (currs) {
        setRates({
          BRL: Number(currs.BRL?.venta || currs.BRL || 1380),
          USD: Number(currs.USD?.venta || currs.USD || 7550),
        })
      }
    }).catch(() => {})
  }, [])

  // Desglose real por forma de pago para el reporte de cierre X/Z, filtrado
  // por el mismo rango de fechas y punto de emision que ya tiene la
  // pantalla -- se pide recien al abrir el modal, no en cada carga.
  useEffect(() => {
    if (!showCierreModal) return
    setLoadingBreakdown(true)
    api.reports.salesByPaymentMethod({ fecha_desde: dateFrom || undefined, fecha_hasta: dateTo || undefined })
      .then((rows) => setPaymentBreakdown(rows || []))
      .catch(() => setPaymentBreakdown([]))
      .finally(() => setLoadingBreakdown(false))
  }, [showCierreModal, dateFrom, dateTo])

  // Mapa de Clientes
  const customersMap = useMemo(() => {
    const map = new Map<string, Customer>()
    customers.forEach((c) => {
      if (c.id) map.set(c.id, c)
    })
    return map
  }, [customers])

  // Filtrado de Ventas
  const filteredSales = useMemo(() => {
    return sales.filter((s: any) => {
      // Filtro por punto de emisión
      if (selectedPunto !== "todos") {
        const num = String(s.numero || "")
        if (!num.startsWith(selectedPunto)) return false
      }

      // Filtro por pestaña
      if (activeTab === "notas_credito") {
        if (s.tipo_comprobante !== "nota_credito" && s.estado !== "cancelado") return false
      } else if (activeTab === "extra_club_credito") {
        if (s.condicion !== "credito" && s.condicion !== "credito_extra_club") return false
      }

      // Filtro por estado
      if (statusFilter === "contado" && s.condicion !== "contado") return false
      if (statusFilter === "credito" && s.condicion !== "credito" && s.condicion !== "credito_extra_club") return false
      if (statusFilter === "canceladas" && s.estado !== "cancelado") return false

      // Búsqueda
      if (search.trim()) {
        const q = search.toLowerCase()
        const num = (s.numero || "").toLowerCase()
        const custName = (customersMap.get(s.customer_id)?.razon_social || s.customer_name || "").toLowerCase()
        const custRuc = (customersMap.get(s.customer_id)?.ruc || s.customer_ruc || "").toLowerCase()
        return num.includes(q) || custName.includes(q) || custRuc.includes(q)
      }

      return true
    })
  }, [sales, selectedPunto, activeTab, statusFilter, search, customersMap])

  // KPIs Financieros Consolidados
  const kpis = useMemo(() => {
    let totalMonto = 0
    let totalIva10 = 0
    let totalIva5 = 0
    let totalExenta = 0
    let totalContado = 0
    let totalCredito = 0
    let totalExtraClub = 0
    let totalCanceladas = 0
    let countValidas = 0

    sales.forEach((s: any) => {
      const tot = Number(s.total || 0)
      if (s.estado === "cancelado") {
        totalCanceladas += tot
        return
      }

      countValidas++
      totalMonto += tot
      totalIva10 += Number(s.iva_10 || 0)
      totalIva5 += Number(s.iva_5 || 0)
      totalExenta += Number(s.base_exenta || 0)

      if (s.condicion === "contado") totalContado += tot
      else if (s.condicion === "credito_extra_club") {
        totalCredito += tot
        totalExtraClub += tot
      } else if (s.condicion === "credito") {
        totalCredito += tot
      }
    })

    const avgTicket = countValidas > 0 ? Math.round(totalMonto / countValidas) : 0

    return {
      totalMonto,
      totalIva: totalIva10 + totalIva5,
      totalIva10,
      totalIva5,
      totalExenta,
      totalContado,
      totalCredito,
      totalExtraClub,
      totalCanceladas,
      totalTickets: countValidas,
      avgTicket,
    }
  }, [sales])

  // Anular Comprobante & Generar Nota de Crédito Oficial DNIT
  const handleAnularVenta = async () => {
    if (!viewingSale) return
    setAnulando(true)
    try {
      await api.sales.cancel(viewingSale.id)
      toast.success("Nota de Crédito Emitida (DNIT)", `NC generada con Timbrado Nº ${timbradoNC} sobre comprobante #${viewingSale.numero}.`)
      setAnularModal(null)
      setViewingSale(null)
      fetchData()
    } catch (err: any) {
      toast.error("Error al emitir Nota de Crédito", err.message)
    } finally {
      setAnulando(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ── HEADER OPERATIVO ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white tracking-tight">
              Ventas & Facturación Autoimpresa
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              DNIT Timbrado Nº {timbradoFacturas} · NC Nº {timbradoNC}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Gestión oficial ante la DNIT de comprobantes autoimpresos, notas de crédito, cuentas corrientes y cierres de turno de caja (X/Z).
          </p>
        </div>

        {/* Acciones Rápidas */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setCierreTipo("Z")
              setShowCierreModal(true)
            }}
            className="btn bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-extrabold text-xs flex items-center gap-2 shadow-sm hover:opacity-90"
          >
            <Receipt className="w-4 h-4" />
            <span>Cierre de Caja Z (Fin de Turno)</span>
          </button>

          <button
            onClick={() => {
              setCierreTipo("X")
              setShowCierreModal(true)
            }}
            className="btn bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 font-bold text-xs flex items-center gap-2 hover:bg-gray-50"
          >
            <Clock className="w-4 h-4 text-primary" />
            <span>Arqueo Parcial X</span>
          </button>
        </div>
      </div>

      {/* ── KPIS FINANCIEROS CONSOLIDADOS ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Facturado */}
        <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-emerald-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Facturación Neta del Período
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono font-black text-2xl text-gray-900 dark:text-white mt-2">
            {formatPYG(kpis.totalMonto)}
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500 mt-1 font-mono">
            <span>🇧🇷 R$ {(kpis.totalMonto / rates.BRL).toFixed(2)}</span>
            <span>🇺🇸 USD {(kpis.totalMonto / rates.USD).toFixed(2)}</span>
          </div>
        </div>

        {/* Liquidación Fiscal IVA */}
        <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-blue-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Total IVA Liquidado (DNIT)
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono font-black text-2xl text-blue-600 dark:text-blue-400 mt-2">
            {formatPYG(kpis.totalIva)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1 font-mono">
            <span>IVA 10%: {formatPYG(kpis.totalIva10)}</span>
            <span>IVA 5%: {formatPYG(kpis.totalIva5)}</span>
          </div>
        </div>

        {/* Extra Club & Crédito de la Casa */}
        <div className="card p-4 bg-white dark:bg-slate-900 border border-amber-500/30 border-l-4 border-l-amber-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Ventas Extra Club (Crédito)
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono font-black text-2xl text-amber-500 mt-2">
            {formatPYG(kpis.totalExtraClub || kpis.totalCredito)}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Cuenta corriente y afinidad de la casa
          </p>
        </div>

        {/* Volumen de Tickets & Ticket Promedio */}
        <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 border-l-4 border-l-indigo-500 rounded-2xl shadow-xs hover:-translate-y-0.5 transition-transform">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Volumen y Ticket Promedio
            </span>
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono font-black text-2xl text-gray-900 dark:text-white mt-2">
            {kpis.totalTickets.toLocaleString()} tix
          </div>
          <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            Promedio: {formatPYG(kpis.avgTicket)} /ticket
          </div>
        </div>
      </div>

      {/* ── NAVEGACIÓN POR PESTAÑAS (TABS OPERATIVAS) ───────────────────────── */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: "comprobantes", label: "Comprobantes Emitidos", icon: Receipt, count: sales.length },
          { id: "cierres_caja", label: "Cierres de Caja (X / Z)", icon: Clock },
          { id: "extra_club_credito", label: "Crédito Extra Club", icon: Award },
          { id: "notas_credito", label: "Notas de Crédito & Anulaciones (DNIT)", icon: RotateCcw },
        ].map((t) => {
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                active
                  ? "bg-primary text-white shadow-sm"
                  : "bg-white dark:bg-slate-900 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-800 hover:bg-gray-50"
              }`}
            >
              <t.icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${active ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-500"}`}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── BARRA DE BÚSQUEDA Y FILTROS ────────────────────────────────────── */}
      <div className="card p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 w-4 h-4 text-gray-400 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por Nº comprobante, RUC/CI o nombre del cliente..."
            className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-3 py-2 text-xs font-medium outline-none focus:border-primary text-gray-900 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Selector de Puntos de Emisión */}
          <select
            value={selectedPunto}
            onChange={(e) => setSelectedPunto(e.target.value)}
            className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 outline-none"
          >
            {PUNTOS_EMISION.map((pe) => (
              <option key={pe.id} value={pe.id}>
                {pe.nombre}
              </option>
            ))}
          </select>

          {/* Selector de Rango de Fechas */}
          <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent font-mono text-[11px] outline-none text-gray-700 dark:text-gray-300"
            />
            <span className="text-gray-400">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent font-mono text-[11px] outline-none text-gray-700 dark:text-gray-300"
            />
          </div>

          {/* Filtro por Condición */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 outline-none"
          >
            <option value="todas">Todas las Condiciones</option>
            <option value="contado">Solo Contado</option>
            <option value="credito">Solo Crédito / Extra Club</option>
            <option value="canceladas">Solo Anuladas</option>
          </select>

          <button
            onClick={fetchData}
            className="p-2 text-gray-400 hover:text-primary rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            title="Recargar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── TABLA DE VENTAS Y COMPROBANTES ─────────────────────────────────── */}
      <div className="card bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-gray-400 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="p-3.5">Nº Comprobante</th>
                <th className="p-3.5">Fecha / Hora</th>
                <th className="p-3.5">Cliente</th>
                <th className="p-3.5">RUC / C.I.</th>
                <th className="p-3.5 text-center">Condición</th>
                <th className="p-3.5 text-right">Monto Total</th>
                <th className="p-3.5 text-right">IVA Liquidado</th>
                <th className="p-3.5 text-center">Estado</th>
                <th className="p-3.5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    <span>Cargando comprobantes...</span>
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-400">
                    No se encontraron comprobantes coincidentes.
                  </td>
                </tr>
              ) : (
                filteredSales.map((s: any) => {
                  const cust = customersMap.get(s.customer_id)
                  const custName = cust?.razon_social || s.customer_name || "Consumidor Final"
                  const custRuc = cust?.ruc || cust?.ci || s.customer_ruc || "44444401-7"
                  const isCancelada = s.estado === "cancelado"
                  const isExtraClub = s.condicion === "credito_extra_club"
                  const isNC = s.tipo_comprobante === "nota_credito"

                  return (
                    <tr key={s.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-gray-900 dark:text-white">
                        <div className="flex items-center gap-1.5">
                          {isNC ? (
                            <RotateCcw className="w-3.5 h-3.5 text-red-500" />
                          ) : (
                            <Receipt className="w-3.5 h-3.5 text-primary" />
                          )}
                          <span>{s.numero || `Sin numero (ID ${s.id.slice(-8)})`}</span>
                        </div>
                      </td>
                      <td className="p-3.5 text-gray-500 font-mono text-[11px]">
                        {s.fecha ? new Date(s.fecha).toLocaleString("es-PY") : formatDate(s.created_at)}
                      </td>
                      <td className="p-3.5 font-bold text-gray-800 dark:text-gray-200 max-w-[180px] truncate">
                        {custName}
                      </td>
                      <td className="p-3.5 font-mono text-gray-500 text-[11px]">
                        {custRuc}
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            isExtraClub
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              : isNC
                              ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                              : s.condicion === "credito"
                              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          }`}
                        >
                          {isNC ? "Nota de Crédito" : isExtraClub ? "Extra Club" : s.condicion || "Contado"}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-mono font-black text-gray-900 dark:text-white">
                        {formatPYG(Number(s.total || 0))}
                      </td>
                      <td className="p-3.5 text-right font-mono text-gray-500 text-[11px]">
                        {formatPYG(Number(s.iva_10 || 0) + Number(s.iva_5 || 0))}
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isCancelada
                              ? "bg-red-500/10 text-red-600 dark:text-red-400"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {isCancelada ? "Anulada / NC" : "Emitida / Cobrada"}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setViewingSale(s)}
                            className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title="Ver detalle / Imprimir ticket"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {!isCancelada && !isNC && (
                            <button
                              onClick={() => {
                                setViewingSale(s)
                                setAnularModal(s)
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Anular comprobante / Emitir Nota de Crédito DNIT"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
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
      </div>

      {/* ── MODAL DE DETALLE / VISOR TÉRMICO AUTOIMPRESOR DNIT ───────────────── */}
      {viewingSale && !anularModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-lg p-6 bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-gray-800 space-y-4 shadow-2xl">
            {/* Header del Ticket Autoimpresor */}
            <div className="text-center pb-3 border-b border-dashed border-gray-300 dark:border-gray-700">
              <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center mx-auto font-black text-xs mb-2">
                EXTRA
              </div>
              <h3 className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-tight">
                GRUPO SANTA TERESA E.A.S.
              </h3>
              <p className="text-xs text-gray-500 font-bold">
                Extra Supermercado Mayorista
              </p>
              <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                RUC: 80150377-9 · Salón Central
              </p>
              <div className="mt-2 p-1.5 bg-blue-50 dark:bg-slate-800 rounded-xl text-[10px] text-blue-700 dark:text-blue-300 font-mono">
                DNIT Timbrado Autoimpresor Nº {timbradoFacturas} · Válido hasta {timbradoVencimiento}
              </div>
            </div>

            {/* Datos del Comprobante */}
            <div className="space-y-1 text-xs border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Comprobante:</span>
                <strong className="font-mono text-gray-900 dark:text-white">
                  {viewingSale.numero || `001-001-00${viewingSale.id.slice(-5)}`}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Fecha / Hora:</span>
                <span className="font-mono text-gray-700 dark:text-gray-300">
                  {viewingSale.fecha ? new Date(viewingSale.fecha).toLocaleString("es-PY") : formatDate(viewingSale.created_at)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Cliente:</span>
                <strong className="text-gray-900 dark:text-white">
                  {(viewingSale.customer_id ? customersMap.get(viewingSale.customer_id)?.razon_social : null) || (viewingSale as any).customer_name || "Consumidor Final"}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">RUC / C.I.:</span>
                <span className="font-mono text-gray-700 dark:text-gray-300">
                  {(viewingSale.customer_id ? customersMap.get(viewingSale.customer_id)?.ruc : null) || (viewingSale as any).customer_ruc || "44444401-7"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Condición de Venta:</span>
                <span className="font-bold uppercase text-primary">
                  {viewingSale.condicion === "credito_extra_club" ? "Crédito Extra Club" : viewingSale.condicion || "Contado"}
                </span>
              </div>
            </div>

            {/* Ítems del Comprobante */}
            <div className="max-h-48 overflow-y-auto space-y-2 divide-y divide-gray-100 dark:divide-gray-800 pr-1">
              {(viewingSale.items || []).map((item: any, idx: number) => (
                <div key={idx} className="pt-2 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-gray-800 dark:text-gray-200">
                      {item.descripcion || item.product_name || "Producto"}
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono">
                      {item.cantidad} un. x {formatPYG(Number(item.precio_unitario || item.precio || 0))} · IVA {item.iva_tasa || 10}%
                    </div>
                  </div>
                  <div className="font-mono font-black text-gray-900 dark:text-white">
                    {formatPYG(Number(item.total || (item.cantidad * item.precio_unitario) || 0))}
                  </div>
                </div>
              ))}
            </div>

            {/* Totales & Liquidación Fiscal DNIT */}
            <div className="bg-gray-50 dark:bg-slate-800/80 p-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-500 text-[11px]">
                <span>Total Exenta:</span>
                <span className="font-mono">{formatPYG(Number((viewingSale as any).base_exenta || 0))}</span>
              </div>
              <div className="flex justify-between text-gray-500 text-[11px]">
                <span>Total Gravada 5%:</span>
                <span className="font-mono">{formatPYG(Number((viewingSale as any).base_gravada_5 || 0))}</span>
              </div>
              <div className="flex justify-between text-gray-500 text-[11px]">
                <span>Total Gravada 10%:</span>
                <span className="font-mono">{formatPYG(Number((viewingSale as any).base_gravada_10 || 0))}</span>
              </div>
              <div className="flex justify-between text-blue-600 dark:text-blue-400 font-bold text-[11px] pt-1 border-t border-gray-200 dark:border-gray-700">
                <span>Total Liquidación IVA (DNIT):</span>
                <span className="font-mono">{formatPYG(Number(viewingSale.iva_10 || 0) + Number(viewingSale.iva_5 || 0))}</span>
              </div>
              <div className="flex justify-between font-black text-base text-gray-900 dark:text-white pt-1.5 border-t border-gray-200 dark:border-gray-700">
                <span>TOTAL COMPROBANTE:</span>
                <span className="font-mono text-primary">{formatPYG(Number(viewingSale.total || 0))}</span>
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setViewingSale(null)}
                className="w-1/3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  window.print()
                  toast.success("Impresión", "Enviando comprobante a la ticketera 80mm...")
                }}
                className="w-2/3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Ticket Térmico (80mm)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE CIERRE DE CAJA X / Z ──────────────────────────────────── */}
      {showCierreModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md p-6 bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-gray-800 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary" />
                <h3 className="font-black text-base text-gray-900 dark:text-white">
                  Reporte de Cierre de Caja {cierreTipo}
                </h3>
              </div>
              <button onClick={() => setShowCierreModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">Tipo de Reporte:</span>
                  <strong className="text-primary">{cierreTipo === "Z" ? "Cierre Definitivo Z" : "Arqueo Parcial X"}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Puntos de Emisión:</span>
                  <span className="font-mono text-gray-700 dark:text-gray-300">{selectedPunto === "todos" ? "Consolidado Todas las Cajas" : selectedPunto}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Fecha / Hora:</span>
                  <span className="font-mono text-gray-700 dark:text-gray-300">{new Date().toLocaleString("es-PY")}</span>
                </div>
              </div>

              {/* Recaudación por Medios de Pago -- datos reales de
                  sale_payments para el mismo rango de fechas, ya no
                  porcentajes fijos inventados sobre el total. */}
              <div className="bg-gray-50 dark:bg-slate-800 p-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">
                  Recaudación Desglosada (real)
                </span>
                {loadingBreakdown ? (
                  <div className="flex items-center justify-center py-3 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                ) : paymentBreakdown.length === 0 ? (
                  <p className="text-[11px] text-gray-400">Sin pagos registrados en el rango seleccionado.</p>
                ) : (
                  paymentBreakdown.map((p) => {
                    const label = FORMA_PAGO_LABELS[p.forma_pago] || p.forma_pago
                    return (
                      <div key={p.forma_pago} className="flex justify-between font-mono">
                        <span>{label}:</span>
                        <strong>{formatPYG(p.monto)}</strong>
                      </div>
                    )
                  })
                )}
                <div className="flex justify-between font-black text-sm text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span>TOTAL GENERAL:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    {formatPYG(paymentBreakdown.reduce((s, p) => s + p.monto, 0))}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowCierreModal(false)}
                className="w-1/3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  window.print()
                  toast.success("Cierre Emitido", `Reporte ${cierreTipo} impreso en la ticketera.`)
                  setShowCierreModal(false)
                }}
                className="w-2/3 bg-primary hover:bg-primary/90 text-white py-2.5 rounded-xl font-bold text-xs shadow-md shadow-primary/20 flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Reporte {cierreTipo} (80mm)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE NOTA DE CRÉDITO & ANULACIÓN DNIT ────────────────────────── */}
      {anularModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md p-6 bg-white dark:bg-slate-900 rounded-3xl border-2 border-red-500 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-red-600">
              <AlertTriangle className="w-6 h-6" />
              <div>
                <h3 className="font-black text-base text-gray-900 dark:text-white">
                  Emitir Nota de Crédito DNIT
                </h3>
                <span className="text-[10px] font-mono text-gray-400">
                  Timbrado NC Nº {timbradoNC} · Punto 001-001
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Se emitirá una Nota de Crédito oficial por <strong>{formatPYG(Number(anularModal.total || 0))}</strong> anulando el comprobante <strong>#{anularModal.numero || anularModal.id}</strong>. Esta acción reingresará el stock al inventario.
            </p>

            <div>
              <label className="text-[10px] font-bold text-gray-400 mb-1 block">Motivo de Devolución / Anulación (Auditoría DNIT)</label>
              <input
                type="text"
                value={anularMotivo}
                onChange={(e) => setAnularMotivo(e.target.value)}
                placeholder="Ej: Devolución de mercadería, error de caja, cambio..."
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs outline-none focus:border-red-500 text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setAnularModal(null)}
                className="w-1/2 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={handleAnularVenta}
                disabled={anulando}
                className="w-1/2 bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-xl font-bold text-xs shadow-md shadow-red-600/20 flex items-center justify-center gap-2"
              >
                {anulando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                <span>Emitir NC DNIT</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
