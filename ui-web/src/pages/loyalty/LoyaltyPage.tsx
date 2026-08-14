import { useNavigate } from "react-router-dom"
import { Award, ExternalLink } from "lucide-react"

export default function LoyaltyPage() {
  const navigate = useNavigate()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Award className="w-6 h-6 text-primary" />
          Programa de Fidelización
        </h1>
      </div>
      <div className="card p-10 text-center space-y-3">
        <ExternalLink className="w-8 h-8 text-primary mx-auto" />
        <p className="text-sm font-bold text-gray-900 dark:text-white">Esta pantalla estaba duplicada y rota</p>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Puntos, recompensas y configuración del programa de fidelidad ya viven en Fidelidad &amp; CRM, conectados a datos reales.
        </p>
        <button className="btn-primary mx-auto" onClick={() => navigate("/crm")}><ExternalLink className="w-4 h-4" /> Ir a Fidelidad &amp; CRM</button>
      </div>
    </div>
  )
}
