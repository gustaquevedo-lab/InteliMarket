import React, { useState, useEffect, useMemo } from "react"
import {
  Search, ShoppingCart, TrendingUp, Eye, Loader2, FileDown, Download, Filter,
  X, DollarSign, CreditCard, Plus, RotateCcw, Printer, FileText,
  Receipt, ShieldCheck, FileSpreadsheet, Layers, CheckCircle2, AlertTriangle,
  Calendar, ArrowUpRight, Banknote, Award, RefreshCw, Clock, Building,
  Check, ChevronRight
} from "lucide-react"
import { api, type Sale, type Customer } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useConfirm } from "../../components/ConfirmDialog"
import { formatPYG, formatDate } from "../../utils/format"

type SalesTab = "comprobantes" | "cierres_caja" | "notas_credito" | "extra_club_credito"
type StatusFilter = "todas" | "contado" | "credito" | "canceladas"

const FORMA_PAGO_LABELS: Record<string, string> = {
  EFECTIVO: "🇵🇾 Efectivo",
  TARJETA_BANCARD: "💳 Tarjeta Bancard",
  TARJETA_DINELCO: "💳 Tarjeta Dinelco",
  "TARJETA CREDITO": "💳 Tarjeta Crédito",
  "TARJETA DEBITO": "💳 Tarjeta Débito",
  QR: "📱 QR Bancard / Dinelco",
  "QR CODE": "📱 QR Code",
  PIX: "📱 Pix (Brasil)",
  EXTRA_CLUB: "⭐ Extra Club (Crédito)",
  "TRANF. BANCARIA": "🏦 Transferencia Bancaria",
  CHEQUES: "🧾 Cheques",
  "VALE COMPRA": "🎟️ Vale de Compra",
}

