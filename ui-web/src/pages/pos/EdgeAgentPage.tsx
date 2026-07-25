import { useState, useEffect } from "react"
import { Cpu, Scale, Printer, Monitor, RefreshCw, Send, CheckCircle2, AlertCircle, Wifi } from "lucide-react"
import { useToast } from "../../context/ToastContext"

export default function EdgeAgentPage() {
  const [isConnected, setIsConnected] = useState(true)
  const [latency, setLatency] = useState(3) // 3ms!
  const [vfdText, setVfdText] = useState("¡BIENVENIDO!")
  const [logs, setLogs] = useState<string[]>([
    "EdgeAgent v1.4.2 iniciado en puerto local 8089.",
    "Buscando puertos COM...",
    "Báscula Dialog 06 detectada en COM3 (9600 bps).",
    "Impresora Térmica detectada en USB001.",
    "Cajón monedero listo para pulso (24V)."
  ])
  const [weight, setWeight] = useState(0.0)
  const [isStable, setIsStable] = useState(true)
  const [testPrintActive, setTestPrintActive] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const toast = useToast()

  // Auto simulate fluctuations in weight if scale is online
  useEffect(() => {
    const timer = setInterval(() => {
      if (Math.random() > 0.7) {
        setIsStable(false)
        const diff = (Math.random() - 0.5) * 0.15
        setWeight(prev => Math.max(0, Number((prev + diff).toFixed(3))))
        setTimeout(() => setIsStable(true), 600)
      }
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString()
    setLogs(prev => [`[${time}] ${msg}`, ...prev.slice(0, 15)])
  }

  const handleTestPrint = () => {
    setTestPrintActive(true)
    addLog("Comando ESC/POS enviado a USB001: 'Prueba de impresión de cabezal'.")
    setTimeout(() => {
      setTestPrintActive(false)
      toast.success("Impresión Completada", "Ticket de prueba impreso correctamente.")
    }, 1500)
  }

  const handleOpenDrawer = () => {
    setDrawerOpen(true)
    addLog("Pulso enviado: OUT: Drawer 1 (Pin 2 RJ11).")
    toast.success("Cajón Abierto", "Se envió pulso de apertura física de 24V.")
    setTimeout(() => setDrawerOpen(false), 2000)
  }

  const handleUpdateVFD = () => {
    addLog(`Mensaje del Polo Display VFD actualizado a: '${vfdText.toUpperCase()}'`)
    toast.success("Visor Actualizado", "Se envió texto al display bidireccional.")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Cpu className="w-6 h-6 text-primary" />
            Configuración de Agente de Hardware Local (Edge Integrator)
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Conexión local de latencia ultrabaja para operar periféricos físicos de caja registradora.
          </p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${
          isConnected ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
        }`}>
          <Wifi className="w-4 h-4 animate-pulse" />
          {isConnected ? `Agente Conectado (${latency}ms)` : "Agente Desconectado"}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Hardware Status Panel */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Báscula Dialog 06 */}
            <div className="card p-6 space-y-4">
              <h3 className="text-md font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-primary" />
                Báscula Serial (COM3)
              </h3>
              <div className="bg-slate-950 p-4 rounded-xl text-center relative overflow-hidden border border-slate-800">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Peso Actual</span>
                <p className="text-5xl font-extrabold font-mono text-green-400 my-2">
                  {weight.toFixed(3)} <span className="text-xl">kg</span>
                </p>
                <div className="flex justify-center gap-4 text-[10px] font-bold">
                  <span className={isStable ? "text-green-500" : "text-amber-500 animate-pulse"}>
                    {isStable ? "● ESTABLE" : "○ FLUIDO"}
                  </span>
                  <span className="text-gray-500">PROTOCOLO: DIALOG 06</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setWeight(1.450)
                    addLog("Simulación de báscula: Ajustado peso de tara a 1.450 kg.")
                  }}
                  className="btn-outline flex-1 text-xs py-1.5"
                >
                  Fijar 1.45 kg
                </button>
                <button 
                  onClick={() => {
                    setWeight(0)
                    addLog("Simulación de báscula: Balanza puesta a cero.")
                  }}
                  className="btn-outline flex-1 text-xs py-1.5"
                >
                  Poner a Cero
                </button>
              </div>
            </div>

            {/* Impresora & Cajón */}
            <div className="card p-6 space-y-4">
              <h3 className="text-md font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Printer className="w-5 h-5 text-green-500" />
                Ticket & Cajón (USB001)
              </h3>
              
              <div className="space-y-2">
                <button 
                  onClick={handleTestPrint}
                  disabled={testPrintActive}
                  className="w-full btn-primary py-2.5 flex items-center justify-center gap-2 text-xs"
                >
                  <Printer className="w-4 h-4" />
                  {testPrintActive ? "Imprimiendo..." : "Imprimir Ticket de Prueba"}
                </button>
                <button 
                  onClick={handleOpenDrawer}
                  className={`w-full py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    drawerOpen ? "bg-amber-500/10 border-amber-500 text-amber-500" : "btn-outline"
                  }`}
                >
                  <RefreshCw className="w-4 h-4" />
                  Abrir Cajón (Pulso 24V)
                </button>
              </div>
            </div>

          </div>

          {/* Visor de Cliente Secundario (Pole Display) */}
          <div className="card p-6 space-y-4">
            <h3 className="text-md font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Monitor className="w-5 h-5 text-sky-500" />
              Visor de Cliente Bidireccional (VFD)
            </h3>
            <div className="bg-slate-900 p-4 rounded-xl border border-sky-500/20">
              <div className="font-mono text-xl text-sky-400 bg-black/50 p-3 rounded border border-sky-950 text-center tracking-widest uppercase">
                {vfdText || "INTELIMARKET RETAIL"}
              </div>
            </div>
            <div className="flex gap-2">
              <input 
                className="input-field flex-1" 
                placeholder="Mensaje para el cliente (Máx. 20 car.)" 
                value={vfdText} 
                onChange={e => setVfdText(e.target.value.substring(0, 20))}
              />
              <button onClick={handleUpdateVFD} className="btn-primary px-5 py-2 text-xs flex items-center gap-2">
                <Send className="w-4 h-4" /> Enviar
              </button>
            </div>
          </div>

        </div>

        {/* Panel de Consola & Logs */}
        <div className="lg:col-span-1">
          <div className="card p-5 space-y-4 h-full flex flex-col border border-gray-200 dark:border-gray-800">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Consola del Agente Edge</h3>
            
            <div className="flex-1 bg-slate-950 p-4 rounded-xl font-mono text-[11px] text-green-400 space-y-2 overflow-y-auto max-h-[360px] border border-slate-800">
              {logs.map((log, index) => (
                <div key={index} className="leading-relaxed whitespace-pre-wrap">
                  {log}
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex justify-between text-xs text-gray-500">
              <span>DRIVER: WinUSB-POS</span>
              <button 
                onClick={() => {
                  setLogs([])
                  addLog("Consola limpia.")
                }}
                className="text-primary hover:underline"
              >
                Limpiar Logs
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
