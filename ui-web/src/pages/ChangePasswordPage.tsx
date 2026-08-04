import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { KeyRound, Loader2 } from "lucide-react"
import { api } from "../api"
import { useAuth } from "../context/AuthContext"

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { user, mustChangePassword, clearMustChangePassword, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) {
    navigate("/login", { replace: true })
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas nuevas no coinciden")
      return
    }
    if (newPassword.length < 6) {
      setError("La contraseña nueva debe tener al menos 6 caracteres")
      return
    }
    setLoading(true)
    try {
      await api.auth.changePassword({ current_password: currentPassword, new_password: newPassword })
      clearMustChangePassword()
      navigate("/dashboard", { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-body-light dark:bg-body-dark p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-dark shadow-xl shadow-primary/30 mb-4">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Cambiá tu contraseña</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {mustChangePassword
              ? "Por seguridad, tenés que definir una contraseña nueva antes de seguir."
              : "Actualizá tu contraseña."}
          </p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="input-label">Contraseña actual</label>
              <input
                type="password"
                className="input-field"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="input-label">Contraseña nueva</label>
              <input
                type="password"
                className="input-field"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <div>
              <label className="input-label">Repetí la contraseña nueva</label>
              <input
                type="password"
                className="input-field"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Cambiar contraseña"}
            </button>

            <button type="button" onClick={() => logout()} className="text-sm text-gray-400 hover:text-gray-600 w-full text-center">
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
