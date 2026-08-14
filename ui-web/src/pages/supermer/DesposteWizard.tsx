import { useState } from "react"
import { Scale, CheckCircle2, ChevronRight, AlertTriangle, Coins, TrendingUp } from "lucide-react"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

interface CutYield {
  nombre: string
  pctYield: number // Porcentaje del rendimiento
  precioVenta: number // Gs. por kilo
}

const DEFAULT_CUTS: CutYield[] = [
  { nombre: "Tapa de Cuadril (Picaña)", pctYield: 5, precioVenta: 55000 },
  { nombre: "Lomo de Ternera", pctYield: 8, precioVenta: 62000 },
  { nombre: "Costilla Alta", pctYield: 15, precioVenta: 34000 },
  { nombre: "Vacío de Primera", pctYield: 12, precioVenta: 42000 },
  { nombre: "Peceto", pctYield: 6, precioVenta: 48000 },
  { nombre: "Bola de Lomo", pctYield: 18, precioVenta: 38000 },
  { nombre: "Carnaza Negra / Molida", pctYield: 20, precioVenta: 32000 },
  { nombre: "Grasa & Mermas de Hueso", pctYield: 16, precioVenta: 2000 }
]

export default function DesposteWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1)
  const [carcassWeight, setCarcassWeight] = useState("220") // 220 kg carcass weight
  const [costPerKg, setCostPerKg] = useState("25000") // 25.000 Gs. cost per kg wholesale
  const [cuts, setCuts] = useState<CutYield[]>(DEFAULT_CUTS)
  const toast = useToast()

  const totalCost = Number(carcassWeight) * Number(costPerKg)

  // Calculate yield distributions
  const calculatedCuts = cuts.map(cut => {
    const qtyKg = Number((Number(carcassWeight) * cut.pctYield / 100).toFixed(2))
    const totalRev = qtyKg * cut.precioVenta
    // Allocate proportional cost based on yield
    const allocatedCost = Number((totalCost * cut.pctYield / 100).toFixed(0))
    const profit = totalRev - allocatedCost
    const marginPct = totalRev > 0 ? (profit / totalRev) * 100 : 0
    return {
      ...cut,
      qtyKg,
      totalRev,
      allocatedCost,
      profit,
      marginPct
    }
  })

  const totalRevenue = calculatedCuts.reduce((sum, c) => sum + c.totalRev, 0)
  const totalWeightAlloc = calculatedCuts.reduce((sum, c) => sum + c.qtyKg, 0)
  const netProfit = totalRevenue - totalCost
  const globalMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

  const handleUpdatePct = (index: number, val: number) => {
    setCuts(cuts.map((c, i) => i === index ? { ...c, pctYield: Math.max(0, val) } : c))
  }

  const handleUpdatePrice = (index: number, val: number) => {
    setCuts(cuts.map((c, i) => i === index ? { ...c, precioVenta: Math.max(0, val) } : c))
  }

  const handleFinishDesposte = () => {
    toast.info("Calculo guardado", "Esto calcula rendimiento y margen por corte, pero todavia no actualiza el stock real -- cargá los cortes resultantes como una recepcion o ajuste de inventario manual.")
    onClose()
  }

  const totalPct = cuts.reduce((sum, c) => sum + c.pctYield, 0)

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Scale className="w-5 h-5 text-primary" />
          Proceso de Desintegración y Desposte de Carnes (Carcass Processing)
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white font-bold text-xs">Cerrar Asistente</button>
      </div>

      {/* Step Indicator */}
      <div className="flex gap-4 items-center justify-center text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-slate-800/40 pb-4">
        <span className={step === 1 ? "text-primary" : "text-green-500"}>1. Materia Prima</span>
        <ChevronRight className="w-4 h-4" />
        <span className={step === 2 ? "text-primary" : step > 2 ? "text-green-500" : ""}>2. Distribución de Cortes</span>
        <ChevronRight className="w-4 h-4" />
        <span className={step === 3 ? "text-primary" : ""}>3. Márgenes y Confirmación</span>
      </div>

      {step === 1 && (
        <div className="space-y-6 max-w-md mx-auto py-4">
          <div className="space-y-4">
            <div>
              <label className="input-label label-required">Peso de la Media Res (kilogramos)</label>
              <input type="number" className="input-field text-xl font-mono text-center py-3" value={carcassWeight} onChange={e => setCarcassWeight(e.target.value)} required />
            </div>
            <div>
              <label className="input-label label-required">Costo Mayorista por Kilogramo (Guaraníes)</label>
              <input type="number" className="input-field text-xl font-mono text-center py-3" value={costPerKg} onChange={e => setCostPerKg(e.target.value)} required />
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center font-mono">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Costo Total de la Pieza</span>
            <p className="text-2xl font-extrabold text-green-400 mt-1">{formatPYG(totalCost)}</p>
          </div>

          <button onClick={() => setStep(2)} className="w-full btn-primary py-3 font-bold text-sm flex items-center justify-center gap-2">
            Configurar Rendimiento <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between">
              <span className="text-gray-400">Total a distribuir:</span>
              <span className="font-bold text-white font-mono">{carcassWeight} kg</span>
            </div>
            <div className={`bg-slate-950 p-4 rounded-xl border flex justify-between ${
              totalPct === 100 ? "border-green-500/20 text-green-500" : "border-amber-500/20 text-amber-500"
            }`}>
              <span className="text-gray-400">Porcentaje Asignado:</span>
              <span className="font-bold font-mono">{totalPct}% / 100%</span>
            </div>
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
            {cuts.map((cut, index) => (
              <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-slate-950 rounded-xl gap-2 text-xs">
                <span className="font-bold text-gray-200 min-w-[200px]">{cut.nombre}</span>
                <div className="flex gap-4 w-full sm:w-auto">
                  <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                    <span className="text-gray-500 font-bold">Rendimiento:</span>
                    <input type="number" className="input-field w-16 text-center py-1 font-mono text-xs" value={cut.pctYield} onChange={e => handleUpdatePct(index, parseFloat(e.target.value) || 0)} min={0} max={100} />
                    <span className="text-gray-400">%</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                    <span className="text-gray-500 font-bold">Venta / kg:</span>
                    <input type="number" className="input-field w-24 text-right py-1 font-mono text-xs" value={cut.precioVenta} onChange={e => handleUpdatePrice(index, parseFloat(e.target.value) || 0)} min={0} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPct !== 100 && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 p-3 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Asegúrate de ajustar los rendimientos para sumar exactamente el **100%** de la pieza de res antes de avanzar.</span>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button onClick={() => setStep(1)} className="btn-outline flex-1">Volver</button>
            <button 
              onClick={() => setStep(3)} 
              disabled={totalPct !== 100}
              className="btn-primary flex-1 font-bold text-sm"
            >
              Calcular Márgenes & Costos
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          
          {/* Global Profit KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-4 bg-slate-950/60 border border-slate-800 text-xs">
              <div className="flex items-center gap-2 mb-1"><Coins className="w-4 h-4 text-primary" /><span className="text-gray-400 font-bold uppercase tracking-wider">Costo de Res</span></div>
              <p className="text-lg font-bold font-mono text-white">{formatPYG(totalCost)}</p>
            </div>
            <div className="card p-4 bg-slate-950/60 border border-slate-800 text-xs">
              <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-green-500" /><span className="text-gray-400 font-bold uppercase tracking-wider">Venta Estimada</span></div>
              <p className="text-lg font-bold font-mono text-green-400">{formatPYG(totalRevenue)}</p>
            </div>
            <div className="card p-4 bg-slate-950/60 border border-slate-800 text-xs">
              <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="w-4 h-4 text-sky-500" /><span className="text-gray-400 font-bold uppercase tracking-wider">Margen Neto Global</span></div>
              <p className="text-lg font-bold font-mono text-sky-400">{formatPYG(netProfit)} ({globalMargin.toFixed(1)}%)</p>
            </div>
          </div>

          {/* Cuts distribution results */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="table-header border-b border-slate-800">
                  <th className="table-cell text-left pb-2">Corte Comercial</th>
                  <th className="table-cell text-right pb-2">Rendimiento (kg)</th>
                  <th className="table-cell text-right pb-2">Costo Asignado</th>
                  <th className="table-cell text-right pb-2">Venta / kg</th>
                  <th className="table-cell text-right pb-2">Margen Neto</th>
                  <th className="table-cell text-right pb-2">Margen %</th>
                </tr>
              </thead>
              <tbody>
                {calculatedCuts.map((c, index) => (
                  <tr key={index} className="table-row border-b border-slate-800/40">
                    <td className="table-td py-3 font-semibold text-gray-200">{c.nombre}</td>
                    <td className="table-td text-right font-bold font-mono text-white">{c.qtyKg} kg ({c.pctYield}%)</td>
                    <td className="table-td text-right font-mono text-gray-400">{formatPYG(c.allocatedCost)}</td>
                    <td className="table-td text-right font-mono text-green-400 font-bold">{formatPYG(c.precioVenta)}</td>
                    <td className={`table-td text-right font-mono font-bold ${c.profit >= 0 ? "text-green-500" : "text-red-400"}`}>
                      {formatPYG(c.profit)}
                    </td>
                    <td className={`table-td text-right font-mono font-bold ${c.marginPct >= 15 ? "text-green-500" : "text-amber-500"}`}>
                      {c.marginPct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-800/50">
            <button onClick={() => setStep(2)} className="btn-outline flex-1">Atrás</button>
            <button 
              onClick={handleFinishDesposte}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-all shadow-md flex-1 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" /> Finalizar Calculo de Rendimiento
            </button>
          </div>

        </div>
      )}
    </div>
  )
}
