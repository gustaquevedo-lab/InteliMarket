import { useState } from "react"
import { formatPYG, formatDate } from "../../utils/format"
import CurrencyInput from "../../components/CurrencyInput"
import {
  Sparkles, ShieldAlert, RefreshCw, Printer, Landmark, Wallet,
  AlertTriangle, Handshake, Clock, Receipt, CheckCircle2,
  Calendar, X, TrendingUp
} from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine
} from "recharts"

interface CustomCashFlowViewProps {
  data: any
  loading: boolean
  dias: number
  colchon: number
  onRefresh: () => void
  onChangeDias: (dias: number) => void
  onChangeColchon: (colchon: number) => void
}

export default function CustomCashFlowView({
  data,
  loading,
  dias,
  colchon,
  onRefresh,
  onChangeDias,
  onChangeColchon,
}: CustomCashFlowViewProps) {
  const [colchonModalOpen, setColchonModalOpen] = useState(false)
  const [tempColchon, setTempColchon] = useState<number>(colchon)

  const resumen = data?.resumen || {}
  const listaDias = Array.isArray(data?.dias) ? data.dias : []

  return (
    <div className="space-y-6">
      {/* 1. Header Ejecutivo y Controles */}
      <div className="card p-6 bg-gradient-to-br from-indigo-50/80 via-slate-50 to-purple-50/50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950/40 border border-indigo-100 dark:border-indigo-900/30 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              Flujo Operativo Real
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Acreditación 48h (Crédito & PIX)
            </span>
          </div>
          <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2 mt-1">
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Flujo de Caja Personalizado & Capacidad de Compromiso
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-3xl leading-relaxed">
            Modelo de caja diario adaptado a Extra Supermercado: Parte del <b>saldo de corte consolidado</b> (Bancos + Bóveda), computa <b>ventas al contado inmediatas</b>, incorpora <b>acreditaciones diferidas a +48h hábiles</b> (Tarjetas de Crédito y PIX), aplica <b>NC comerciales por acuerdos</b> y deduce los pasivos en <b>Fila de Pago activa</b> (OPs y cheques diferidos).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Selector de Días */}
          <div className="inline-flex rounded-xl bg-white dark:bg-slate-800 p-1 border border-gray-200 dark:border-slate-700 shadow-sm">
            {([7, 15, 30, 60] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onChangeDias(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  dias === d
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                {d} Días
              </button>
            ))}
          </div>

          {/* Ajuste de Colchón */}
          <button
            type="button"
            onClick={() => {
              setTempColchon(colchon)
              setColchonModalOpen(true)
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-1.5 shadow-sm transition-all"
            title="Modificar Colchón Mínimo de Seguridad"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            <span>Colchón: {formatPYG(colchon)}</span>
          </button>

          {/* Actualizar en Vivo */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Sincronizando..." : "Actualizar en Vivo"}
          </button>

          {/* Imprimir */}
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-1.5 shadow-sm transition-all"
            title="Imprimir Planilla de Flujo Personalizado"
          >
            <Printer className="w-3.5 h-3.5 text-gray-600" />
            <span>Imprimir</span>
          </button>
        </div>
      </div>

      {/* 2. 5 Tarjetas KPIs Ejecutivas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Disponibilidad Inicial Hoy */}
        <div className="card p-5 bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider">Disponibilidad Hoy</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white">
            {formatPYG(resumen.disponibilidad_total_hoy ?? 0)}
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-2">
            <span>Bancos: <b className="text-gray-700 dark:text-gray-300">{formatPYG(resumen.saldo_bancos_pyg ?? 0)}</b></span>
            <span>•</span>
            <span>Bóveda: <b className="text-gray-700 dark:text-gray-300">{formatPYG(resumen.saldo_boveda_pyg ?? 0)}</b></span>
          </div>
        </div>

        {/* KPI 2: Promedio Diario Disponible Libre */}
        <div className="card p-5 bg-gradient-to-br from-emerald-500/10 via-white to-emerald-500/5 dark:from-emerald-950/30 dark:via-slate-800 dark:to-slate-800 border border-emerald-200 dark:border-emerald-800/40 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
            <span className="text-xs font-black uppercase tracking-wider">Disponible Libre Promedio</span>
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            + {formatPYG(resumen.promedio_diario_disponible_libre ?? 0)}
          </div>
          <div className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 font-medium">
            Capacidad diaria libre sobre colchón para compras y compromisos
          </div>
        </div>

        {/* KPI 3: Punto Crítico de Liquidez */}
        <div className="card p-5 bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider">Día Crítico (Piso Caja)</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
            {formatPYG(resumen.dia_critico?.saldo_proyectado ?? 0)}
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between">
            <span>{resumen.dia_critico?.dia_semana || "-"} {resumen.dia_critico?.fecha ? formatDate(resumen.dia_critico.fecha) : ""}</span>
            <span className="font-bold text-emerald-600">Libre: {formatPYG(resumen.dia_critico?.disponible_libre ?? 0)}</span>
          </div>
        </div>

        {/* KPI 4: NC Acuerdos Comerciales */}
        <div className="card p-5 bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider">NC Acuerdos Proveedor</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Handshake className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
            {formatPYG(resumen.total_nc_acuerdos_disponible ?? 0)}
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400">
            <span>{resumen.qty_nc_acuerdos ?? 0} notas de crédito para compensar</span>
          </div>
        </div>

        {/* KPI 5: Acreditaciones Diferidas 48h */}
        <div className="card p-5 bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider">Acred. Diferidas (+48h)</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
            {formatPYG(resumen.promedio_diario_acreditaciones_48h ?? 0)}
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400">
            <span>Crédito & PIX (+48h hábiles de desfase)</span>
          </div>
        </div>
      </div>

      {/* 3. Panel de Criterios Operativos */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
        <div className="space-y-1">
          <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
            1. Ventas Contado Inmediatas
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-[11px]">
            Efectivo gavetas, Tarjeta Débito, transferencias y QR Débito se computan con disponibilidad instantánea.
          </p>
        </div>
        <div className="space-y-1">
          <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-purple-500" />
            2. Crédito y PIX (+48h Hábiles)
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-[11px]">
            Tarjetas de Crédito y cobros vía PIX tienen un desfase bancario de 48 horas hábiles para su acreditación en cuenta.
          </p>
        </div>
        <div className="space-y-1">
          <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
            <Handshake className="w-3.5 h-3.5 text-indigo-500" />
            3. NC Comerciales y Acuerdos
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-[11px]">
            Solo aplican acuerdos por volumen y rebates comerciales. Se excluyen devoluciones por mermas y roturas.
          </p>
        </div>
        <div className="space-y-1">
          <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-rose-500" />
            4. Fila de Pago de Proveedores
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-[11px]">
            Solo computa compromisos con OP creada/aprobada y cheques emitidos según su fecha asignada de cobro.
          </p>
        </div>
      </div>

      {/* 4. Gráfico de Evolución y Margen Libre */}
      <div className="card p-6 bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="font-black text-base text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              Curva de Saldo Final y Capacidad Libre (Próximos {dias} Días)
            </h4>
            <p className="text-xs text-gray-500">
              Comparación diaria entre el saldo acumulado proyectado, el colchón de seguridad de {formatPYG(colchon)} y el margen disponible para compromisos.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
              <span className="text-gray-600 dark:text-gray-300">Saldo Final</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <span className="text-gray-600 dark:text-gray-300">Disponible Libre</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-rose-500 border-b border-rose-500 border-dashed"></span>
              <span className="text-rose-600 dark:text-rose-400 font-bold">Colchón Mínimo</span>
            </div>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={listaDias} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSaldoFinalCustom" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorDisponibleLibreCustom" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis
                dataKey="fecha"
                tickFormatter={(v: string) => {
                  const parts = v.split("-")
                  return `${parts[2]}/${parts[1]}`
                }}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}M`}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(value: any, name: any) => [
                  formatPYG(Number(value)),
                  name === "saldo_final_proyectado" ? "Saldo Final" : "Disponible Libre"
                ]}
                labelFormatter={(label: any) => `Fecha: ${formatDate(label)}`}
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.95)",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#fff",
                  fontSize: "12px",
                }}
              />
              <ReferenceLine
                y={colchon}
                stroke="#ef4444"
                strokeDasharray="4 4"
                label={{ value: `Colchón: ${formatPYG(colchon)}`, fill: "#ef4444", fontSize: 10, position: "insideTopLeft" }}
              />
              <Area
                type="monotone"
                dataKey="saldo_final_proyectado"
                stroke="#6366f1"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorSaldoFinalCustom)"
              />
              <Area
                type="monotone"
                dataKey="disponible_libre_para_compromisos"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorDisponibleLibreCustom)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5. Tabla Día a Día de Flujo Personalizado */}
      <div className="card overflow-hidden bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 shadow-sm space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="font-black text-base text-gray-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              Planilla Diaria de Flujo de Caja & Capacidad Libre
            </h4>
            <p className="text-xs text-gray-500">
              Desglose completo de entradas netas, salidas de fila de pago y capacidad de compromiso día a día.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-gray-600 dark:text-gray-300 font-bold uppercase tracking-wider text-[10px] border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="px-3 py-3">Fecha / Día</th>
                <th className="px-3 py-3 text-right">Saldo Inicial</th>
                <th className="px-3 py-3 text-right">Vtas Contado</th>
                <th className="px-3 py-3 text-right">Acred. 48h (Créd+PIX)</th>
                <th className="px-3 py-3 text-right">NC Acuerdos</th>
                <th className="px-3 py-3 text-right text-emerald-600 dark:text-emerald-400 font-black">Total Ingresos</th>
                <th className="px-3 py-3 text-right">Fila OPs</th>
                <th className="px-3 py-3 text-right">Cheques Cobro</th>
                <th className="px-3 py-3 text-right">Nómina/Fijos</th>
                <th className="px-3 py-3 text-right text-rose-600 dark:text-rose-400 font-black">Total Egresos</th>
                <th className="px-3 py-3 text-right">Flujo Neto</th>
                <th className="px-3 py-3 text-right font-black">Saldo Final</th>
                <th className="px-3 py-3 text-center font-black">Disponible Libre</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {listaDias.map((d: any, idx: number) => {
                const isToday = idx === 0
                const isWeekend = !d.es_habil
                const flujoPositivo = d.flujo_neto >= 0
                const tieneCapacidad = d.disponible_libre_para_compromisos > 0

                return (
                  <tr
                    key={d.fecha}
                    className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                      isToday
                        ? "bg-indigo-50/40 dark:bg-indigo-950/20 font-medium"
                        : isWeekend
                        ? "bg-slate-50/30 dark:bg-slate-900/20"
                        : ""
                    }`}
                  >
                    {/* Fecha & Día */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-900 dark:text-white">
                          {d.dia_semana}, {formatDate(d.fecha)}
                        </span>
                        {isToday && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-indigo-600 text-white uppercase tracking-wider">
                            Hoy
                          </span>
                        )}
                        {isWeekend && !isToday && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                            Fin de Semana
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Saldo Inicial */}
                    <td className="px-3 py-3 text-right font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {formatPYG(d.saldo_inicial)}
                    </td>

                    {/* Ventas Contado */}
                    <td className="px-3 py-3 text-right text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap">
                      + {formatPYG(d.ingresos.ventas_contado)}
                    </td>

                    {/* Acreditaciones Diferidas 48h (Crédito + PIX) */}
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <div className="text-purple-600 dark:text-purple-400 font-semibold">
                        + {formatPYG(d.ingresos.total_diferido_48h)}
                      </div>
                      <div className="text-[9px] text-gray-400">
                        Créd: {formatPYG(d.ingresos.acreditaciones_credito_48h)} | PIX: {formatPYG(d.ingresos.acreditaciones_pix_48h)}
                      </div>
                    </td>

                    {/* NC Acuerdos */}
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      {d.ingresos.nc_acuerdos_aplicadas > 0 ? (
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                          + {formatPYG(d.ingresos.nc_acuerdos_aplicadas)}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-slate-600">-</span>
                      )}
                    </td>

                    {/* Total Ingresos */}
                    <td className="px-3 py-3 text-right font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap bg-emerald-50/30 dark:bg-emerald-950/10">
                      + {formatPYG(d.ingresos.total_ingresos)}
                    </td>

                    {/* Fila OPs Proveedor */}
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      {d.egresos.proveedores_fila_pago > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">
                          - {formatPYG(d.egresos.proveedores_fila_pago)}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-slate-600">-</span>
                      )}
                    </td>

                    {/* Cheques al Cobro */}
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      {d.egresos.cheques_al_cobro > 0 ? (
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                          - {formatPYG(d.egresos.cheques_al_cobro)}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-slate-600">-</span>
                      )}
                    </td>

                    {/* Nómina, Impuestos & OPEX */}
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <div className="text-gray-700 dark:text-gray-300 font-medium">
                        - {formatPYG(d.egresos.salarios_nomina + d.egresos.impuestos_tasas + d.egresos.opex_gastos_basales)}
                      </div>
                      {d.egresos.salarios_nomina > 0 && (
                        <div className="text-[9px] text-amber-600 font-bold">Nómina: {formatPYG(d.egresos.salarios_nomina)}</div>
                      )}
                    </td>

                    {/* Total Egresos */}
                    <td className="px-3 py-3 text-right font-black text-rose-600 dark:text-rose-400 whitespace-nowrap bg-rose-50/30 dark:bg-rose-950/10">
                      - {formatPYG(d.egresos.total_egresos)}
                    </td>

                    {/* Flujo Neto */}
                    <td className="px-3 py-3 text-right font-black whitespace-nowrap">
                      <span className={flujoPositivo ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                        {flujoPositivo ? "+" : ""}{formatPYG(d.flujo_neto)}
                      </span>
                    </td>

                    {/* Saldo Final Proyectado */}
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <span className={`font-black text-sm ${
                        d.saldo_final_proyectado >= colchon
                          ? "text-gray-900 dark:text-white"
                          : d.saldo_final_proyectado > 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}>
                        {formatPYG(d.saldo_final_proyectado)}
                      </span>
                    </td>

                    {/* Capacidad Disponible Libre */}
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      {tieneCapacidad ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 flex items-center justify-center gap-1 shadow-sm">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          + {formatPYG(d.disponible_libre_para_compromisos)}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 flex items-center justify-center gap-1 shadow-sm">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          En Colchón / Alerta
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Configuración de Colchón de Seguridad */}
      {colchonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-gray-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Colchón de Seguridad de Caja</h3>
                  <p className="text-xs text-gray-500">Monto mínimo intocable en bancos y bóveda</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setColchonModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 flex-1 overflow-y-auto">
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                El colchón de seguridad define la reserva intocable de liquidez. Todo excedente por encima de este importe se computa como <b>disponible libre</b> para asumir nuevos compromisos o pagos de compra.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Monto de Colchón Mínimo
                </label>
                <CurrencyInput
                  currency="PYG"
                  value={tempColchon}
                  onChangeValue={(numVal) => setTempColchon(numVal)}
                  className="w-full text-base font-bold input"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Presets Rápidos</span>
                <div className="grid grid-cols-3 gap-2">
                  {[30_000_000, 50_000_000, 100_000_000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTempColchon(preset)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        tempColchon === preset
                          ? "bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950 dark:border-indigo-500 dark:text-indigo-300"
                          : "border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {formatPYG(preset)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0 bg-slate-50 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setColchonModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeColchon(tempColchon)
                  setColchonModalOpen(false)
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-all"
              >
                Aplicar y Recalcular
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