const PUNTOS_EMISION = [
  { id: "todos", nombre: "Todos los Puntos de Emisión" },
  { id: "001-011", nombre: "Caja 01 · Salón Central (Boca 011)" },
  { id: "001-012", nombre: "Caja 02 · Salón Central (Boca 012)" },
  { id: "001-013", nombre: "Caja 03 · Salón Central (Boca 013)" },
  { id: "001-014", nombre: "Caja 04 · Salón Central (Boca 014)" },
  { id: "001-015", nombre: "Caja 05 · Salón Central (Boca 015)" },
  { id: "001-016", nombre: "Caja 06 · Salón Central (Boca 016)" },
  { id: "001-017", nombre: "Caja 07 · Línea de Caja (Boca 017)" },
  { id: "001-018", nombre: "Caja 08 · Mayorista (Boca 018)" },
  { id: "001-019", nombre: "Caja 09 · Esquina / Administración (Boca 019)" },
  { id: "001-020", nombre: "Caja 10 · Esquina / Refuerzo (Boca 020)" },
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
  const [paymentBreakdown, setPaymentBreakdown] = useState<{ forma_pago: string; monto: number; cantidad: number }[]>([])
  const [loadingBreakdown, setLoadingBreakdown] = useState(false)
  const [rates, setRates] = useState({ BRL: 1380, USD: 7550 })

  const toast = useToast()
  const confirm = useConfirm()

  const timbradoFacturas = "18545636"
  const timbradoNC = "18545636"
  const timbradoVencimiento = "31/12/2026"

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

  useEffect(() => {
    if (!showCierreModal) return
    setLoadingBreakdown(true)
    api.reports.salesByPaymentMethod({ fecha_desde: dateFrom || undefined, fecha_hasta: dateTo || undefined })
      .then((rows) => setPaymentBreakdown(rows || []))
      .catch(() => setPaymentBreakdown([]))
      .finally(() => setLoadingBreakdown(false))
  }, [showCierreModal, dateFrom, dateTo])

  const customersMap = useMemo(() => {
    const map = new Map<string, Customer>()
    customers.forEach((c) => {
      if (c.id) map.set(c.id, c)
    })
    return map
  }, [customers])

  const filteredSales = useMemo(() => {
    return sales.filter((s: any) => {
      if (selectedPunto !== "todos") {
        const num = String(s.numero || "")
        if (!num.startsWith(selectedPunto)) return false
      }

      if (activeTab === "notas_credito") {
        if (s.tipo_comprobante !== "nota_credito" && s.estado !== "cancelado") return false
      } else if (activeTab === "extra_club_credito") {
        if (s.condicion !== "credito" && s.condicion !== "credito_extra_club") return false
      }

      if (statusFilter === "contado" && s.condicion !== "contado") return false
      if (statusFilter === "credito" && s.condicion !== "credito" && s.condicion !== "credito_extra_club") return false
      if (statusFilter === "canceladas" && s.estado !== "cancelado") return false

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
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/90 text-white p-7 border border-blue-500/20 shadow-2xl shadow-blue-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 border border-blue-400/30 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Receipt className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-blue-400 uppercase bg-blue-500/10 px-2.5 py-0.5 rounded-md border border-blue-500/20">
                    GESTIÓN FISCAL · DNIT AUTOIMPRESOR
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    Timbrado Nº {timbradoFacturas} · Vence: {timbradoVencimiento}
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Facturación & Comprobantes de Venta
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Auditoría de tickets térmicos, liquidación de IVA 10%/5%, notas de crédito y cierres de turno de caja
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado · GRUPO SANTA TERESA E.A.S. (RUC 80150377-9)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                💵 Cotización: R$ {rates.BRL} · USD {rates.USD}
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-blue-300">
                🧾 {filteredSales.length} comprobantes en período
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={() => {
                setCierreTipo("X")
                setShowCierreModal(true)
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              Arqueo Parcial X
            </button>
            <button
              onClick={() => {
                setCierreTipo("Z")
                setShowCierreModal(true)
              }}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-blue-400 to-indigo-300 hover:from-blue-300 hover:to-indigo-200 transition shadow-lg shadow-blue-500/25 flex items-center gap-2"
            >
              <Receipt className="w-4 h-4" />
              Cierre de Caja Z (Fin de Turno)
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Facturación Neta</span>
              <span className="text-[10px] font-bold text-emerald-400">Total</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {formatPYG(kpis.totalMonto)}
            </p>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>🇧🇷 R$ {(kpis.totalMonto / rates.BRL).toFixed(0)}</span>
              <span>🇺🇸 USD {(kpis.totalMonto / rates.USD).toFixed(0)}</span>
            </div>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">IVA Liquidado</span>
              <span className="text-[10px] font-bold text-blue-400">DNIT</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-blue-300">
              {formatPYG(kpis.totalIva)}
            </p>
            <p className="text-[11px] text-slate-400">IVA 10%: {formatPYG(kpis.totalIva10)}</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Extra Club (Crédito)</span>
              <span className="text-[10px] font-bold text-amber-400">Afinidad</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-400">
              {formatPYG(kpis.totalExtraClub || kpis.totalCredito)}
            </p>
            <p className="text-[11px] text-slate-400">Cuenta corriente propia</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Volumen & Ticket Medio</span>
              <span className="text-[10px] font-mono text-indigo-400">Promedio</span>
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-indigo-300">
              {kpis.totalTickets.toLocaleString()} <span className="text-sm font-semibold text-slate-400">tix</span>
            </p>
            <p className="text-[11px] text-emerald-400 font-mono">{formatPYG(kpis.avgTicket)} /ticket</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { id: "comprobantes", label: "Comprobantes Emitidos", icon: Receipt, count: sales.length },
          { id: "cierres_caja", label: "Cierres de Caja (X / Z)", icon: Clock },
          { id: "extra_club_credito", label: "Crédito Extra Club", icon: Award },
          { id: "notas_credito", label: "Notas de Crédito & Anulaciones", icon: RotateCcw },
        ].map((t) => {
          const Icon = t.icon
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  active ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 🔍 BARRA DE HERRAMIENTAS & FILTROS GLASSMORPHISM */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 w-4 h-4 text-slate-400 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por Nº comprobante, RUC/CI o nombre del cliente..."
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedPunto}
            onChange={(e) => setSelectedPunto(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
          >
            {PUNTOS_EMISION.map((pe) => (
              <option key={pe.id} value={pe.id}>
                {pe.nombre}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent font-mono text-[11px] outline-none text-slate-700 dark:text-slate-300"
            />
            <span className="text-slate-400">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent font-mono text-[11px] outline-none text-slate-700 dark:text-slate-300"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
          >
            <option value="todas">Todas las Condiciones</option>
            <option value="contado">Solo Contado</option>
            <option value="credito">Solo Crédito / Extra Club</option>
            <option value="canceladas">Solo Anuladas</option>
          </select>

          <button
            onClick={fetchData}
            className="p-2.5 text-slate-400 hover:text-blue-500 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm"
            title="Recargar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* 📊 TABLA DE VENTAS Y COMPROBANTES */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4">Nº Comprobante</th>
                <th className="p-4">Fecha / Hora</th>
                <th className="p-4">Cliente</th>
                <th className="p-4">RUC / C.I.</th>
                <th className="p-4 text-center">Condición</th>
                <th className="p-4 text-right">Monto Total</th>
                <th className="p-4 text-right">IVA Liquidado</th>
                <th className="p-4 text-center">Estado</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    <span>Cargando comprobantes fiscales...</span>
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400">
                    No se encontraron comprobantes coincidentes con los filtros.
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
                    <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-mono font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          {isNC ? (
                            <RotateCcw className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          ) : (
                            <Receipt className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          )}
                          <span>{s.numero || `Sin numero (ID ${s.id.slice(-8)})`}</span>
                        </div>
                      </td>
                      <td className="p-4 text-slate-500 font-mono text-[11px]">
                        {s.fecha ? new Date(s.fecha).toLocaleString("es-PY") : formatDate(s.created_at)}
                      </td>
                      <td className="p-4 font-bold text-slate-800 dark:text-slate-200 max-w-[200px] truncate">
                        {custName}
                      </td>
                      <td className="p-4 font-mono text-slate-500 text-[11px]">
                        {custRuc}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            isExtraClub
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              : isNC
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                              : s.condicion === "credito"
                              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          }`}
                        >
                          {isNC ? "Nota de Crédito" : isExtraClub ? "Extra Club" : s.condicion || "Contado"}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono font-black text-slate-900 dark:text-white">
                        {formatPYG(Number(s.total || 0))}
                      </td>
                      <td className="p-4 text-right font-mono text-slate-500 text-[11px]">
                        {formatPYG(Number(s.iva_10 || 0) + Number(s.iva_5 || 0))}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isCancelada
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {isCancelada ? "Anulada / NC" : "Emitida / Cobrada"}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setViewingSale(s)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition"
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
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition"
                              title="Anular comprobante / Emitir Nota de Crédito DNIT"
                            >
                              <RotateCcw className="w-4 h-4" />
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
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xl">
            <div className="text-center pb-3 border-b border-dashed border-slate-300 dark:border-slate-700">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto font-black text-xs mb-2 shadow-md shadow-blue-500/20">
                EXTRA
              </div>
              <h3 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-tight">
                GRUPO SANTA TERESA E.A.S.
              </h3>
              <p className="text-xs text-slate-500 font-bold">
                Extra Supermercado Mayorista
              </p>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                RUC: 80150377-9 · Casa Central
              </p>
              <div className="mt-2 p-2 bg-blue-50 dark:bg-slate-800 rounded-xl text-[10px] text-blue-700 dark:text-blue-300 font-mono">
                DNIT Timbrado Autoimpresor Nº {timbradoFacturas} · Vence: {timbradoVencimiento}
              </div>
            </div>

            <div className="space-y-1.5 text-xs border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Comprobante:</span>
                <strong className="font-mono text-slate-900 dark:text-white">
                  {viewingSale.numero || `001-001-00${viewingSale.id.slice(-5)}`}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Fecha / Hora:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {viewingSale.fecha ? new Date(viewingSale.fecha).toLocaleString("es-PY") : formatDate(viewingSale.created_at)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Cliente:</span>
                <strong className="text-slate-900 dark:text-white">
                  {(viewingSale.customer_id ? customersMap.get(viewingSale.customer_id)?.razon_social : null) || (viewingSale as any).customer_name || "Consumidor Final"}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">RUC / C.I.:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {(viewingSale.customer_id ? customersMap.get(viewingSale.customer_id)?.ruc : null) || (viewingSale as any).customer_ruc || "44444401-7"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Condición de Venta:</span>
                <span className="font-bold uppercase text-blue-600 dark:text-blue-400">
                  {viewingSale.condicion === "credito_extra_club" ? "Crédito Extra Club" : viewingSale.condicion || "Contado"}
                </span>
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-2 divide-y divide-slate-100 dark:divide-slate-800 pr-1">
              {(viewingSale.items || []).map((item: any, idx: number) => (
                <div key={idx} className="pt-2 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      {item.descripcion || item.product_name || "Producto"}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {item.cantidad} un. x {formatPYG(Number(item.precio_unitario || item.precio || 0))} · IVA {item.iva_tasa || 10}%
                    </div>
                  </div>
                  <div className="font-mono font-black text-slate-900 dark:text-white">
                    {formatPYG(Number(item.total || (item.cantidad * item.precio_unitario) || 0))}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Total Exenta:</span>
                <span className="font-mono">{formatPYG(Number((viewingSale as any).base_exenta || 0))}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Total Gravada 5%:</span>
                <span className="font-mono">{formatPYG(Number((viewingSale as any).base_gravada_5 || 0))}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Total Gravada 10%:</span>
                <span className="font-mono">{formatPYG(Number((viewingSale as any).base_gravada_10 || 0))}</span>
              </div>
              <div className="flex justify-between text-blue-600 dark:text-blue-400 font-bold text-[11px] pt-1 border-t border-slate-200 dark:border-slate-700">
                <span>Total Liquidación IVA (DNIT):</span>
                <span className="font-mono">{formatPYG(Number(viewingSale.iva_10 || 0) + Number(viewingSale.iva_5 || 0))}</span>
              </div>
              <div className="flex justify-between font-black text-base text-slate-900 dark:text-white pt-1.5 border-t border-slate-200 dark:border-slate-700">
                <span>TOTAL COMPROBANTE:</span>
                <span className="font-mono text-blue-600 dark:text-blue-400">{formatPYG(Number(viewingSale.total || 0))}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setViewingSale(null)}
                className="w-1/3 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  window.print()
                  toast.success("Impresión", "Enviando comprobante a la ticketera 80mm...")
                }}
                className="w-2/3 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl font-extrabold text-xs flex items-center justify-center gap-2 transition shadow-md shadow-blue-500/25"
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
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-500" />
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  Reporte de Cierre de Caja {cierreTipo}
                </h3>
              </div>
              <button onClick={() => setShowCierreModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Tipo de Reporte:</span>
                  <strong className="text-blue-600 dark:text-blue-400">{cierreTipo === "Z" ? "Cierre Definitivo Z" : "Arqueo Parcial X"}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Puntos de Emisión:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{selectedPunto === "todos" ? "Consolidado Todas las Cajas" : selectedPunto}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Fecha / Hora:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{new Date().toLocaleString("es-PY")}</span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/70 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Recaudación Desglosada (real)
                </span>
                {loadingBreakdown ? (
                  <div className="flex items-center justify-center py-3 text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  </div>
                ) : paymentBreakdown.length === 0 ? (
                  <p className="text-[11px] text-slate-400">Sin pagos registrados en el rango seleccionado.</p>
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
                <div className="flex justify-between font-black text-sm text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
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
                className="w-1/3 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  window.print()
                  toast.success("Cierre Emitido", `Reporte ${cierreTipo} impreso en la ticketera.`)
                  setShowCierreModal(false)
                }}
                className="w-2/3 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl font-bold text-xs shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition"
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
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 bg-white dark:bg-slate-900 rounded-3xl border-2 border-rose-500 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  Emitir Nota de Crédito DNIT
                </h3>
                <span className="text-[10px] font-mono text-slate-400">
                  Timbrado NC Nº {timbradoNC} · Punto 001-001
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Se emitirá una Nota de Crédito oficial por <strong>{formatPYG(Number(anularModal.total || 0))}</strong> anulando el comprobante <strong>#{anularModal.numero || anularModal.id}</strong>. Esta acción reingresará el stock al inventario.
            </p>

            <div>
              <label className="text-[10px] font-bold text-slate-400 mb-1 block">Motivo de Devolución / Anulación (Auditoría DNIT)</label>
              <input
                type="text"
                value={anularMotivo}
                onChange={(e) => setAnularMotivo(e.target.value)}
                placeholder="Ej: Devolución de mercadería, error de caja, cambio..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs outline-none focus:border-rose-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setAnularModal(null)}
                className="w-1/2 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleAnularVenta}
                disabled={anulando}
                className="w-1/2 bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-2xl font-bold text-xs shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 transition"
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
