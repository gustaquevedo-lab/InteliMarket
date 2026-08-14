import { Cpu, Scale, Printer, Monitor, Wifi, WifiOff, Info } from "lucide-react"

export default function EdgeAgentPage() {
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
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-red-500/10 text-red-500">
          <WifiOff className="w-4 h-4" />
          Agente no conectado
        </div>
      </div>

      <div className="card p-10 text-center space-y-3">
        <Info className="w-8 h-8 text-primary mx-auto" />
        <p className="text-sm font-bold text-gray-900 dark:text-white">Esta pantalla mostraba hardware conectado que nunca existió</p>
        <p className="text-sm text-gray-500 max-w-lg mx-auto">
          Antes simulaba una báscula, impresora y cajón conectados con datos inventados (peso fluctuando solo, logs de puertos detectados que nunca se buscaron). No hay ningún agente local corriendo hoy — eso requiere una app aparte instalada en la PC de cada caja, que hable el protocolo serial real de la báscula (Balmak BCK30) y del resto del hardware. Está identificado en el plan como parte de PDV offline, todavía sin arrancar.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 opacity-50">
        <div className="card p-5 space-y-2">
          <div className="flex items-center gap-2 text-gray-400"><Scale className="w-4 h-4" /><span className="text-xs font-bold uppercase tracking-wider">Báscula</span></div>
          <p className="text-xs text-gray-400">Sin conexión</p>
        </div>
        <div className="card p-5 space-y-2">
          <div className="flex items-center gap-2 text-gray-400"><Printer className="w-4 h-4" /><span className="text-xs font-bold uppercase tracking-wider">Impresora / Cajón</span></div>
          <p className="text-xs text-gray-400">Sin conexión</p>
        </div>
        <div className="card p-5 space-y-2">
          <div className="flex items-center gap-2 text-gray-400"><Monitor className="w-4 h-4" /><span className="text-xs font-bold uppercase tracking-wider">Visor de cliente</span></div>
          <p className="text-xs text-gray-400">Sin conexión</p>
        </div>
      </div>
    </div>
  )
}
