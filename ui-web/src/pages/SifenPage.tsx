import { useState } from "react"
import { FileText, CheckCircle, XCircle, Search, Loader2, Shield } from "lucide-react"

export default function SifenPage() {
  const [cdc, setCdc] = useState("")
  const [queryResult, setQueryResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleQuery = async () => {
    if (!cdc || cdc.length !== 44) {
      setError("El CDC debe tener 44 caracteres")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/v1/sifen/cdc/${cdc}`)
      if (!res.ok) {
        const data = await res.json()
        setError(data.detail || "CDC no encontrado")
        setQueryResult(null)
      } else {
        const data = await res.json()
        setQueryResult(data)
      }
    } catch {
      setError("Error consultando SIFEN")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-accent" />
          Facturaci\u00f3n Electr\u00f3nica
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gesti\u00f3n SIFEN / e-Kuatia</p>
      </div>

      {/* CDC Query */}
      <div className="card p-6">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Search className="w-4 h-4 text-primary" />
          Consultar CDC
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            className="input-field flex-1 font-mono text-sm"
            placeholder="Ingres\u00e1 el CDC de 44 caracteres"
            value={cdc}
            onChange={(e) => setCdc(e.target.value.toUpperCase())}
            maxLength={44}
          />
          <button onClick={handleQuery} disabled={loading} className="btn-primary">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Consultar"}
          </button>
        </div>
        {error && (
          <div className="mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
        {queryResult && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 rounded-xl">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Estado:</span>
                <span className="ml-2 font-bold text-green-700 dark:text-green-400">
                  {queryResult.estado}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">RUC Emisor:</span>
                <span className="ml-2 font-mono font-bold">{queryResult.ruc_emisor}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Tipo:</span>
                <span className="ml-2 font-bold">{queryResult.tipo_de}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Total:</span>
                <span className="ml-2 font-mono font-bold">\u20b2 {queryResult.total}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <FileText className="w-5 h-5 text-primary" />
            <h4 className="text-sm font-bold">Timbrados</h4>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">3</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">Activos</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle className="w-5 h-5 text-secondary" />
            <h4 className="text-sm font-bold">Aprobadas</h4>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">1.456</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">Este mes</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <XCircle className="w-5 h-5 text-red-500" />
            <h4 className="text-sm font-bold">Rechazadas</h4>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">3</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">Este mes</p>
        </div>
      </div>
    </div>
  )
}
