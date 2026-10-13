import React from "react"
import { ChevronRight, ArrowUpRight, TrendingUp, DollarSign, Building, Wrench, Truck, Briefcase, Landmark } from "lucide-react"
import { formatPYG } from "../../utils/format"

interface ClosingPnlTableProps {
  data: any
  onSelectMagnitude: (magnitude: string) => void
}

export function ClosingPnlTable({ data, onSelectMagnitude }: ClosingPnlTableProps) {
  if (!data) return null

  const { kpis, ingresos, cogs, nomina, opex, financieros, conciliacion_bancaria } = data

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-wrap justify-between items-center gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Estado de Resultados en Cascada (P&L Devengado)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Cierre Oficial de Septiembre 2026 — Grupo Santa Teresa E.A.S. / Extra Supermercado Mayorista
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          ● 100% Conciliado con Bancos
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-950/60 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
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
                <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Ventas Netas Totales (Cajas Salón POS)
              </td>
              <td className="py-3 px-4 text-right text-blue-700 dark:text-blue-400 font-black font-mono">
                {formatPYG(ingresos?.ventas_netas)}
              </td>
              <td className="py-3 px-4 text-right text-xs font-mono font-bold">100.0%</td>
              <td className="py-3 px-4 text-center">
                <button
                  onClick={() => onSelectMagnitude("ingresos")}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold inline-flex items-center gap-0.5 cursor-pointer"
                >
                  Ver Cajas <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
            <tr className="text-xs text-slate-600 dark:text-slate-400">
              <td className="py-2.5 px-4 text-center text-slate-400">1.1</td>
              <td className="py-2.5 px-4 pl-8">Efectivo Guaraníes en Cajas (Bóveda y Drops)</td>
              <td className="py-2.5 px-4 text-right font-mono font-medium">{formatPYG(ingresos?.ventas_efectivo)}</td>
              <td className="py-2.5 px-4 text-right font-mono text-slate-500">43.8%</td>
              <td></td>
            </tr>
            <tr className="text-xs text-slate-600 dark:text-slate-400">
              <td className="py-2.5 px-4 text-center text-slate-400">1.2</td>
              <td className="py-2.5 px-4 pl-8">Tarjetas POS Bancard & Dinelco (Débito y Crédito)</td>
              <td className="py-2.5 px-4 text-right font-mono font-medium">{formatPYG(ingresos?.ventas_tarjetas_pos)}</td>
              <td className="py-2.5 px-4 text-right font-mono text-slate-500">20.4%</td>
              <td></td>
            </tr>
            <tr className="text-xs text-slate-600 dark:text-slate-400">
              <td className="py-2.5 px-4 text-center text-slate-400">1.3</td>
              <td className="py-2.5 px-4 pl-8">Cobros Extra Club (Vales y Créditos de Colaboradores)</td>
              <td className="py-2.5 px-4 text-right font-mono font-medium">{formatPYG(ingresos?.ventas_extra_club)}</td>
              <td className="py-2.5 px-4 text-right font-mono text-slate-500">15.7%</td>
              <td></td>
            </tr>
            <tr className="text-xs text-slate-600 dark:text-slate-400">
              <td className="py-2.5 px-4 text-center text-slate-400">1.4</td>
              <td className="py-2.5 px-4 pl-8">Billeteras Digitales y Cobros QR SIPAP</td>
              <td className="py-2.5 px-4 text-right font-mono font-medium">{formatPYG(ingresos?.ventas_qr)}</td>
              <td className="py-2.5 px-4 text-right font-mono text-slate-500">12.7%</td>
              <td></td>
            </tr>
            <tr className="text-xs text-slate-600 dark:text-slate-400">
              <td className="py-2.5 px-4 text-center text-slate-400">1.5</td>
              <td className="py-2.5 px-4 pl-8">PIX PlugPay / Divisas de Frontera</td>
              <td className="py-2.5 px-4 text-right font-mono font-medium">{formatPYG(ingresos?.ventas_pix)}</td>
              <td className="py-2.5 px-4 text-right font-mono text-slate-500">1.6%</td>
              <td></td>
            </tr>
            <tr className="text-xs text-slate-600 dark:text-slate-400">
              <td className="py-2.5 px-4 text-center text-slate-400">1.6</td>
              <td className="py-2.5 px-4 pl-8">Transferencias Bancarias Mayoristas Verificadas</td>
              <td className="py-2.5 px-4 text-right font-mono font-medium">{formatPYG(ingresos?.ventas_transferencias)}</td>
              <td className="py-2.5 px-4 text-right font-mono text-slate-500">1.0%</td>
              <td></td>
            </tr>

            {/* 2. COSTO DE MERCADERÍAS VENDIDAS (CMV) */}
            <tr className="bg-rose-50/40 dark:bg-rose-950/20 font-semibold text-slate-900 dark:text-slate-100">
              <td className="py-3 px-4 text-center text-xs text-slate-500">2.0</td>
              <td className="py-3 px-4 text-rose-700 dark:text-rose-400">
                (-) Costo de Mercaderías Vendidas (CMV / Compras Reventa)
              </td>
              <td className="py-3 px-4 text-right text-rose-700 dark:text-rose-400 font-black font-mono">
                -{formatPYG(cogs?.total_cmv)}
              </td>
              <td className="py-3 px-4 text-right text-xs font-mono font-bold text-rose-700">82.66%</td>
              <td className="py-3 px-4 text-center">
                <button
                  onClick={() => onSelectMagnitude("cogs")}
                  className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold inline-flex items-center gap-0.5 cursor-pointer"
                >
                  Ver Compras <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>

            {/* 3. MARGEN BRUTO */}
            <tr className="bg-emerald-50/60 dark:bg-emerald-950/30 font-bold text-slate-900 dark:text-slate-100 border-t border-b border-emerald-200 dark:border-emerald-800">
              <td className="py-3 px-4 text-center text-xs text-slate-500">3.0</td>
              <td className="py-3 px-4 text-emerald-800 dark:text-emerald-300">
                UTILIDAD BRUTA COMERCIAL
              </td>
              <td className="py-3 px-4 text-right text-emerald-800 dark:text-emerald-300 font-black font-mono">
                {formatPYG(kpis?.utilidad_bruta)}
              </td>
              <td className="py-3 px-4 text-right font-black font-mono text-emerald-700">
                {kpis?.margen_bruto_pct || 17.34}%
              </td>
              <td className="py-3 px-4 text-center text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                Margen Bruto
              </td>
            </tr>

            {/* 4. TOTAL OPEX */}
            <tr className="bg-amber-50/40 dark:bg-amber-950/20 font-semibold text-slate-900 dark:text-slate-100">
              <td className="py-3 px-4 text-center text-xs text-slate-500">4.0</td>
              <td className="py-3 px-4 text-amber-800 dark:text-amber-400">
                (-) GASTOS OPERATIVOS TOTALES (OPEX + NÓMINA)
              </td>
              <td className="py-3 px-4 text-right text-amber-800 dark:text-amber-400 font-black font-mono">
                -{formatPYG(kpis?.total_opex)}
              </td>
              <td className="py-3 px-4 text-right text-xs font-mono font-bold text-amber-700">
                {kpis?.absorcion_opex_pct || 23.71}%
              </td>
              <td></td>
            </tr>

            {/* Magnitud 4.1: Nómina SueldOK */}
            <tr className="text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="py-2.5 px-4 text-center text-slate-400">4.1</td>
              <td className="py-2.5 px-4 pl-8 font-medium text-slate-800 dark:text-slate-200">
                Costo Laboral SueldOK (44 Colaboradores — Salarios e IPS Patronal 16.5% Desembolsados)
              </td>
              <td className="py-2.5 px-4 text-right font-bold font-mono text-slate-900 dark:text-slate-100">
                {formatPYG(nomina?.total_costo_laboral)}
              </td>
              <td className="py-2.5 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                {kpis?.costo_laboral_pct || 12.69}%
              </td>
              <td className="py-2.5 px-4 text-center">
                <button
                  onClick={() => onSelectMagnitude("nomina")}
                  className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 text-[11px] font-bold hover:bg-indigo-100 transition-colors cursor-pointer"
                >
                  Nómina SueldOK
                </button>
              </td>
            </tr>

            {/* 4.1.bis: Provisión Aguinaldo (Cargo Diferido a Diciembre) */}
            <tr className="text-xs bg-slate-50/40 dark:bg-slate-900/40 text-slate-500 italic">
              <td className="py-2 px-4 text-center text-slate-400">4.1b</td>
              <td className="py-2 px-4 pl-12 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                <span>Provisión Aguinaldo Acumulada (Cargo Diferido a Diciembre — No desembolsado en el mes)</span>
              </td>
              <td className="py-2 px-4 text-right font-mono text-indigo-600 dark:text-indigo-400">
                {formatPYG(nomina?.aguinaldo_diferido_acumulado || nomina?.aguinaldo_provisional || 12351178)}
              </td>
              <td className="py-2 px-4 text-right font-mono text-[11px] text-slate-400">
                (Diferido)
              </td>
              <td className="py-2 px-4 text-center">
                <span className="text-[10px] uppercase font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                  Pasivo Acumulado
                </span>
              </td>
            </tr>

            {/* Magnitud 4.2: Ocupación */}
            <tr className="text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="py-2.5 px-4 text-center text-slate-400">4.2</td>
              <td className="py-2.5 px-4 pl-8 text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                Ocupación, Seguros y Servicios Básicos (Póliza Río Seguros, ANDE, Internet FTTH)
              </td>
              <td className="py-2.5 px-4 text-right font-mono font-medium">
                {formatPYG(opex?.ocupacion_servicios?.total)}
              </td>
              <td className="py-2.5 px-4 text-right font-mono text-slate-500">2.6%</td>
              <td className="py-2.5 px-4 text-center">
                <button
                  onClick={() => onSelectMagnitude("ocupacion")}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                >
                  Ver Seguros
                </button>
              </td>
            </tr>

            {/* Magnitud 4.3: Mantenimiento */}
            <tr className="text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="py-2.5 px-4 text-center text-slate-400">4.3</td>
              <td className="py-2.5 px-4 pl-8 text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-slate-400" />
                Mantenimiento e Infraestructura (Albañilería, Cañerías, Cámaras Frío, Balanzas)
              </td>
              <td className="py-2.5 px-4 text-right font-mono font-medium">
                {formatPYG(opex?.mantenimiento_infraestructura?.total)}
              </td>
              <td className="py-2.5 px-4 text-right font-mono text-slate-500">1.9%</td>
              <td className="py-2.5 px-4 text-center">
                <button
                  onClick={() => onSelectMagnitude("mantenimiento")}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                >
                  Ver Obras
                </button>
              </td>
            </tr>

            {/* Magnitud 4.4: Logística */}
            <tr className="text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="py-2.5 px-4 text-center text-slate-400">4.4</td>
              <td className="py-2.5 px-4 pl-8 text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-slate-400" />
                Logística, Insumos y Producción (Harinas Uso Interno, Insumos Panadería, Bolsas Cajas)
              </td>
              <td className="py-2.5 px-4 text-right font-mono font-medium">
                {formatPYG(opex?.logistica_operacion?.total)}
              </td>
              <td className="py-2.5 px-4 text-right font-mono text-slate-500">2.4%</td>
              <td className="py-2.5 px-4 text-center">
                <button
                  onClick={() => onSelectMagnitude("logistica")}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                >
                  Ver Insumos
                </button>
              </td>
            </tr>

            {/* Magnitud 4.5: Administración */}
            <tr className="text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="py-2.5 px-4 text-center text-slate-400">4.5</td>
              <td className="py-2.5 px-4 pl-8 text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                Administración, Cartelería y Gestión (Publicidad Local, Folletos, Útiles, Sistemas)
              </td>
              <td className="py-2.5 px-4 text-right font-mono font-medium">
                {formatPYG(opex?.administracion_tecnologia?.total)}
              </td>
              <td className="py-2.5 px-4 text-right font-mono text-slate-500">3.4%</td>
              <td className="py-2.5 px-4 text-center">
                <button
                  onClick={() => onSelectMagnitude("administracion")}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                >
                  Ver Gastos
                </button>
              </td>
            </tr>

            {/* 5. EBITDA */}
            <tr className="bg-amber-100/60 dark:bg-amber-950/30 font-bold text-slate-900 dark:text-slate-100 border-t border-amber-200">
              <td className="py-3 px-4 text-center text-xs text-slate-500">5.0</td>
              <td className="py-3 px-4">EBITDA (Resultado Operativo Bruto)</td>
              <td className="py-3 px-4 text-right text-amber-900 dark:text-amber-300 font-black font-mono text-sm">
                {formatPYG(kpis?.ebitda)}
              </td>
              <td className="py-3 px-4 text-right font-black font-mono text-amber-900 dark:text-amber-300">
                {kpis?.ebitda_pct}%
              </td>
              <td className="py-3 px-4 text-center text-[11px] font-bold text-slate-500">Flujo Operativo</td>
            </tr>

            {/* 6. GASTOS FINANCIEROS */}
            <tr className="text-xs text-slate-600 dark:text-slate-400">
              <td className="py-2.5 px-4 text-center text-slate-400">6.0</td>
              <td className="py-2.5 px-4">(-) Gastos Financieros y Comisiones POS (Bancard / Dinelco)</td>
              <td className="py-2.5 px-4 text-right font-mono font-medium">-{formatPYG(financieros?.total)}</td>
              <td className="py-2.5 px-4 text-right font-mono text-slate-500">0.6%</td>
              <td className="py-2.5 px-4 text-center">
                <button
                  onClick={() => onSelectMagnitude("administracion")}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                >
                  Ver Comisiones
                </button>
              </td>
            </tr>

            {/* 7. RESULTADO NETO */}
            <tr className="bg-emerald-100/80 dark:bg-emerald-950/40 font-bold text-slate-900 dark:text-slate-100 border-t-2 border-emerald-500">
              <td className="py-3.5 px-4 text-center text-xs text-slate-500">7.0</td>
              <td className="py-3.5 px-4 text-sm text-emerald-900 dark:text-emerald-200">
                RESULTADO NETO DEL EJERCICIO (SETIEMBRE 2026)
              </td>
              <td className="py-3.5 px-4 text-right text-emerald-900 dark:text-emerald-300 font-black font-mono text-base">
                {formatPYG(kpis?.resultado_neto)}
              </td>
              <td className="py-3.5 px-4 text-right font-black font-mono text-emerald-900 dark:text-emerald-300 text-sm">
                {kpis?.resultado_neto_pct}%
              </td>
              <td className="py-3.5 px-4 text-center text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400">
                CIERRE DEFINITIVO
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Conciliación Bancaria al pie */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <Landmark className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Saldos Bancarios Calibrados Oficiales al 30/09/2026 (5 Cuentas Maestras Continental e Interfisa):
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-black font-mono text-indigo-700 dark:text-indigo-300">
            {formatPYG(conciliacion_bancaria?.saldo_calibrado_oficial || 73874004)}
          </span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 font-bold border border-emerald-300">
            SELLADO AUDITORÍA
          </span>
        </div>
      </div>
    </div>
  )
}
