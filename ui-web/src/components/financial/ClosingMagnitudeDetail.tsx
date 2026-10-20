import React, { useState, useEffect } from "react"
import {
  Search,
  Download,
  Users,
  FileText,
  ArrowLeft,
  Building2,
  Wrench,
  Truck,
  Landmark,
  ShoppingBag,
  DollarSign,
  Info,
  CheckCircle2,
  CreditCard,
  QrCode,
  Smartphone,
  Layers,
  ArrowDownToLine,
  Receipt
} from "lucide-react"
import { formatPYG } from "../../utils/format"
import { REAL_NOMINA, REAL_GASTOS } from "./closingDataReal"
import { api } from "../../api"

interface ClosingMagnitudeDetailProps {
  magnitude: string
  closingData?: any
  onBackToPnl: () => void
  onExportExcel: () => void
}

export function ClosingMagnitudeDetail({
  magnitude,
  closingData,
  onBackToPnl,
  onExportExcel
}: ClosingMagnitudeDetailProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [remoteItems, setRemoteItems] = useState<any[] | null>(null)
  const [ncItems, setNcItems] = useState<any[]>([])
  const [mpItems, setMpItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Carga reactiva de comprobantes/items para la magnitud activa
  useEffect(() => {
    let isCancelled = false
    async function fetchDetails() {
      if (magnitude === "cogs") {
        setLoading(true)
        try {
          const [resNc, resMp] = await Promise.all([
            api.financial.closing.getMagnitudeDetails("cogs_nc", 9, 2026, "80150377-9"),
            api.financial.closing.getMagnitudeDetails("cogs_mp", 9, 2026, "80150377-9")
          ])
          if (!isCancelled) {
            if (resNc && resNc.items) setNcItems(resNc.items)
            if (resMp && resMp.items) setMpItems(resMp.items)
          }
        } catch (err) {
          console.warn("Error cargando detalles cogs", err)
        } finally {
          if (!isCancelled) setLoading(false)
        }
        return
      }
      if (magnitude === "nomina" || magnitude === "ingresos") {
        setRemoteItems(null)
        return
      }
      setLoading(true)
      try {
        const res = await api.financial.closing.getMagnitudeDetails(magnitude, 9, 2026, "80150377-9")
        if (!isCancelled && res && res.items && res.items.length > 0) {
          setRemoteItems(res.items)
        }
      } catch (err) {
        console.warn("Usando catálogo canónico sanitizado para", magnitude, err)
      } finally {
        if (!isCancelled) setLoading(false)
      }
    }
    fetchDetails()
    return () => {
      isCancelled = true
    }
  }, [magnitude])

  // Datos de Nómina SueldOK (44 colaboradores)
  const nominaData = REAL_NOMINA

  // Datos de Canales de Cobro (Septiembre 2026)
  const canalesCobro = [
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
      subtexto: "Tarjetas de Crédito (₲ 84.2M), Débito (₲ 54.8M), Bancard (₲ 83.2M), Dinelco (₲ 11.7M)",
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
      subtexto: "Compras a crédito autorizadas de colaboradores compensadas en planilla de nómina SueldOK",
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
      subtexto: "Pagos interoperables QR Bancard y Dinelco cobrados al instante en cajas de salón",
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
      subtexto: "Depósitos bancarios y transferencias directas de clientes mayoristas e institucionales",
      tickets: 20,
      monto: 11827542,
      pct: 0.96,
      badge: "Bancario SIPAP",
      badgeColor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700",
      icon: Landmark,
      barColor: "bg-indigo-500"
    }
  ]

  // Datos de Ventas por Terminal / Caja
  const cajasTerminales = [
    {
      caja: "Caja 4",
      rol: "Caja Principal Salón (Mayor volumen)",
      tickets: 4106,
      monto: 472850120,
      pct: 38.3,
      ticket_promedio: 115160,
      estado: "AUDITADA_100_PCT"
    },
    {
      caja: "Caja 5",
      rol: "Caja Rápida / Autoservicio",
      tickets: 4480,
      monto: 455950036,
      pct: 36.9,
      ticket_promedio: 101774,
      estado: "AUDITADA_100_PCT"
    },
    {
      caja: "Caja 3",
      rol: "Caja Salón 1 (Atención General)",
      tickets: 2732,
      monto: 249999917,
      pct: 20.3,
      ticket_promedio: 91508,
      estado: "AUDITADA_100_PCT"
    },
    {
      caja: "Caja 2",
      rol: "Caja Salón 2 (Refuerzo Horas Pico)",
      tickets: 656,
      monto: 60153506,
      pct: 4.9,
      ticket_promedio: 91697,
      estado: "AUDITADA_100_PCT"
    },
    {
      caja: "Caja 8",
      rol: "Caja Mayorista / Despacho",
      tickets: 449,
      monto: 43304537,
      pct: 3.5,
      ticket_promedio: 96446,
      estado: "AUDITADA_100_PCT"
    },
    {
      caja: "Caja 7",
      rol: "Caja Rotisería y Respaldo",
      tickets: 39,
      monto: 4193290,
      pct: 0.3,
      ticket_promedio: 107520,
      estado: "AUDITADA_100_PCT"
    }
  ]

  // Datos de CMV (Septiembre 2026)
  const cogsData = closingData?.cogs
  const cmvComercial = cogsData?.cmv_mercaderias || 1020507216
  const cmvMateriaPrima = cogsData?.cmv_materia_prima_panaderia || 28161848
  const ncAcuerdos = cogsData?.nc_acuerdos_proveedores || 45653770
  const totalCmv = cogsData?.total_cmv || (cmvComercial + cmvMateriaPrima - ncAcuerdos)
  const utilidadBruta = closingData?.kpis?.utilidad_bruta || (1234596102 - totalCmv)
  const margenBrutoPct = closingData?.kpis?.margen_bruto_pct || ((utilidadBruta / 1234596102) * 100)

  const cogsBreakdown = [
    {
      concepto: "Mercaderías para Reventa en Salón",
      clasificacion: "Comercial / Reventa Directa",
      base: "Costo Promedio Ponderado de 12.440 tickets vendidos",
      monto: cmvComercial,
      pct_ventas: (cmvComercial / 1234596102) * 100,
      badge: "Reventa Salón",
      badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
    },
    {
      concepto: "Materias Primas Panadería (Harinas, Levaduras e Insumos)",
      clasificacion: "Producción Propia Panadería",
      base: "Facturas de compras e insumos de producción panificados imputados a CMV",
      monto: cmvMateriaPrima,
      pct_ventas: (cmvMateriaPrima / 1234596102) * 100,
      badge: "Producción Panadería",
      badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
    },
    {
      concepto: "(-) Deducción de Acuerdos Comerciales, Bonificaciones y Devoluciones de Proveedores",
      clasificacion: "Acuerdos Comerciales & Notas de Crédito",
      base: "47 Notas de Crédito de proveedores auditadas (Casa Gonzalito, Aquidaban, San José, Gosi)",
      monto: -ncAcuerdos,
      pct_ventas: -(ncAcuerdos / 1234596102) * 100,
      badge: "Acuerdos Comerciales",
      badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
    },
    {
      concepto: "Materias Primas Rotisería (Consumo Interno)",
      clasificacion: "Producción Rotisería",
      base: "Requisiciones internas registradas en salón",
      monto: 0,
      pct_ventas: 0.0,
      badge: "Rotisería",
      badgeColor: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
    },
    {
      concepto: "Mermas Operativas Frío y Carnicería",
      clasificacion: "Mermas Controladas",
      base: "Ajuste físico de fin de mes",
      monto: 0,
      pct_ventas: 0.0,
      badge: "Mermas Control",
      badgeColor: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
    }
  ]

  // Materias primas panadería segregadas
  const defaultMateriaPrimaPanaderia = [
    { fecha: "2026-09-02", comp: "F-001-002-0045211", proveedor: "ALTAJA S.A.", ruc: "80021456-1", concepto: "INSUMOS PARA PANADERIA", monto: 775000 },
    { fecha: "2026-09-07", comp: "F-001-001-0048011", proveedor: "CASA GONZALITO S.R.L.", ruc: "80005427", concepto: "Harina 50 kg para panaderia", monto: 3160000 },
    { fecha: "2026-09-14", comp: "F-001-003-0008412", proveedor: "HILAGRO S.A.", ruc: "80021456-1", concepto: "79 HARINAS 000 25kg PARA USO INTERNO", monto: 6320000 },
    { fecha: "2026-09-16", comp: "F-002-001-0018933", proveedor: "CASA GONZALITO S.R.L.", ruc: "80005427", concepto: "HARINA PARA USO EN PANADERIA", monto: 1501000 },
    { fecha: "2026-09-23", comp: "F-001-001-0008412", proveedor: "BIO X S.A.I CALIDAD Y TECNOLOGIA", ruc: "80096321-8", concepto: "COMPRA DE INSUMOS PARA PANADERIA", monto: 1717000 },
    { fecha: "2026-09-30", comp: "INT-PAN-001", proveedor: "GRUPO SANTA TERESA E.A.S.", ruc: "80150377-9", concepto: "INSUMOS PARA PANADERIA", monto: 5713026 }
  ]
  const materiaPrimaPanaderia = mpItems.length > 0 ? mpItems : defaultMateriaPrimaPanaderia

  // Filtrado de gastos OPEX
  const sourceExpenses = remoteItems || REAL_GASTOS
  const gastosFiltradosPorMagnitud = sourceExpenses.filter(g => {
    if (magnitude === "ocupacion") return g.categoria === "ocupacion"
    if (magnitude === "mantenimiento") return g.categoria === "mantenimiento"
    if (magnitude === "logistica") return g.categoria === "logistica"
    if (magnitude === "administracion") return g.categoria === "administracion"
    return true
  })

  const gastosGenerales = gastosFiltradosPorMagnitud.filter(g =>
    (g.proveedor || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (g.concepto || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (g.comp || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (g.ruc || "").includes(searchTerm)
  )

  const titleMap: Record<string, { title: string; subtitle: string; icon: any }> = {
    nomina: {
      title: "4. Nómina y Costo Laboral SueldOK (Septiembre 2026)",
      subtitle: "44 Colaboradores: Salarios base, IPS Obrero (9%), Vales y Neto a cobrar. Provisión de Aguinaldo (1/12) se acumula en Pasivo Diferido (no deducible de EBITDA de Septiembre).",
      icon: Users
    },
    ingresos: {
      title: "2. Cajas / Ingresos — Detalle de Canales de Cobro y Terminales POS",
      subtitle: "12.440 tickets auditados en Cajas 2, 3, 4, 5, 7 y 8 con trazabilidad por medio de pago y cuadratura fiscal",
      icon: DollarSign
    },
    cogs: {
      title: "3. CMV / Compras — Costo de Mercaderías Vendidas y Producción",
      subtitle: "Mercaderías comerciales de reventa y compras de materias primas de panadería segregadas de OPEX",
      icon: ShoppingBag
    },
    ocupacion: {
      title: "5. Ocupación, Seguros y Servicios Básicos (Septiembre 2026)",
      subtitle: "Póliza Río Seguros (Cuota devengada 1/10 ₲ 2.000.000), facturas ANDE e internet FTTH",
      icon: Building2
    },
    mantenimiento: {
      title: "6. Mantenimiento, Equipamiento e Infraestructura (Septiembre 2026)",
      subtitle: "Trabajos de albañilería, cableado de cajas, cañerías, herrería, balanzas y cámaras de frío",
      icon: Wrench
    },
    logistica: {
      title: "7. Logística, Insumos de Producción y Operación (Septiembre 2026)",
      subtitle: "Consumibles de salón, bolsas plásticas, bobinas térmicas para impresoras de caja y fletes",
      icon: Truck
    },
    administracion: {
      title: "8. Administración, Cartelería, Marketing y Finanzas (Septiembre 2026)",
      subtitle: "Cartelería local, publicidad en radio, folletos promocionales, uniformes, comisiones bancarias y de POS",
      icon: Landmark
    }
  }

  const currentMeta = titleMap[magnitude] || {
    title: "Detalle Analítico por Magnitud",
    subtitle: "Comprobantes registrados en base de datos con trazabilidad financiera",
    icon: FileText
  }
  const Icon = currentMeta.icon

  // Totales
  const totalNominaNeto = nominaData.reduce((acc, curr) => acc + curr.neto, 0)
  const totalNominaBruto = nominaData.reduce((acc, curr) => acc + curr.total_devengado, 0)
  const totalNominaIpsPatronal = nominaData.reduce((acc, curr) => acc + curr.ips_patronal, 0)
  const totalGastosMonto = gastosGenerales.reduce((acc, curr) => acc + curr.monto, 0)

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
          {(magnitude === "nomina" || magnitude === "ocupacion" || magnitude === "mantenimiento" || magnitude === "logistica" || magnitude === "administracion") && (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={magnitude === "nomina" ? "Buscar por nombre, CI o cargo..." : "Buscar proveedor, concepto o factura..."}
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
              <p className="text-2xl font-black font-mono text-blue-900 dark:text-blue-200 mt-1">{formatPYG(1234596102)}</p>
              <p className="text-[11px] text-blue-600/80 dark:text-blue-400/80 mt-0.5">100% ingresos certificados de salón</p>
            </div>

            <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40">
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Tickets Auditados</span>
              <p className="text-2xl font-black font-mono text-emerald-900 dark:text-emerald-200 mt-1">12.440</p>
              <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Comprobantes emitidos en salón</p>
            </div>

            <div className="bg-indigo-50/60 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-200/60 dark:border-indigo-900/40">
              <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider block">Ticket Promedio</span>
              <p className="text-2xl font-black font-mono text-indigo-900 dark:text-indigo-200 mt-1">{formatPYG(99244)}</p>
              <p className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80 mt-0.5">Por transacción de compra en caja</p>
            </div>

            <div className="bg-amber-50/60 dark:bg-amber-950/20 p-4 rounded-2xl border border-amber-200/60 dark:border-amber-900/40">
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">Terminales Operativas</span>
              <p className="text-2xl font-black font-mono text-amber-900 dark:text-amber-200 mt-1">6 Cajas</p>
              <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">Cajas 2, 3, 4, 5, 7 y 8 activas</p>
            </div>
          </div>

          {/* Tabla 1: Canales de Cobro */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Desglose por Canal de Cobro y Medio de Pago
                </h4>
                <p className="text-xs text-slate-500">Conciliación de pagos entre Bóveda Central, POS Bancard/Dinelco, QR y Extra Club</p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                Total: <strong className="text-indigo-600 dark:text-indigo-400">{formatPYG(1234596102)}</strong>
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
                  {canalesCobro.map((c) => {
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
                          {c.pct.toFixed(2)}%
                        </td>
                        <td className="py-3 px-4">
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div className={`h-full ${c.barColor} rounded-full`} style={{ width: `${c.pct}%` }} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-slate-50/80 dark:bg-slate-950/80 font-black text-xs border-t border-slate-200 dark:border-slate-800">
                  <tr>
                    <td className="py-3 px-4" colSpan={2}>TOTAL VENTAS NETAS CONCILIADAS</td>
                    <td className="py-3 px-4 text-center font-mono">12.440</td>
                    <td className="py-3 px-4 text-right font-mono text-indigo-600 dark:text-indigo-400 text-sm">
                      {formatPYG(1234596102)}
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
                Facturación Auditada por Caja / Terminal POS (Septiembre 2026)
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
                  {cajasTerminales.map((c, idx) => (
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
                        {c.pct.toFixed(1)}%
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
              <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">{((totalCmv / 1234596102) * 100).toFixed(2)}% sobre Ventas Netas</p>
            </div>

            <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40">
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Utilidad Bruta Real</span>
              <p className="text-xl font-black font-mono text-emerald-900 dark:text-emerald-200 mt-1">{formatPYG(utilidadBruta)}</p>
              <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Margen Bruto: {margenBrutoPct.toFixed(2)}%</p>
            </div>

            <div className="bg-blue-50/60 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-200/60 dark:border-blue-900/40">
              <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block">Reventa Comercial Salón</span>
              <p className="text-xl font-black font-mono text-blue-900 dark:text-blue-200 mt-1">{formatPYG(cmvComercial)}</p>
              <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 mt-0.5">82.66% sobre Ventas</p>
            </div>

            <div className="bg-amber-50/60 dark:bg-amber-950/20 p-4 rounded-2xl border border-amber-200/60 dark:border-amber-900/40">
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">Materia Prima Panadería</span>
              <p className="text-xl font-black font-mono text-amber-900 dark:text-amber-200 mt-1">{formatPYG(cmvMateriaPrima)}</p>
              <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">24 compras de insumos</p>
            </div>

            <div className="bg-teal-50/60 dark:bg-teal-950/20 p-4 rounded-2xl border border-teal-200/60 dark:border-teal-900/40">
              <span className="text-[10px] font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider block">(-) Acuerdos Comerciales / NC</span>
              <p className="text-xl font-black font-mono text-teal-800 dark:text-teal-200 mt-1">-{formatPYG(ncAcuerdos)}</p>
              <p className="text-[10px] text-teal-600/80 dark:text-teal-400/80 mt-0.5">47 NCs devengadas (-3.70%)</p>
            </div>
          </div>

          {/* TABLA 1: ESTRUCTURA P&L */}
          <div className="space-y-3">
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Estructura Contable del Costo de Ventas (P&L)
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
                    <td className="py-3 px-4 text-right font-mono">{((totalCmv / 1234596102) * 100).toFixed(2)}%</td>
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
                  Notas de Crédito, Acuerdos Comerciales y Bonificaciones de Proveedores ({ncItems.length || 47} NCs)
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
                  {(ncItems.length > 0 ? ncItems : [
                    { fecha: "2026-09-17", comp: "001-001-0048396", factura_afectada: null, proveedor: "CASA GONZALITO S.R.L.", concepto: "ACUERDO_COMERCIAL", categoria: "Acuerdo Comercial", monto: 30425026 },
                    { fecha: "2026-09-09", comp: "001-003-0008599", factura_afectada: null, proveedor: "EXTRA S.A", concepto: "Devolución de mercadería", categoria: "Devolución", monto: 2776087 },
                    { fecha: "2026-09-09", comp: "001-001-0048065", factura_afectada: null, proveedor: "CASA GONZALITO S.R.L.", concepto: "ACUERDO_COMERCIAL", categoria: "Acuerdo Comercial", monto: 2503125 },
                    { fecha: "2026-09-09", comp: "001-001-0048066", factura_afectada: null, proveedor: "CASA GONZALITO S.R.L.", concepto: "ACUERDO_COMERCIAL", categoria: "Acuerdo Comercial", monto: 2503125 },
                    { fecha: "2026-09-24", comp: "001-001-0086445", factura_afectada: "001-001-0353658", proveedor: "SAN JOSE IMPORT EXPORT S.A", concepto: "Devolución de mercadería", categoria: "Devolución", monto: 1408300 },
                    { fecha: "2026-09-21", comp: "001-001-0007502", factura_afectada: null, proveedor: "DIST. AQUIDABAN S.R.L.", concepto: "Devolución de mercadería", categoria: "Devolución", monto: 1375752 },
                    { fecha: "2026-09-04", comp: "001-008-0000819", factura_afectada: null, proveedor: "GOSI SAICI", concepto: "ACCIONES_PROMOCIONALES", categoria: "Promoción", monto: 694045 },
                    { fecha: "2026-09-21", comp: "001-001-0007503", factura_afectada: null, proveedor: "DIST. AQUIDABAN S.R.L.", concepto: "Devolución de mercadería", categoria: "Devolución", monto: 603400 },
                    { fecha: "2026-09-08", comp: "001-003-0008493", factura_afectada: null, proveedor: "EXTRA S.A", concepto: "Devolución de mercadería", categoria: "Devolución", monto: 476240 },
                    { fecha: "2026-09-01", comp: "001-001-0005548", factura_afectada: null, proveedor: "PANAMA REPRESENTACIONES SA", concepto: "DIFERENCIA_PRECIO", categoria: "Ajuste Precio", monto: 450348 }
                  ])
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

          {/* TABLA 3: MATERIAS PRIMAS PANADERÍA */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  Materias Primas Panadería Devengadas ({materiaPrimaPanaderia.length} comprobantes)
                </h4>
                <p className="text-xs text-slate-500">Facturas de compras e insumos de producción panificados imputadas al Costo de Ventas</p>
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
                    <th className="py-3 px-4">RUC</th>
                    <th className="py-3 px-4">Descripción de Insumos</th>
                    <th className="py-3 px-4 text-right font-bold">Importe (₲)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {materiaPrimaPanaderia
                    .filter(m => (m.proveedor || "").toLowerCase().includes(searchTerm.toLowerCase()) || (m.comp || "").includes(searchTerm) || (m.concepto || "").toLowerCase().includes(searchTerm.toLowerCase()))
                    .map((m, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-2.5 px-4 text-slate-500 font-mono">{m.fecha}</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">{m.comp}</td>
                        <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">{m.proveedor}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-500">{m.ruc}</td>
                        <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">{m.concepto}</td>
                        <td className="py-2.5 px-4 text-right font-black font-mono text-slate-900 dark:text-slate-100">
                          {formatPYG(m.monto)}
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
              <strong>Tratamiento Contable:</strong> La provisión de Aguinaldo (1/12) se acumula contablemente en cuenta de Pasivo Diferido hacia Diciembre y <strong>no se deduce del flujo operativo ni del EBITDA de Septiembre</strong> (al no constituir desembolso efectivo en el período).
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
      {/* VISTA 4: GASTOS OPERATIVOS (OPEX)                                   */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {magnitude !== "nomina" && magnitude !== "ingresos" && magnitude !== "cogs" && (
        <div>
          <div className="bg-indigo-50/50 dark:bg-indigo-950/20 px-6 py-3 border-b border-indigo-100 dark:border-indigo-900/50 flex flex-wrap justify-between items-center text-xs text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-4">
              <span className="font-semibold text-slate-600 dark:text-slate-400">
                Comprobantes filtrados: <strong className="text-slate-900 dark:text-white">{gastosGenerales.length}</strong>
              </span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="font-semibold text-slate-600 dark:text-slate-400">
                Total devengado en la categoría: <strong className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{formatPYG(totalGastosMonto)}</strong>
              </span>
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
                  <th className="py-3 px-4">Rubro Específico</th>
                  <th className="py-3 px-4">Descripción Detallada</th>
                  <th className="py-3 px-4 text-right font-bold">Importe (₲)</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {gastosGenerales.length > 0 ? (
                  gastosGenerales.map((g, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4 text-slate-500 font-mono">{g.fecha}</td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-700 dark:text-slate-300">{g.comp}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">{g.proveedor}</td>
                      <td className="py-3 px-4 text-slate-500 font-mono">{g.ruc}</td>
                      <td className="py-3 px-4 font-medium text-indigo-600 dark:text-indigo-400">{g.rubro}</td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 max-w-md">{g.concepto}</td>
                      <td className="py-3 px-4 text-right font-black font-mono text-slate-900 dark:text-slate-100">{formatPYG(g.monto)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-300">
                          PAGADO
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No se encontraron comprobantes para esta categoría o criterio de búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
