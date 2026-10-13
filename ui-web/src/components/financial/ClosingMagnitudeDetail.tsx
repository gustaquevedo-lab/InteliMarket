import React, { useState } from "react"
import { Search, Download, Users, FileText, ArrowLeft, Filter } from "lucide-react"
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

  const formatGs = (val: number) => {
    return (val || 0).toLocaleString("es-PY") + " Gs."
  }

  // 100% Datos Reales de SueldOK (45 colaboradores) y Gastos de Setiembre
  const nominaData = REAL_NOMINA
  const gastosGenerales = REAL_GASTOS

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
