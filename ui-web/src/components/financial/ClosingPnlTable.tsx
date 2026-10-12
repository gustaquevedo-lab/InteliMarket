import React from "react"
import { ChevronRight, ArrowUpRight, TrendingUp, DollarSign, Building, Wrench, Truck, Briefcase, Landmark } from "lucide-react"

interface ClosingPnlTableProps {
  data: any
  onSelectMagnitude: (magnitude: string) => void
}

export function ClosingPnlTable({ data, onSelectMagnitude }: ClosingPnlTableProps) {
  if (!data) return null

  const { kpis, ingresos, cogs, nomina, opex, financieros, conciliacion_bancaria } = data

  const formatGs = (val: number) => {
    return (val || 0).toLocaleString("es-PY") + " Gs."
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Estado de Resultados en Cascada (P&L Devengado)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Cierre Oficial de Septiembre 2026 — Grupo Santa Teresa E.A.S. / Extra Supermercado
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          ● 100% Conciliado con Bancos
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 dark:bg-slate-800/80 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4 w-12 text-center">Cód</th>
              <th className="py-3 px-4">Concepto Económico / Magnitud</th>
              <th className="py-3 px-4 text-right">Importe Devengado</th>
              <th className="py-3 px-4 text-right w-28">% s/ Ventas</th>
              <th className="py-3 px-4 text-center w-36">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
            {/* 1. VENTAS NETAS */}
            <tr className="bg-blue-50/40 dark:bg-blue-950/20 font-semibold text-slate-900 dark:text-slate-100">
              <td className="py-3 px-4 text-center text-xs text-slate-500">1.0</td>
              <td className="py-3 px-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-blue-600" />
                Ventas Netas Totales (Cajas Salón POS)
              </td>
              <td className="py-3 px-4 text-right text-blue-700 dark:text-blue-400 font-bold">
                {formatGs(ingresos?.ventas_netas)}
              </td>
              <td className="py-3 px-4 text-right text-xs">100.0%</td>
              <td className="py-3 px-4 text-center">
                <button
                  onClick={() => onSelectMagnitude("ingresos")}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium inline-flex items-center gap-0.5"
                >
                  Ver Cajas <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
            <tr className="text-xs text-slate-600 dark:text-slate-400">
              <td className="py-2 px-4 text-center">1.1</td>
              <td className="py-2 px-4 pl-8">Efectivo Guaraníes en Cajas (Bóveda y Drops)</td>
              <td className="py-2 px-4 text-right">{formatGs(ingresos?.ventas_efectivo)}</td>
              <td className="py-2 px-4 text-right">69.1%</td>
              <td></td>
            </tr>
            <tr className="text-xs text-slate-600 dark:text-slate-400">
              <td className="py-2 px-4 text-center">1.2</td>
              <td className="py-2 px-4 pl-8">Tarjetas y Medios Digitales (Bancard, Dinelco, QR)</td>
              <td className="py-2 px-4 text-right">{formatGs(ingresos?.ventas_tarjetas_pos)}</td>
              <td className="py-2 px-4 text-right">30.9%</td>
              <td></td>
            </tr>

            {/* 2. CMV */}
            <tr className="bg-rose-50/30 dark:bg-rose-950/10 font-semibold text-slate-900 dark:text-slate-100">
              <td className="py-3 px-4 text-center text-xs text-slate-500">2.0</td>
              <td className="py-3 px-4 flex items-center gap-2 text-rose-700 dark:text-rose-400">
                (-) Costo de Mercaderías Vendidas (CMV)
              </td>
              <td className="py-3 px-4 text-right text-rose-700 dark:text-rose-400 font-bold">
                -{formatGs(cogs?.total_cmv)}
              </td>
              <td className="py-3 px-4 text-right text-xs text-rose-600">82.6%</td>
              <td className="py-3 px-4 text-center">
                <button
                  onClick={() => onSelectMagnitude("cogs")}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium inline-flex items-center gap-0.5"
                >
                  Ver Compras <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>

            {/* 3. UTILIDAD BRUTA */}
            <tr className="bg-slate-100/70 dark:bg-slate-800 font-bold text-slate-900 dark:text-slate-100 border-t-2 border-slate-300 dark:border-slate-700">
              <td className="py-3 px-4 text-center text-xs text-slate-500">3.0</td>
              <td className="py-3 px-4">UTILIDAD BRUTA COMERCIAL</td>
              <td className="py-3 px-4 text-right text-emerald-700 dark:text-emerald-400 font-bold text-base">
                {formatGs(kpis?.utilidad_bruta)}
              </td>
              <td className="py-3 px-4 text-right text-emerald-700 dark:text-emerald-400 font-bold">
                {kpis?.margen_bruto_pct}%
              </td>
              <td className="py-3 px-4 text-center text-xs text-slate-500">Margen Bruto</td>
            </tr>

            {/* 4. OPEX */}
            <tr className="bg-amber-50/20 dark:bg-amber-950/10 font-semibold text-slate-900 dark:text-slate-100">
              <td className="py-3 px-4 text-center text-xs text-slate-500">4.0</td>
              <td className="py-3 px-4 text-amber-800 dark:text-amber-400">
                (-) Gastos Operativos de Supermercado (OPEX)
              </td>
              <td className="py-3 px-4 text-right text-amber-800 dark:text-amber-400 font-bold">
                -{formatGs(kpis?.total_opex)}
              </td>
              <td className="py-3 px-4 text-right text-xs text-amber-700">
                {kpis?.absorcion_opex_pct}%
              </td>
              <td></td>
            </tr>

            {/* Magnitud 4.1: Nómina */}
            <tr className="text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="py-2.5 px-4 text-center">4.1</td>
              <td className="py-2.5 px-4 pl-8 font-medium text-slate-800 dark:text-slate-200">
                Gastos de Personal (Sueldos, Jornales, IPS Patronal 16.5% y Aguinaldo)
              </td>
              <td className="py-2.5 px-4 text-right font-semibold text-slate-900 dark:text-slate-100">
                {formatGs(nomina?.total_costo_laboral)}
              </td>
              <td className="py-2.5 px-4 text-right font-medium text-slate-600 dark:text-slate-400">
                {kpis?.costo_laboral_pct}%
              </td>
              <td className="py-2.5 px-4 text-center">
                <button
                  onClick={() => onSelectMagnitude("nomina")}
                  className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-semibold hover:bg-blue-100"
                >
                  Nómina SueldOK
                </button>
              </td>
            </tr>

            {/* Magnitud 4.2: Ocupación */}
            <tr className="text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="py-2.5 px-4 text-center">4.2</td>
              <td className="py-2.5 px-4 pl-8 text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                Ocupación y Servicios Básicos (Alquiler, ANDE, Essap, Guardia)
              </td>
              <td className="py-2.5 px-4 text-right font-medium">
                {formatGs(opex?.ocupacion_servicios?.total)}
              </td>
              <td className="py-2.5 px-4 text-right">1.2%</td>
              <td className="py-2.5 px-4 text-center">
                <button
                  onClick={() => onSelectMagnitude("ocupacion")}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Ver Servicios
                </button>
              </td>
            </tr>

            {/* Magnitud 4.3: Mantenimiento */}
            <tr className="text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="py-2.5 px-4 text-center">4.3</td>
              <td className="py-2.5 px-4 pl-8 text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-slate-400" />
                Mantenimiento e Infraestructura (Cámaras frío, Balanzas, POS, Fachada)
              </td>
              <td className="py-2.5 px-4 text-right font-medium">
                {formatGs(opex?.mantenimiento_infraestructura?.total)}
              </td>
              <td className="py-2.5 px-4 text-right">0.4%</td>
              <td className="py-2.5 px-4 text-center">
                <button
                  onClick={() => onSelectMagnitude("mantenimiento")}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Ver Obras
                </button>
              </td>
            </tr>

            {/* Magnitud 4.4: Logística */}
            <tr className="text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="py-2.5 px-4 text-center">4.4</td>
              <td className="py-2.5 px-4 pl-8 text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-slate-400" />
                Logística, Operación e Insumos (Fletes, Bolsas, Combustible)
              </td>
              <td className="py-2.5 px-4 text-right font-medium">
                {formatGs(opex?.logistica_operacion?.total)}
              </td>
              <td className="py-2.5 px-4 text-right">0.8%</td>
              <td className="py-2.5 px-4 text-center">
                <button
                  onClick={() => onSelectMagnitude("logistica")}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Ver Fletes
                </button>
              </td>
            </tr>

            {/* Magnitud 4.5: Administración */}
            <tr className="text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="py-2.5 px-4 text-center">4.5</td>
              <td className="py-2.5 px-4 pl-8 text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                Administración, Tecnología y Asesoría (Sistemas, Contabilidad)
              </td>
              <td className="py-2.5 px-4 text-right font-medium">
                {formatGs(opex?.administracion_tecnologia?.total)}
              </td>
              <td className="py-2.5 px-4 text-right">0.5%</td>
              <td className="py-2.5 px-4 text-center">
                <button
                  onClick={() => onSelectMagnitude("administracion")}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Ver Asesoría
                </button>
              </td>
            </tr>

            {/* 5. EBITDA */}
            <tr className="bg-amber-100/60 dark:bg-amber-950/30 font-bold text-slate-900 dark:text-slate-100 border-t border-amber-200">
              <td className="py-3 px-4 text-center text-xs text-slate-500">5.0</td>
              <td className="py-3 px-4">EBITDA (Resultado Operativo Bruto)</td>
              <td className="py-3 px-4 text-right text-amber-900 dark:text-amber-300 text-base">
                {formatGs(kpis?.ebitda)}
              </td>
              <td className="py-3 px-4 text-right font-bold text-amber-900 dark:text-amber-300">
                {kpis?.ebitda_pct}%
              </td>
              <td className="py-3 px-4 text-center text-xs text-slate-500">Flujo Operativo</td>
            </tr>

            {/* 6. GASTOS FINANCIEROS */}
            <tr className="text-xs text-slate-600 dark:text-slate-400">
              <td className="py-2.5 px-4 text-center">6.0</td>
              <td className="py-2.5 px-4">(-) Gastos Financieros e Impuestos (Comisiones POS Bancard/Dinelco)</td>
              <td className="py-2.5 px-4 text-right font-medium">-{formatGs(financieros?.total)}</td>
              <td className="py-2.5 px-4 text-right">1.2%</td>
              <td className="py-2.5 px-4 text-center">
                <button
                  onClick={() => onSelectMagnitude("administracion")}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Ver Bancos
                </button>
              </td>
            </tr>

            {/* 7. RESULTADO NETO */}
            <tr className="bg-emerald-100/80 dark:bg-emerald-950/40 font-bold text-slate-900 dark:text-slate-100 border-t-2 border-emerald-500">
              <td className="py-3.5 px-4 text-center text-xs text-slate-500">7.0</td>
              <td className="py-3.5 px-4 text-base text-emerald-900 dark:text-emerald-200">
                RESULTADO NETO DEL EJERCICIO (SETIEMBRE 2026)
              </td>
              <td className="py-3.5 px-4 text-right text-emerald-900 dark:text-emerald-300 text-lg">
                {formatGs(kpis?.resultado_neto)}
              </td>
              <td className="py-3.5 px-4 text-right text-emerald-900 dark:text-emerald-300 text-base">
                {kpis?.resultado_neto_pct}%
              </td>
              <td className="py-3.5 px-4 text-center text-xs font-bold text-emerald-700 dark:text-emerald-400">
                CIERRE DEFINITIVO
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Conciliación Bancaria al pie */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <Landmark className="w-5 h-5 text-indigo-600" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Saldos Bancarios Calibrados Oficiales al 30/09/2026 (5 Cuentas Maestras Continental e Interfisa):
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-indigo-700 dark:text-indigo-400">
            Gs. {conciliacion_bancaria?.saldo_calibrado_oficial?.toLocaleString("es-PY")}
          </span>
          <span className="text-xs px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 font-bold">
            SELLADO AUDITORÍA
          </span>
        </div>
      </div>
    </div>
  )
}
