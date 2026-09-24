import { useNavigate } from "react-router-dom"
import { TrendingUp, ExternalLink } from "lucide-react"

export default function ReplenishmentTab() {
  const navigate = useNavigate()
  return (
    <div className="card p-10 text-center space-y-3">
      <TrendingUp className="w-8 h-8 text-primary mx-auto" />
      <p className="text-sm font-bold text-gray-900 dark:text-white">Esta pestaña duplicaba el módulo real de Reabastecimiento</p>
      <p className="text-sm text-gray-500 max-w-md mx-auto">
        Sugerencias, reglas por producto y cross-docking ahora viven todos juntos en un solo lugar, con los mismos datos reales.
      </p>
      <button className="btn-primary mx-auto" onClick={() => navigate("/auto-replenish")}><ExternalLink className="w-4 h-4" /> Ir a Reabastecimiento Predictivo</button>
    </div>
  )
}
