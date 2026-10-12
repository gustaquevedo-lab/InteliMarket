import React, { useState } from "react"
import { Search, Download, Users, FileText, ArrowLeft, Filter } from "lucide-react"

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

  const formatGs = (val: number) => {
    return (val || 0).toLocaleString("es-PY") + " Gs."
  }

  // Datos representativos para demostración y navegación interactiva
  const nominaData = [
    {
      ci: "3.456.789",
      nombre: "CARLOS ALBERTO BENITEZ",
      cargo: "Jefe de Salón y Cajas",
      dpto: "Operaciones",
      salario_base: 6500000,
      horas_extras: 850000,
      total_devengado: 7350000,
      ips_obrero: 661500,
      ips_patronal: 1212750,
      aguinaldo_provisional: 612500,
      anticipos: 500000,
      neto: 6188500
    },
    {
      ci: "4.123.456",
      nombre: "MARIA ELENA GONZALEZ",
      cargo: "Cajera Principal Turno Mañana",
      dpto: "Cajas",
      salario_base: 3200000,
      horas_extras: 420000,
      total_devengado: 3620000,
      ips_obrero: 325800,
      ips_patronal: 597300,
      aguinaldo_provisional: 301667,
      anticipos: 200000,
      neto: 3094200
    },
    {
      ci: "2.987.654",
      nombre: "JUAN RAMON DUARTE",
      cargo: "Encargado de Carnicería y Frío",
      dpto: "Perecederos",
      salario_base: 4800000,
      horas_extras: 750000,
      total_devengado: 5550000,
      ips_obrero: 499500,
      ips_patronal: 915750,
      aguinaldo_provisional: 462500,
      anticipos: 350000,
      neto: 4700500
    },
    {
      ci: "3.890.123",
      nombre: "LOURDES BEATRIZ MARTINEZ",
      cargo: "Supervisora de Cajas Turno Tarde",
      dpto: "Cajas",
      salario_base: 3800000,
      horas_extras: 490000,
      total_devengado: 4290000,
      ips_obrero: 386100,
      ips_patronal: 707850,
      aguinaldo_provisional: 357500,
      anticipos: 300000,
      neto: 3603900
    },
    {
      ci: "4.567.890",
      nombre: "RODRIGO IVAN ACOSTA",
      cargo: "Auxiliar de Depósito y Reposición",
      dpto: "Depósito",
      salario_base: 2900000,
      horas_extras: 350000,
      total_devengado: 3250000,
      ips_obrero: 292500,
      ips_patronal: 536250,
      aguinaldo_provisional: 270833,
      anticipos: 150000,
      neto: 2807500
    }
  ]

  const gastosGenerales = [
    { fecha: "2026-09-05", comp: "001-001-0004521", proveedor: "INMOBILIARIA DEL ESTE S.A.", ruc: "80012345-1", concepto: "Alquiler Sede Central Salón Supermercado", monto: 80000000, rubro: "Ocupación" },
    { fecha: "2026-09-15", comp: "ANDE-NIS-48921", proveedor: "ADMINISTRACION NACIONAL DE ELECTRICIDAD (ANDE)", ruc: "80000001-0", concepto: "Consumo Eléctrico Media Tensión Salón y Cámaras Frío", monto: 42500000, rubro: "Ocupación" },
    { fecha: "2026-09-20", comp: "001-002-0001890", proveedor: "PROSEGUR PARAGUAY S.A.", ruc: "80004567-2", concepto: "Vigilancia Física 24hs y Custodia de Valores", monto: 18300000, rubro: "Ocupación" },
    { fecha: "2026-09-18", comp: "001-001-0005852", proveedor: "FRIGOTEC INDUSTRIAL", ruc: "80056789-3", concepto: "Mantenimiento Preventivo y Carga Gas Central Frío R404A", monto: 28000000, rubro: "Mantenimiento" },
    { fecha: "2026-09-22", comp: "001-001-0003412", proveedor: "METROLOGIA & BALANZAS DEL PARAGUAY", ruc: "80098765-4", concepto: "Calibración Oficial de Balanzas Electrónicas Salón", monto: 8500000, rubro: "Mantenimiento" },
    { fecha: "2026-09-12", comp: "001-001-0000778", proveedor: "ESPACIO CREATIVO / FACHADAS", ruc: "80034567-5", concepto: "Mantenimiento y Reparación Letras Luminosas Fachada", monto: 17700000, rubro: "Mantenimiento" },
    { fecha: "2026-09-25", comp: "001-003-0002145", proveedor: "TRANSPORTE & LOGISTICA SAN BLAS", ruc: "80011223-6", concepto: "Fletes Mayoristas Acarreo Mercaderías Central", monto: 45000000, rubro: "Logística" },
    { fecha: "2026-09-28", comp: "001-001-0009811", proveedor: "PLASTICOS DEL SUR S.A.", ruc: "80088990-7", concepto: "Insumos Cajas: 150.000 Bolsas Biodegradables y Bobinas", monto: 27250000, rubro: "Logística" },
  ]

  const titleMap: Record<string, string> = {
    nomina: "Nómina y Costo Laboral SueldOK (Septiembre 2026)",
    ingresos: "Detalle de Ingresos y Facturación Cajas Salón",
    cogs: "Detalle de Costo de Mercaderías y Compras Comerciales",
    ocupacion: "Detalle de Ocupación y Servicios Básicos",
    mantenimiento: "Detalle de Mantenimiento e Infraestructura",
    logistica: "Detalle de Logística, Operación e Insumos",
    administracion: "Detalle de Administración, Finanzas e Impuestos"
  }

  const isNomina = magnitude === "nomina"

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Barra superior con navegación de regreso */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToPnl}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors inline-flex items-center gap-1 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" /> Volver al Resumen P&L
          </button>
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              {isNomina ? <Users className="w-5 h-5 text-blue-600" /> : <FileText className="w-5 h-5 text-indigo-600" />}
              {titleMap[magnitude] || "Detalle Analítico por Magnitud"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isNomina
                ? "Liquidación integral de personal: Salario bruto, horas extras, IPS Obrero (9%), IPS Patronal (16.5%) y Provisión de Aguinaldo"
                : "Comprobantes registrados y devengados con trazabilidad bancaria y cuentas por pagar"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar colaborador / proveedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-56"
            />
          </div>
          <button
            onClick={onExportExcel}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Descargar Excel
          </button>
        </div>
      </div>

      {/* Contenido de la Tabla */}
      <div className="overflow-x-auto">
        {isNomina ? (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">C.I. Nº</th>
                <th className="py-2.5 px-3">Colaborador</th>
                <th className="py-2.5 px-3">Cargo / Área</th>
                <th className="py-2.5 px-3 text-right">Salario Base</th>
                <th className="py-2.5 px-3 text-right">H. Extras</th>
                <th className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">Devengado Bruto</th>
                <th className="py-2.5 px-3 text-right text-rose-600">IPS Obrero (9%)</th>
                <th className="py-2.5 px-3 text-right font-bold text-amber-600">IPS Patronal (16.5%)</th>
                <th className="py-2.5 px-3 text-right text-indigo-600">Aguinaldo (1/12)</th>
                <th className="py-2.5 px-3 text-right text-emerald-700 dark:text-emerald-400 font-bold">Neto a Percibir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {nominaData
                .filter(e => e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || e.ci.includes(searchTerm))
                .map((emp, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-2.5 px-3 text-slate-500 font-mono">{emp.ci}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">{emp.nombre}</td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{emp.cargo} ({emp.dpto})</td>
                    <td className="py-2.5 px-3 text-right">{formatGs(emp.salario_base)}</td>
                    <td className="py-2.5 px-3 text-right">{formatGs(emp.horas_extras)}</td>
                    <td className="py-2.5 px-3 text-right font-bold">{formatGs(emp.total_devengado)}</td>
                    <td className="py-2.5 px-3 text-right text-rose-600">-{formatGs(emp.ips_obrero)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-amber-600">{formatGs(emp.ips_patronal)}</td>
                    <td className="py-2.5 px-3 text-right text-indigo-600">{formatGs(emp.aguinaldo_provisional)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-700 dark:text-emerald-400">{formatGs(emp.neto)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Fecha</th>
                <th className="py-2.5 px-3">Comprobante</th>
                <th className="py-2.5 px-3">Proveedor / Entidad</th>
                <th className="py-2.5 px-3">RUC</th>
                <th className="py-2.5 px-3">Rubro</th>
                <th className="py-2.5 px-3">Descripción Detallada</th>
                <th className="py-2.5 px-3 text-right font-bold">Importe (Gs.)</th>
                <th className="py-2.5 px-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {gastosGenerales
                .filter(g => g.proveedor.toLowerCase().includes(searchTerm.toLowerCase()) || g.concepto.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((g, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-2.5 px-3 text-slate-500">{g.fecha}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">{g.comp}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">{g.proveedor}</td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono">{g.ruc}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-600 dark:text-slate-400">{g.rubro}</td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{g.concepto}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">{formatGs(g.monto)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
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
