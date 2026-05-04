import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ShoppingBag, Eye, EyeOff, Loader2 } from "lucide-react"
import { useAuth } from "../context/AuthContext"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<"login" | "register">("login")
  const [nombre, setNombre] = useState("")
  const [tenantNombre, setTenantNombre] = useState("")
  const { login, register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (mode === "login") {
        await login(email, password)
      } else {
        if (!nombre || !tenantNombre) {
          setError("Todos los campos son obligatorios")
          setLoading(false)
          return
        }
        await register(email, password, nombre, tenantNombre)
      }
      navigate("/")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al autenticar")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-body-light dark:bg-body-dark p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-dark shadow-xl shadow-primary/30 mb-4">
            <ShoppingBag className="w-8 h-8 text-white" />
          </div>
          <div className="flex items-baseline justify-center gap-0">
            <span className="text-2xl font-bold text-primary-700 dark:text-primary-300">Inteli</span>
            <span className="text-2xl font-bold text-accent">market</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">ERP para comercios en Paraguay</p>
        </div>

        {/* Card */}
        <div className="card p-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
            {mode === "login" ? "Iniciar sesi\u00f3n" : "Crear cuenta"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="input-label">Nombre completo</label>
                <input
                  type="text"
                  className="input-field"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Juan P\u00e9rez"
                />
              </div>
            )}

            <div>
              <label className="input-label">Email</label>
              <input
                type="email"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
              />
            </div>

            <div>
              <label className="input-label">Contrase\u00f1a</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input-field pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="M\u00ednimo 6 caracteres"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === "register" && (
              <div>
                <label className="input-label">Nombre de tu negocio</label>
                <input
                  type="text"
                  className="input-field"
                  value={tenantNombre}
                  onChange={(e) => setTenantNombre(e.target.value)}
                  placeholder="Mi Tienda SA"
                />
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : mode === "login" ? (
                "Iniciar sesi\u00f3n"
              ) : (
                "Crear cuenta"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setMode(mode === "login" ? "register" : "login")
                setError("")
              }}
              className="text-sm text-primary hover:text-primary-dark font-medium"
            >
              {mode === "login"
                ? "\u00bfNo ten\u00e9s cuenta? Registrate"
                : "\u00bfYa ten\u00e9s cuenta? Iniciar sesi\u00f3n"}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
          \u00a9 2026 IntelliHouse Soluciones
        </p>
      </div>
    </div>
  )
}
