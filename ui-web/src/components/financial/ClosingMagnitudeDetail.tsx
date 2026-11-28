import React, { useState, useEffect, useMemo } from "react"
import {
  Search,
  Download,
  Users,
  FileText,
  ArrowLeft,
  Building,
  Building2,
  Wrench,
  Truck,
  Briefcase,
  Landmark,
  ShoppingBag,
  DollarSign,
  Info,
  CheckCircle2,
  CreditCard,
  QrCode,
  Smartphone,
  Layers,
  Receipt,
  SlidersHorizontal,
  Split,
  RefreshCw
} from "lucide-react"
import { formatPYG } from "../../utils/format"
import { REAL_NOMINA, REAL_GASTOS } from "./closingDataReal"
import { api } from "../../api"
import { ReclassifyExpenseModal } from "./ReclassifyExpenseModal"

interface ClosingMagnitudeDetailProps {
  magnitude: string
  subMagnitude?: string
  closingData?: any
  month?: number
  year?: number
  onBackToPnl: () => void
  onExportExcel: () => void
  onDataUpdated?: () => void
  onNavigateTab?: (targetTab: string) => void
}

export function ClosingMagnitudeDetail({
  magnitude,
  subMagnitude,
  closingData,
  month = 11,
  year = 2026,
  onBackToPnl,
  onExportExcel,
  onDataUpdated,
  onNavigateTab
}: ClosingMagnitudeDetailProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [familyFilter, setFamilyFilter] = useState<string>(subMagnitude || "todas")
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("")
  const [selectedSectorFilter, setSelectedSectorFilter] = useState("")
  const [remoteItems, setRemoteItems] = useState<any[] | null>(null)
  const [ncItems, setNcItems] = useState<any[]>([])
  const [mpItems, setMpItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<any | null>(null)
  const [downloadingAuditPdf, setDownloadingAuditPdf] = useState(false)
  const [downloadingAuditXlsx, setDownloadingAuditXlsx] = useState(false)

  const activeMonth = month || 11
  const activeYear = year || 2026

  const handleDownloadAuditPdf = async () => {
    setDownloadingAuditPdf(true)
    try {
      const m = activeMonth
      const y = activeYear
      const lastDay = new Date(y, m, 0).getDate()
      const fecha_desde = `${y}-${String(m).padStart(2, "0")}-01`
      const fecha_hasta = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
      await api.expenses.reports.downloadPhysicalAuditSheetPdf({ fecha_desde, fecha_hasta })
    } catch (err: any) {
      console.error("Error descargando Hoja de Punteo PDF:", err)
      alert("No se pudo generar la hoja de punteo PDF: " + (err?.message || "Error de red"))
    } finally {
      setDownloadingAuditPdf(false)
    }
  }

  const handleDownloadAuditXlsx = async () => {
    setDownloadingAuditXlsx(true)
    try {
      const m = activeMonth
      const y = activeYear
      const lastDay = new Date(y, m, 0).getDate()
      const fecha_desde = `${y}-${String(m).padStart(2, "0")}-01`
      const fecha_hasta = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
      await api.expenses.reports.downloadPhysicalAuditSheetXlsx({ fecha_desde, fecha_hasta })
    } catch (err: any) {
      console.error("Error descargando Hoja de Punteo Excel:", err)
      alert("No se pudo generar la hoja de punteo Excel: " + (err?.message || "Error de red"))
    } finally {
      setDownloadingAuditXlsx(false)
    }
  }

  // Carga reactiva de comprobantes/items para la magnitud activa
  const fetchDetails = async () => {
    if (magnitude === "cogs") {
      setLoading(true)
      try {
        const [resNc, resMp] = await Promise.all([
          api.financial.closing.getMagnitudeDetails("cogs_nc", activeMonth, activeYear, "80150377-9"),
          api.financial.closing.getMagnitudeDetails("cogs_mp", activeMonth, activeYear, "80150377-9")
        ])
        if (resNc && resNc.items) setNcItems(resNc.items)
        if (resMp && resMp.items) setMpItems(resMp.items)
      } catch (err) {
        console.warn("Error cargando detalles cogs", err)
      } finally {
        setLoading(false)
      }
      return
    }
    if (magnitude === "nomina" || magnitude === "ingresos") {
      setRemoteItems(null)
      return
    }
    setLoading(true)
    try {
      const res = await api.financial.closing.getMagnitudeDetails(magnitude, activeMonth, activeYear, "80150377-9")
      if (res && res.items) {
        setRemoteItems(res.items)
      }
    } catch (err) {
      console.warn("Error cargando detalles para", magnitude, err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDetails()
  }, [magnitude, activeMonth, activeYear])

  // Datos de Nómina SueldOK
  const nominaData = REAL_NOMINA

  // Datos de Canales de Cobro (Fallback Septiembre 2026 si no hay datos dinámicos)
  const defaultCanalesCobro = [
    {
      id: "efectivo",
      nombre: "Efectivo Guaraníes en Cajas",
      subtexto: "Recaudación física en gavetas, custodia en Bóveda Central y remesas blindadas",
      tickets: 8774,
      monto: 541138681,
      pct: 43.83,
      badge: "Bóveda Central",
      badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700",
      icon: DollarSign,
      barColor: "bg-emerald-500"
    },
    {
      id: "tarjetas",
      nombre: "Tarjetas POS Bancard & Dinelco",
      subtexto: "Tarjetas de Crédito, Débito, Bancard y Dinelco",
      tickets: 1334,
      monto: 252264444,
      pct: 20.43,
      badge: "POS Terminal",
      badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-700",
      icon: CreditCard,
      barColor: "bg-blue-500"
    },
    {
      id: "extra_club",
      nombre: "Cobros Extra Club (Vales y Créditos)",
      subtexto: "Compras a crédito autorizadas de colaboradores compensadas en nómina SueldOK",
      tickets: 1073,
      monto: 193690808,
      pct: 15.69,
      badge: "Descuento Nómina",
      badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300 dark:border-purple-700",
      icon: Users,
      barColor: "bg-purple-500"
    },
    {
      id: "qr",
      nombre: "Billeteras Digitales y Cobros QR SIPAP",
      subtexto: "Pagos interoperables QR Bancard y Dinelco cobrados al instante en cajas",
      tickets: 1613,
      monto: 157106696,
      pct: 12.72,
      badge: "QR Inmediato",
      badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700",
      icon: QrCode,
      barColor: "bg-amber-500"
    },
    {
      id: "pix",
      nombre: "PIX PlugPay / Divisas de Frontera",
      subtexto: "Cobros en Reales/Pix acreditados en cuenta Continental Ahorro Pix",
      tickets: 347,
      monto: 19549539,
      pct: 1.58,
      badge: "Frontera R$",
      badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-300 dark:border-teal-700",
      icon: Smartphone,
      barColor: "bg-teal-500"
    },
    {
      id: "transferencias",
      nombre: "Transferencias Bancarias SIPAP",
      subtexto: "Depósitos bancarios y transferencias directas de clientes mayoristas",
      tickets: 20,
      monto: 11827542,
      pct: 0.96,
      badge: "Bancario SIPAP",
      badgeColor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700",
      icon: Landmark,
      barColor: "bg-indigo-500"
    }
  ]

  const rawCanales = closingData?.ingresos?.canales_cobro
  const canalesCobro = (rawCanales && rawCanales.length > 0)
    ? rawCanales.map((c: any) => {
        const canalName = c.canal || c.nombre || "Canal"
        const isEfectivo = canalName.toLowerCase().includes("efectivo")
        const isTarjeta = canalName.toLowerCase().includes("tarjeta") || canalName.toLowerCase().includes("bancard") || canalName.toLowerCase().includes("dinelco")
        const isQr = canalName.toLowerCase().includes("qr")
        const isPix = canalName.toLowerCase().includes("pix")
        const isClub = canalName.toLowerCase().includes("extra") || canalName.toLowerCase().includes("club")

        return {
          id: c.canal || c.id,
          nombre: canalName,
          subtexto: c.descripcion || c.subtexto || `Cobros registrados vía ${canalName}`,
          tickets: c.tickets || 0,
          monto: c.total_cobrado != null ? c.total_cobrado : (c.monto || 0),
          pct: c.pct_ventas != null ? c.pct_ventas : (c.pct || 0),
          badge: canalName,
          badgeColor: isEfectivo
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
            : isTarjeta
            ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-700"
            : isQr
            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700"
            : isPix
            ? "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-300 dark:border-teal-700"
            : isClub
            ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300 dark:border-purple-700"
            : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700",
          icon: isEfectivo ? DollarSign : isTarjeta ? CreditCard : isQr ? QrCode : isPix ? Smartphone : isClub ? Users : Landmark,
          barColor: isEfectivo ? "bg-emerald-500" : isTarjeta ? "bg-blue-500" : isQr ? "bg-amber-500" : isPix ? "bg-teal-500" : isClub ? "bg-purple-500" : "bg-indigo-500"
        }
      })
    : defaultCanalesCobro

  // Datos de Ventas por Terminal / Caja (Fallback Septiembre 2026)
  const defaultCajasTerminales = [
    { caja: "Caja 4", rol: "Caja Principal Salón", tickets: 4106, monto: 472850120, pct: 38.3, ticket_promedio: 115160, estado: "AUDITADA_100_PCT" },
    { caja: "Caja 5", rol: "Caja Rápida / Autoservicio", tickets: 4480, monto: 455950036, pct: 36.9, ticket_promedio: 101774, estado: "AUDITADA_100_PCT" },
    { caja: "Caja 3", rol: "Caja Salón 1 (Atención General)", tickets: 2732, monto: 249999917, pct: 20.3, ticket_promedio: 91508, estado: "AUDITADA_100_PCT" },
    { caja: "Caja 2", rol: "Caja Salón 2 (Refuerzo)", tickets: 656, monto: 60153506, pct: 4.9, ticket_promedio: 91697, estado: "AUDITADA_100_PCT" },
    { caja: "Caja 8", rol: "Caja Mayorista / Despacho", tickets: 449, monto: 43304537, pct: 3.5, ticket_promedio: 96446, estado: "AUDITADA_100_PCT" },
    { caja: "Caja 7", rol: "Caja Rotisería y Respaldo", tickets: 39, monto: 4193290, pct: 0.3, ticket_promedio: 107520, estado: "AUDITADA_100_PCT" }
  ]

  const rawCajas = closingData?.ingresos?.cajas_terminales
  const cajasTerminales = (rawCajas && rawCajas.length > 0)
    ? rawCajas.map((c: any) => ({
        caja: c.caja,
        rol: c.rol || "Punto de Venta Salón",
        tickets: c.tickets_auditados != null ? c.tickets_auditados : (c.tickets || 0),
        monto: c.volumen_facturado != null ? c.volumen_facturado : (c.monto || 0),
        pct: c.pct_participacion != null ? c.pct_participacion : (c.pct || 0),
        ticket_promedio: c.ticket_promedio || 0,
        estado: c.estado || "AUDITADA_100_PCT"
      }))
    : defaultCajasTerminales

  // Métricas dinámicas de ingresos
  const totalVentasNetas = closingData?.kpis?.ventas_netas || closingData?.ingresos?.total_ventas_netas || 0
  const totalTickets = closingData?.kpis?.tickets_auditados || closingData?.ingresos?.resumen_mensual?.total_tickets_auditados || 0
  const ticketPromedioGeneral = closingData?.kpis?.ticket_promedio || closingData?.ingresos?.resumen_mensual?.ticket_promedio_general || 0

  // Datos de CMV
  const cogsData = closingData?.cogs
  const cmvComercial = cogsData?.cmv_mercaderias || 0
  const cmvMateriaPrima = cogsData?.cmv_materia_prima_panaderia || 0
  const ncAcuerdos = cogsData?.nc_acuerdos_proveedores || 0
  const totalCmv = cogsData?.total_cmv || (cmvComercial + cmvMateriaPrima - ncAcuerdos)
  const utilidadBruta = closingData?.kpis?.utilidad_bruta || (totalVentasNetas - totalCmv)
  const margenBrutoPct = closingData?.kpis?.margen_bruto_pct || (totalVentasNetas > 0 ? ((utilidadBruta / totalVentasNetas) * 100) : 0)

  const cogsBreakdown = [
    {
      concepto: "Mercaderías para Reventa en Salón",
      clasificacion: "Comercial / Reventa Directa",
      base: "Costo Promedio Ponderado de ventas registradas en POS",
      monto: cmvComercial,
      pct_ventas: totalVentasNetas > 0 ? (cmvComercial / totalVentasNetas) * 100 : 0,
      badge: "Reventa Salón",
      badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
    },
    {
      concepto: "Materias Primas Panadería y Rotisería (Harinas, Insumos)",
      clasificacion: "Producción Propia",
      base: "Facturas y egresos imputados a CMV Materia Prima con split por sector",
      monto: cmvMateriaPrima,
      pct_ventas: totalVentasNetas > 0 ? (cmvMateriaPrima / totalVentasNetas) * 100 : 0,
      badge: "Producción Propia",
      badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
    },
    {
      concepto: "(-) Deducción de Acuerdos Comerciales y Notas de Crédito de Proveedores",
      clasificacion: "Acuerdos Comerciales & Notas de Crédito",
      base: "Notas de Crédito de proveedores auditadas e imputadas a menor costo",
      monto: -ncAcuerdos,
      pct_ventas: totalVentasNetas > 0 ? -(ncAcuerdos / totalVentasNetas) * 100 : 0,
      badge: "Acuerdos Comerciales",
      badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
    }
  ]

  // Materias primas de producción (100% dinámicas desde la base de datos)
  const materiaPrimaPanaderia = mpItems

  // Gastos OPEX / CAPEX / Anticipos reales devueltos por el API
  const sourceExpenses: any[] = remoteItems || []

  // Agrupación contable por Familia de Gasto OPEX
  const opexFamilies = useMemo(() => {
    const families: Record<string, { count: number; monto: number }> = {
      todas: { count: sourceExpenses.length, monto: sourceExpenses.reduce((s: number, g: any) => s + (Number(g.monto) || 0), 0) },
      ocupacion: { count: 0, monto: 0 },
      mantenimiento: { count: 0, monto: 0 },
      logistica: { count: 0, monto: 0 },
      administracion: { count: 0, monto: 0 }
    }
    sourceExpenses.forEach((g: any) => {
      const fam = g.categoria || "administracion"
      if (families[fam]) {
        families[fam].count += 1
        families[fam].monto += Number(g.monto) || 0
      } else {
        families.administracion.count += 1
        families.administracion.monto += Number(g.monto) || 0
      }
    })
    return families
  }, [sourceExpenses])

  const gastosFiltradosPorFamilia: any[] = useMemo(() => {
    if (familyFilter === "todas") return sourceExpenses
    return sourceExpenses.filter((g: any) => (g.categoria || "administracion") === familyFilter)
  }, [sourceExpenses, familyFilter])

  const uniqueCategories: string[] = useMemo(() => {
    return Array.from(new Set(gastosFiltradosPorFamilia.map((g: any) => g.categoria_nombre || g.rubro).filter(Boolean) as string[])).sort()
  }, [gastosFiltradosPorFamilia])

  const uniqueSectors: string[] = useMemo(() => {
    return Array.from(new Set(gastosFiltradosPorFamilia.map((g: any) => g.cost_center_nombre).filter(Boolean) as string[])).sort()
  }, [gastosFiltradosPorFamilia])

  const gastosFiltradosPorMagnitud: any[] = gastosFiltradosPorFamilia.filter((g: any) => {
    if (selectedCategoryFilter && (g.categoria_nombre || g.rubro) !== selectedCategoryFilter) return false
    if (selectedSectorFilter && (g.cost_center_nombre || "") !== selectedSectorFilter) return false
    return true
  })

  const gastosGenerales: any[] = gastosFiltradosPorMagnitud.filter((g: any) =>
    (g.proveedor || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (g.concepto || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (g.comp || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (g.categoria_nombre || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (g.cost_center_nombre || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (g.ruc || "").includes(searchTerm)
  )

  const monthNames = [
    "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ]
  const currentMonthName = monthNames[activeMonth] || `Mes ${activeMonth}`
  const monthLabel = `${currentMonthName} ${activeYear}`

  // Totales
  const totalNominaNeto = nominaData.reduce((acc, curr) => acc + curr.neto, 0)
  const totalNominaBruto = nominaData.reduce((acc, curr) => acc + curr.total_devengado, 0)
  const totalNominaIpsPatronal = nominaData.reduce((acc, curr) => acc + curr.ips_patronal, 0)
  const totalGastosMonto = gastosGenerales.reduce((acc: number, curr: any) => acc + (Number(curr.monto) || 0), 0)

  const titleMap: Record<string, { title: string; subtitle: string; icon: any }> = {
    nomina: {
      title: `4. Nómina y Costo Laboral SueldOK (${monthLabel})`,
      subtitle: `${nominaData.length} Colaboradores: Salarios base, IPS Obrero (9%), Vales y Neto a cobrar. Provisión de Aguinaldo (1/12) se acumula en Pasivo Diferido.`,
      icon: Users
    },
    ingresos: {
      title: `2. Cajas / Ingresos — Canales de Cobro y Terminales POS (${monthLabel})`,
      subtitle: `${totalTickets.toLocaleString()} tickets auditados con trazabilidad por medio de pago y cuadratura fiscal`,
      icon: DollarSign
    },
    cogs: {
      title: `3. CMV / Compras — Costo de Mercaderías Vendidas y Producción (${monthLabel})`,
      subtitle: `Mercaderías comerciales de reventa y compras de materias primas segregadas de OPEX`,
      icon: ShoppingBag
    },
    opex: {
      title: `5. Gastos Operativos Generales (No Laborales) (${monthLabel})`,
      subtitle: `Servicios básicos, mantenimiento, logística y administración que deducen el EBITDA (excluye nómina de Pestaña 4). Total: ${formatPYG(totalGastosMonto)}.`,
      icon: Building2
    },
    gastos: {
      title: `5. Gastos Operativos Generales (No Laborales) (${monthLabel})`,
      subtitle: `Servicios básicos, mantenimiento, logística y administración que deducen el EBITDA (excluye nómina de Pestaña 4). Total: ${formatPYG(totalGastosMonto)}.`,
      icon: Building2
    },
    capex: {
      title: `6. Inversiones y Activos Fijos (CAPEX) (${monthLabel})`,
      subtitle: `Equipamiento, maquinarias de producción, rodados y obras. Inversiones de balance que NO deducen el EBITDA ni el flujo mensual.`,
      icon: Layers
    },
    inversiones: {
      title: `6. Inversiones y Activos Fijos (CAPEX) (${monthLabel})`,
      subtitle: `Equipamiento, maquinarias de producción, rodados y obras. Inversiones de balance que NO deducen el EBITDA ni el flujo mensual.`,
      icon: Layers
    },
    anticipos: {
      title: `7. Anticipos al Personal y Pasivos No Operativos (${monthLabel})`,
      subtitle: `Desembolsos transitorios (adelantos de salario o pagos de deudas de ejercicios anteriores). Excluidos del Estado de Resultados P&L.`,
      icon: Landmark
    }
  }

  const currentMeta = titleMap[magnitude] || {
    title: `Detalle Analítico por Magnitud (${monthLabel})`,
    subtitle: "Comprobantes registrados en base de datos con trazabilidad financiera",
    icon: FileText
  }
  const Icon = currentMeta.icon

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* 🧭 BARRA SUPERIOR CON NAVEGACIÓN Y ACCIONES */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToPnl}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Volver al Resumen P&L
          </button>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              {currentMeta.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {currentMeta.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={fetchDetails}
            disabled={loading}
            title="Recargar comprobantes"
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-500" : ""}`} />
          </button>

          {magnitude !== "ingresos" && (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={magnitude === "nomina" ? "Buscar por nombre, CI o cargo..." : "Buscar proveedor, categoría, concepto o factura..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64 shadow-sm"
              />
            </div>
          )}

          <button
            onClick={onExportExcel}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" /> Exportar Excel
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* VISTA 1: CAJAS E INGRESOS                                           */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {magnitude === "ingresos" && (
        <div className="p-6 space-y-6">
          {/* Tarjetas KPI de Cajas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50/60 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-200/60 dark:border-blue-900/40">
              <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block">Ventas Netas Totales</span>
              <p className="text-2xl font-black font-mono text-blue-900 dark:text-blue-200 mt-1">{formatPYG(totalVentasNetas)}</p>
              <p className="text-[11px] text-blue-600/80 dark:text-blue-400/80 mt-0.5">100% ingresos certificados de salón</p>
            </div>

            <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40">
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Tickets Auditados</span>
              <p className="text-2xl font-black font-mono text-emerald-900 dark:text-emerald-200 mt-1">{totalTickets.toLocaleString()}</p>
              <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Comprobantes emitidos en salón</p>
            </div>

            <div className="bg-indigo-50/60 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-200/60 dark:border-indigo-900/40">
              <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider block">Ticket Promedio</span>
              <p className="text-2xl font-black font-mono text-indigo-900 dark:text-indigo-200 mt-1">{formatPYG(ticketPromedioGeneral)}</p>
              <p className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80 mt-0.5">Por transacción de compra en caja</p>
            </div>

            <div className="bg-amber-50/60 dark:bg-amber-950/20 p-4 rounded-2xl border border-amber-200/60 dark:border-amber-900/40">
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">Terminales Operativas</span>
              <p className="text-2xl font-black font-mono text-amber-900 dark:text-amber-200 mt-1">{cajasTerminales.length} Cajas</p>
              <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">Terminales con facturación activa</p>
            </div>
          </div>

          {/* Tabla 1: Canales de Cobro */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Desglose por Canal de Cobro y Medio de Pago ({monthLabel})
                </h4>
                <p className="text-xs text-slate-500">Conciliación de pagos entre Bóveda Central, POS Bancard/Dinelco, QR, PIX y Extra Club</p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                Total: <strong className="text-indigo-600 dark:text-indigo-400">{formatPYG(totalVentasNetas)}</strong>
              </span>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/60 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Canal / Medio de Pago</th>
                    <th className="py-3 px-4">Descripción Operativa</th>
                    <th className="py-3 px-4 text-center">Tickets</th>
                    <th className="py-3 px-4 text-right">Total Cobrado (₲)</th>
                    <th className="py-3 px-4 text-right">% s/ Ventas</th>
                    <th className="py-3 px-4 w-36">Participación Visual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {canalesCobro.map((c: any) => {
                    const ChannelIcon = c.icon
                    return (
                      <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              <ChannelIcon className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span>{c.nombre}</span>
                              <span className={`ml-2 px-1.5 py-0.2 rounded text-[10px] font-bold border ${c.badgeColor}`}>
                                {c.badge}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-sm">{c.subtexto}</td>
                        <td className="py-3 px-4 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">
                          {c.tickets.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-black font-mono text-slate-900 dark:text-slate-100">
                          {formatPYG(c.monto)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                          {Number(c.pct || 0).toFixed(2)}%
                        </td>
                        <td className="py-3 px-4">
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div className={`h-full ${c.barColor} rounded-full`} style={{ width: `${Math.min(100, Math.max(0, c.pct))}%` }} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-slate-50/80 dark:bg-slate-950/80 font-black text-xs border-t border-slate-200 dark:border-slate-800">
                  <tr>
                    <td className="py-3 px-4" colSpan={2}>TOTAL VENTAS NETAS CONCILIADAS</td>
                    <td className="py-3 px-4 text-center font-mono">{totalTickets.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-mono text-indigo-600 dark:text-indigo-400 text-sm">
                      {formatPYG(totalVentasNetas)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">100.00%</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Tabla 2: Facturación por Caja */}
          <div className="space-y-3 pt-2">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Facturación Auditada por Caja / Terminal POS ({monthLabel})
              </h4>
              <p className="text-xs text-slate-500">Distribución de carga operativa y comprobantes fiscales por punto de emisión en salón</p>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/60 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Terminal de Cobro</th>
                    <th className="py-3 px-4">Rol Operativo</th>
                    <th className="py-3 px-4 text-center">Tickets Auditados</th>
                    <th className="py-3 px-4 text-right">Volumen Facturado (₲)</th>
                    <th className="py-3 px-4 text-right">Ticket Promedio</th>
                    <th className="py-3 px-4 text-right">% Participación</th>
                    <th className="py-3 px-4 text-center">Estado de Cuadratura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {cajasTerminales.map((c: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4 font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        {c.caja}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{c.rol}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                        {c.tickets.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-black font-mono text-slate-900 dark:text-slate-100">
                        {formatPYG(c.monto)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                        {formatPYG(c.ticket_promedio)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                        {Number(c.pct || 0).toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Arqueo Cuadrado
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

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* VISTA 2: CMV / COMPRAS                                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {magnitude === "cogs" && (
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-rose-50/60 dark:bg-rose-950/20 p-4 rounded-2xl border border-rose-200/60 dark:border-rose-900/40">
              <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block">CMV Total Devengado Neto</span>
              <p className="text-xl font-black font-mono text-rose-900 dark:text-rose-200 mt-1">{formatPYG(totalCmv)}</p>
              <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">
                {totalVentasNetas > 0 ? ((totalCmv / totalVentasNetas) * 100).toFixed(2) : "0.00"}% sobre Ventas Netas
              </p>
            </div>

            <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40">
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Utilidad Bruta Real</span>
              <p className="text-xl font-black font-mono text-emerald-900 dark:text-emerald-200 mt-1">{formatPYG(utilidadBruta)}</p>
              <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Margen Bruto: {margenBrutoPct.toFixed(2)}%</p>
            </div>

            <div className="bg-blue-50/60 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-200/60 dark:border-blue-900/40">
              <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block">Reventa Comercial Salón</span>
              <p className="text-xl font-black font-mono text-blue-900 dark:text-blue-200 mt-1">{formatPYG(cmvComercial)}</p>
              <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 mt-0.5">
                {totalVentasNetas > 0 ? ((cmvComercial / totalVentasNetas) * 100).toFixed(2) : "0.00"}% sobre Ventas
              </p>
            </div>

            <div className="bg-amber-50/60 dark:bg-amber-950/20 p-4 rounded-2xl border border-amber-200/60 dark:border-amber-900/40">
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">Materia Prima Panadería</span>
              <p className="text-xl font-black font-mono text-amber-900 dark:text-amber-200 mt-1">{formatPYG(cmvMateriaPrima)}</p>
              <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">{materiaPrimaPanaderia.length} compras de insumos</p>
            </div>

            <div className="bg-teal-50/60 dark:bg-teal-950/20 p-4 rounded-2xl border border-teal-200/60 dark:border-teal-900/40">
              <span className="text-[10px] font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider block">(-) Acuerdos Comerciales / NC</span>
              <p className="text-xl font-black font-mono text-teal-800 dark:text-teal-200 mt-1">-{formatPYG(ncAcuerdos)}</p>
              <p className="text-[10px] text-teal-600/80 dark:text-teal-400/80 mt-0.5">{ncItems.length || 0} NCs devengadas</p>
            </div>
          </div>

          {/* TABLA 1: ESTRUCTURA P&L */}
          <div className="space-y-3">
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Estructura Contable del Costo de Ventas (P&L - {monthLabel})
            </h4>
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/60 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Componente del Costo</th>
                    <th className="py-3 px-4">Clasificación Contable</th>
                    <th className="py-3 px-4">Base de Asignación</th>
                    <th className="py-3 px-4 text-right">Costo Devengado (₲)</th>
                    <th className="py-3 px-4 text-right">% s/ Ventas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {cogsBreakdown.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>{row.concepto}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.badgeColor}`}>
                          {row.badge}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{row.clasificacion}</td>
                      <td className="py-3 px-4 text-slate-500 max-w-sm">{row.base}</td>
                      <td className={`py-3 px-4 text-right font-black font-mono ${row.monto < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-slate-100"}`}>
                        {row.monto < 0 ? `-${formatPYG(Math.abs(row.monto))}` : formatPYG(row.monto)}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-bold ${row.pct_ventas < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"}`}>
                        {row.pct_ventas.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50/80 dark:bg-slate-950/80 font-black text-xs border-t border-slate-200 dark:border-slate-800">
                  <tr>
                    <td className="py-3 px-4" colSpan={3}>TOTAL COSTO DE MERCADERÍAS VENDIDAS NETO (CMV)</td>
                    <td className="py-3 px-4 text-right font-mono text-rose-600 dark:text-rose-400 text-sm">
                      {formatPYG(totalCmv)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">{totalVentasNetas > 0 ? ((totalCmv / totalVentasNetas) * 100).toFixed(2) : "0.00"}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* TABLA 2: NOTAS DE CRÉDITO Y ACUERDOS COMERCIALES DE PROVEEDORES */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Notas de Crédito y Bonificaciones de Proveedores ({ncItems.length} NCs)
                </h4>
                <p className="text-xs text-slate-500">Créditos de proveedores por volumen, acciones comerciales y devoluciones imputadas a menor costo de mercaderías</p>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800">
                Total NCs: -{formatPYG(ncAcuerdos)}
              </span>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/60 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider sticky top-0 bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Nº Comprobante NC</th>
                    <th className="py-3 px-4">Factura Afectada</th>
                    <th className="py-3 px-4">Proveedor Comercial</th>
                    <th className="py-3 px-4">Motivo / Acuerdo</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4 text-right font-bold">Importe (₲)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ncItems
                    .filter(nc => (nc.proveedor || "").toLowerCase().includes(searchTerm.toLowerCase()) || (nc.comp || "").includes(searchTerm) || (nc.concepto || "").toLowerCase().includes(searchTerm.toLowerCase()))
                    .map((nc, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-2.5 px-4 text-slate-500 font-mono">{nc.fecha}</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">{nc.comp}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-400 text-[11px]">{nc.factura_afectada || "—"}</td>
                        <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">{nc.proveedor}</td>
                        <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 max-w-xs">{nc.concepto}</td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {nc.categoria || "Comercial"}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-black font-mono text-emerald-700 dark:text-emerald-400">
                          -{formatPYG(nc.monto)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* TABLA 3: MATERIAS PRIMAS PANADERÍA Y ROTISERÍA (CON ACCIÓN DE REDESTINAR / SPLIT) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  Materias Primas Panadería y Rotisería ({materiaPrimaPanaderia.length} comprobantes)
                </h4>
                <p className="text-xs text-slate-500">Facturas de insumos de producción imputadas al Costo de Ventas. Haz clic para redestinar o dividir entre sectores.</p>
              </div>
              <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-xl border border-amber-200 dark:border-amber-800">
                Total MP: {formatPYG(cmvMateriaPrima)}
              </span>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/60 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider sticky top-0 bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Comprobante</th>
                    <th className="py-3 px-4">Proveedor</th>
                    <th className="py-3 px-4">Área / Sector</th>
                    <th className="py-3 px-4">RUC</th>
                    <th className="py-3 px-4">Descripción de Insumos</th>
                    <th className="py-3 px-4 text-right font-bold">Importe (₲)</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {materiaPrimaPanaderia.length > 0 ? (
                    materiaPrimaPanaderia
                      .filter(m => (m.proveedor || "").toLowerCase().includes(searchTerm.toLowerCase()) || (m.comp || "").includes(searchTerm) || (m.concepto || "").toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((m, idx) => (
                        <tr
                          key={m.id || idx}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${m.id ? "cursor-pointer" : ""}`}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest("button")) return
                            if (m.id) setSelectedExpense(m)
                          }}
                        >
                          <td className="py-2.5 px-4 text-slate-500 font-mono">{m.fecha}</td>
                          <td className="py-2.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                            <div className="flex items-center gap-1.5">
                              <span>{m.comp}</span>
                              {m.has_split && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                                  <Split className="w-2.5 h-2.5" /> Split
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">{m.proveedor}</td>
                          <td className="py-2.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800 uppercase">
                              {m.production_area || m.cost_center_nombre || "Panadería"}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-500">{m.ruc}</td>
                          <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">{m.concepto || "Compra de Materia Prima"}</td>
                          <td className="py-2.5 px-4 text-right font-black font-mono text-slate-900 dark:text-slate-100">
                            {formatPYG(m.monto)}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            {m.id ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedExpense(m)
                                }}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 inline-flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                                title="Redestinar naturaleza o dividir por departamento"
                              >
                                <SlidersHorizontal className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                Redestinar
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                        <p className="font-bold text-xs text-slate-700 dark:text-slate-300">No hay materias primas imputadas en este período</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Puedes redestinar facturas de harina e insumos de producción desde la pestaña 5. Gastos Operativos (OPEX).</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* VISTA 3: NÓMINA SUELDOK (44 COLABORADORES)                          */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {magnitude === "nomina" && (
        <div>
          <div className="bg-indigo-50/50 dark:bg-indigo-950/20 px-6 py-3 border-b border-indigo-100 dark:border-indigo-900/50 flex flex-wrap justify-between items-center text-xs text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-4">
              <span className="font-semibold text-slate-600 dark:text-slate-400">
                Colaboradores SueldOK: <strong className="text-slate-900 dark:text-white">{nominaData.length}</strong>
              </span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="font-semibold text-slate-600 dark:text-slate-400">
                Masa Salarial Bruta: <strong className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{formatPYG(totalNominaBruto)}</strong>
              </span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="font-semibold text-slate-600 dark:text-slate-400">
                Líquido a Cobrar: <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{formatPYG(totalNominaNeto)}</strong>
              </span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="font-semibold text-slate-600 dark:text-slate-400">
                IPS Patronal (16.5%): <strong className="font-mono text-amber-600 dark:text-amber-400 font-bold">{formatPYG(totalNominaIpsPatronal)}</strong>
              </span>
            </div>
          </div>

          <div className="bg-amber-50/60 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900/40 px-6 py-2.5 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              <strong>Tratamiento Contable:</strong> La provisión de Aguinaldo (1/12) se acumula contablemente en cuenta de Pasivo Diferido hacia Diciembre y <strong>no se deduce del flujo operativo ni del EBITDA</strong> (al no constituir desembolso efectivo en el período).
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">C.I. Nº</th>
                  <th className="py-3 px-4">Colaborador</th>
                  <th className="py-3 px-4">Cargo / Sector Oficial</th>
                  <th className="py-3 px-4 text-right">Salario Base</th>
                  <th className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">Devengado Bruto</th>
                  <th className="py-3 px-4 text-right text-rose-600">IPS Obrero (9%)</th>
                  <th className="py-3 px-4 text-right text-amber-700 dark:text-amber-500">Anticipos / Vales</th>
                  <th className="py-3 px-4 text-right text-emerald-700 dark:text-emerald-400 font-bold">Neto a Cobrar</th>
                  <th className="py-3 px-4 text-right font-bold text-amber-600">IPS Patronal (16.5%)</th>
                  <th className="py-3 px-4 text-right text-indigo-600">Aguinaldo Provisión (Diferido Dic)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {nominaData
                  .filter(e => e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || e.ci.includes(searchTerm) || e.cargo.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((emp, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4 text-slate-500 font-mono">{emp.ci}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">{emp.nombre}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{emp.cargo}</span>
                        <span className="text-[11px] text-slate-400 block">{emp.dpto}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono">{formatPYG(emp.salario_base)}</td>
                      <td className="py-3 px-4 text-right font-black font-mono text-slate-900 dark:text-slate-100">{formatPYG(emp.total_devengado)}</td>
                      <td className="py-3 px-4 text-right text-rose-600 font-mono">{emp.ips_obrero > 0 ? `-${formatPYG(emp.ips_obrero)}` : "₲ 0"}</td>
                      <td className="py-3 px-4 text-right text-amber-700 dark:text-amber-500 font-mono">{emp.anticipos > 0 ? `-${formatPYG(emp.anticipos)}` : "₲ 0"}</td>
                      <td className="py-3 px-4 text-right font-black font-mono text-emerald-700 dark:text-emerald-400">{formatPYG(emp.neto)}</td>
                      <td className="py-3 px-4 text-right font-bold text-amber-600 font-mono">{formatPYG(emp.ips_patronal)}</td>
                      <td className="py-3 px-4 text-right text-indigo-600 font-mono">{formatPYG(emp.aguinaldo_provisional)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* VISTA 4: COMPROBANTES DE OPEX / CAPEX / ANTICIPOS (CON REDESTINAR) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {magnitude !== "nomina" && magnitude !== "ingresos" && magnitude !== "cogs" && (
        <div>
          {/* Sub-pestañas de Familias de Gasto Canónicas del Supermercado (Ocupación, Mantenimiento, Logística, Administración) */}
          {(magnitude === "opex" || magnitude === "gastos") && (
            <div className="bg-slate-100 dark:bg-slate-900/60 p-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-2 items-center">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 pl-2">
                Familias de Gasto:
              </span>
              <button
                type="button"
                onClick={() => { setFamilyFilter("todas"); setSelectedCategoryFilter(""); setSelectedSectorFilter(""); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  familyFilter === "todas"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700"
                }`}
              >
                <span>Todos los Gastos</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 text-white font-mono">{opexFamilies.todas.count}</span>
              </button>

              <button
                type="button"
                onClick={() => { setFamilyFilter("ocupacion"); setSelectedCategoryFilter(""); setSelectedSectorFilter(""); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  familyFilter === "ocupacion"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700"
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                <span>Ocupación & Servicios</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 text-white font-mono">{opexFamilies.ocupacion.count}</span>
              </button>

              <button
                type="button"
                onClick={() => { setFamilyFilter("mantenimiento"); setSelectedCategoryFilter(""); setSelectedSectorFilter(""); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  familyFilter === "mantenimiento"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700"
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Mantenimiento & Infraestructura</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 text-white font-mono">{opexFamilies.mantenimiento.count}</span>
              </button>

              <button
                type="button"
                onClick={() => { setFamilyFilter("logistica"); setSelectedCategoryFilter(""); setSelectedSectorFilter(""); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  familyFilter === "logistica"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700"
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Logística & Insumos</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 text-white font-mono">{opexFamilies.logistica.count}</span>
              </button>

              <button
                type="button"
                onClick={() => { setFamilyFilter("administracion"); setSelectedCategoryFilter(""); setSelectedSectorFilter(""); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  familyFilter === "administracion"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700"
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Administración & Gestión</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 text-white font-mono">{opexFamilies.administracion.count}</span>
              </button>
            </div>
          )}

          <div className="bg-indigo-50/50 dark:bg-indigo-950/20 px-6 py-3.5 border-b border-indigo-100 dark:border-indigo-900/50 flex flex-wrap justify-between items-center gap-4 text-xs text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="font-semibold text-slate-600 dark:text-slate-400">
                Comprobantes listados: <strong className="text-slate-900 dark:text-white">{gastosGenerales.length}</strong>
              </span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="font-semibold text-slate-600 dark:text-slate-400">
                Total devengado: <strong className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{formatPYG(totalGastosMonto)}</strong>
              </span>
            </div>

            {/* Filtros dinámicos por Categoría del Plan de Cuentas y Sector */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer shadow-xs max-w-xs truncate"
              >
                <option value="">Todas las Categorías ({uniqueCategories.length})</option>
                {uniqueCategories.map((c: string) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={selectedSectorFilter}
                onChange={(e) => setSelectedSectorFilter(e.target.value)}
                className="text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer shadow-xs max-w-xs truncate"
              >
                <option value="">Todos los Sectores ({uniqueSectors.length})</option>
                {uniqueSectors.map((s: string) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              {(selectedCategoryFilter || selectedSectorFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategoryFilter("")
                    setSelectedSectorFilter("")
                  }}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                >
                  Limpiar filtros
                </button>
              )}

              {/* Botones de Hoja de Punteo y Verificación Física */}
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={handleDownloadAuditPdf}
                  disabled={downloadingAuditPdf}
                  title="Descargar Hoja de Punteo y Verificación Física en PDF (Landscape) para cotejo manual con bolígrafo"
                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-xs"
                >
                  <FileText className={`w-3.5 h-3.5 text-indigo-400 ${downloadingAuditPdf ? "animate-spin" : ""}`} />
                  {downloadingAuditPdf ? "Generando..." : "Hoja Punteo Físico (PDF)"}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadAuditXlsx}
                  disabled={downloadingAuditXlsx}
                  title="Descargar Hoja de Punteo en Excel con fórmulas y filtros"
                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 border border-emerald-300 dark:border-emerald-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-xs"
                >
                  <Download className={`w-3.5 h-3.5 text-emerald-600 ${downloadingAuditXlsx ? "animate-spin" : ""}`} />
                  {downloadingAuditXlsx ? "..." : "Punteo (.xlsx)"}
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Comprobante</th>
                  <th className="py-3 px-4">Proveedor / Entidad</th>
                  <th className="py-3 px-4">RUC</th>
                  <th className="py-3 px-4">Categoría (Plan de Cuentas)</th>
                  <th className="py-3 px-4">Sector / Departamento</th>
                  <th className="py-3 px-4">Descripción</th>
                  <th className="py-3 px-4 text-right font-bold">Importe (₲)</th>
                  <th className="py-3 px-4 text-center">Naturaleza</th>
                  <th className="py-3 px-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {gastosGenerales.length > 0 ? (
                  gastosGenerales.map((g: any, idx: number) => (
                    <tr
                      key={g.id || idx}
                      className={`hover:bg-indigo-50/50 dark:hover:bg-slate-800/60 transition-colors ${
                        g.id ? "cursor-pointer" : ""
                      }`}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("button")) return
                        if (g.id) setSelectedExpense(g)
                      }}
                    >
                      <td className="py-3 px-4 text-slate-500 font-mono whitespace-nowrap">{g.fecha}</td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <span>{g.comp}</span>
                          {g.has_split && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                              <Split className="w-2.5 h-2.5" /> Split
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">{g.proveedor}</td>
                      <td className="py-3 px-4 text-slate-500 font-mono whitespace-nowrap">{g.ruc}</td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 dark:text-slate-100 block">
                          {g.categoria_nombre || g.rubro || "Gasto General"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 block">
                          {g.cost_center_nombre || "Sin Sector"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 max-w-xs truncate" title={g.concepto}>{g.concepto}</td>
                      <td className="py-3 px-4 text-right font-black font-mono text-slate-900 dark:text-slate-100 whitespace-nowrap">{formatPYG(g.monto)}</td>
                      <td className="py-3 px-4 text-center">
                        {g.has_split ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300">
                            SPLIT ({g.allocations?.length || 2})
                          </span>
                        ) : g.es_inversion ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300">
                            CAPEX
                          </span>
                        ) : g.naturaleza_economica === "CMV_MATERIA_PRIMA" || g.naturaleza_economica === "CMV_REVENTA" ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                            CMV
                          </span>
                        ) : g.naturaleza_economica === "ANTICIPO_PERSONAL" ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300">
                            ANTICIPO
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-300">
                            OPEX
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {g.id ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedExpense(g)
                            }}
                            className="px-2.5 py-1 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs inline-flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <SlidersHorizontal className="w-3 h-3" />
                            Redestinar
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      No se encontraron comprobantes para esta categoría o criterio de búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 🚀 MODAL INTERACTIVO DE REDESTINACIÓN Y SPLIT DE COMPROBANTES */}
      {selectedExpense && (
        <ReclassifyExpenseModal
          isOpen={!!selectedExpense}
          item={selectedExpense}
          onClose={() => setSelectedExpense(null)}
          onSaved={(newNat: string, expId: string) => {
            setSelectedExpense(null)
            // Salida inmediata optimista de la tabla actual para retroalimentación instantánea
            if (magnitude === "opex" || magnitude === "gastos") {
              if (newNat !== "OPEX_GASTO_OPERATIVO" && newNat !== "GASTO_DIFERIDO_CUOTAS") {
                setRemoteItems((prev) => (prev ? prev.filter((x) => x.id !== expId) : []))
              }
            } else if (magnitude === "cogs") {
              if (newNat !== "CMV_MATERIA_PRIMA" && newNat !== "CMV_REVENTA") {
                setMpItems((prev) => prev.filter((x) => x.id !== expId))
              }
            }
            fetchDetails()
            if (onDataUpdated) onDataUpdated()
          }}
        />
      )}
    </div>
  )
}
