import React, { useState } from "react"
import { Search, Download, Users, FileText, ArrowLeft, Filter, Building2, Wrench, Truck, Landmark, ShoppingBag, DollarSign } from "lucide-react"
import { formatPYG } from "../../utils/format"
import { REAL_NOMINA, REAL_GASTOS } from "./closingDataReal"

interface ClosingMagnitudeDetailProps {
  magnitude: string
  onBackToPnl: () => void
  onExportExcel: () => void
}

export function ClosingMagnitudeDetail({
  magnitude,
  onBackToPnl,
  onExportExcel
}: ClosingMagnitudeDetailProps) {
  const [searchTerm, setSearchTerm] = useState("")

  const isNomina = magnitude === "nomina"

  // 100% Datos Reales de SueldOK (44 colaboradores) y Gastos de Setiembre (160 comprobantes)
  const nominaData = REAL_NOMINA

  // Filtrado de gastos por magnitud seleccionada
  const gastosFiltradosPorMagnitud = REAL_GASTOS.filter(g => {
    if (magnitude === "ocupacion") return g.categoria === "ocupacion"
    if (magnitude === "mantenimiento") return g.categoria === "mantenimiento"
    if (magnitude === "logistica") return g.categoria === "logistica"
    if (magnitude === "administracion") return g.categoria === "administracion"
    return true
  })

  const gastosGenerales = gastosFiltradosPorMagnitud.filter(g =>
    g.proveedor.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.concepto.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.comp.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.ruc.includes(searchTerm)
  )

  const titleMap: Record<string, { title: string; subtitle: string; icon: any }> = {
    nomina: {
      title: "Nómina y Costo Laboral SueldOK (Septiembre 2026)",
      subtitle: "44 Colaboradores activos: Salarios base, IPS Obrero (9%), Vales/Anticipos, Neto a cobrar, IPS Patronal (16.5%) y Aguinaldo 1/12",
      icon: Users
    },
    ingresos: {
      title: "Detalle de Ingresos y Facturación Cajas Salón POS",
      subtitle: "12.440 tickets emitidos en Cajas 2, 3, 4 y 5 con trazabilidad por canal de cobro",
      icon: DollarSign
    },
    cogs: {
      title: "Detalle de Costo de Mercaderías Vendidas (CMV)",
      subtitle: "Facturas de compras y reposición comercial de proveedores de reventa",
      icon: ShoppingBag
    },
    ocupacion: {
      title: "Ocupación, Seguros y Servicios Básicos (Septiembre 2026)",
      subtitle: "Póliza de seguros operativos Río Seguros, energía eléctrica ANDE e internet FTTH",
      icon: Building2
    },
    mantenimiento: {
      title: "Mantenimiento, Equipamiento e Infraestructura (Septiembre 2026)",
      subtitle: "Trabajos de albañilería, cableado de cajas, cañerías, herrería, balanzas y cámaras de frío",
      icon: Wrench
    },
    logistica: {
      title: "Logística, Insumos de Producción y Operación (Septiembre 2026)",
      subtitle: "Harinas para panadería (Hilagro, Gonzalito), insumos Bio X, levaduras y bolsas para cajas",
      icon: Truck
    },
    administracion: {
      title: "Administración, Cartelería, Marketing y Finanzas (Septiembre 2026)",
      subtitle: "Cartelería local, publicidad en radio, folletos promocionales, útiles e insumos de oficina",
      icon: Landmark
    }
  }

  const currentMeta = titleMap[magnitude] || {
    title: "Detalle Analítico por Magnitud",
    subtitle: "Comprobantes registrados en base de datos con trazabilidad financiera",
    icon: FileText
  }
  const Icon = currentMeta.icon

  // Cálculos de totales del set actual
  const totalNominaNeto = nominaData.reduce((acc, curr) => acc + curr.neto, 0)
  const totalNominaBruto = nominaData.reduce((acc, curr) => acc + curr.total_devengado, 0)
  const totalNominaIpsPatronal = nominaData.reduce((acc, curr) => acc + curr.ips_patronal, 0)

  const totalGastosMonto = gastosGenerales.reduce((acc, curr) => acc + curr.monto, 0)

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Barra superior con navegación de regreso y buscador */}
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
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar colaborador, proveedor o comprobante..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64 shadow-sm"
            />
          </div>

          <button
            onClick={onExportExcel}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" /> Exportar
          </button>
        </div>
      </div>

      {/* Resumen de totales de la pestaña */}
      <div className="bg-indigo-50/50 dark:bg-indigo-950/20 px-6 py-3 border-b border-indigo-100 dark:border-indigo-900/50 flex flex-wrap justify-between items-center text-xs text-slate-700 dark:text-slate-300">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-slate-600 dark:text-slate-400">
            Registros encontrados: <strong className="text-slate-900 dark:text-white">{isNomina ? nominaData.length : gastosGenerales.length}</strong>
          </span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span className="font-semibold text-slate-600 dark:text-slate-400">
            Total magnitud: <strong className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{formatPYG(isNomina ? totalNominaBruto : totalGastosMonto)}</strong>
          </span>
        </div>

        {isNomina && (
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="text-emerald-700 dark:text-emerald-400 font-bold">Líquido a Cobrar: {formatPYG(totalNominaNeto)}</span>
            <span className="text-amber-700 dark:text-amber-400 font-bold">IPS Patronal (16.5%): {formatPYG(totalNominaIpsPatronal)}</span>
          </div>
        )}
      </div>

      {/* Contenido de la Tabla */}
      <div className="overflow-x-auto">
        {isNomina ? (
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
                <th className="py-3 px-4 text-right text-indigo-600">Aguinaldo (1/12)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {nominaData
                .filter(e => e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || e.ci.includes(searchTerm))
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
        ) : (
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
              {gastosGenerales.map((g, idx) => (
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
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
