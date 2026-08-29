import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ShoppingBag, Eye, EyeOff, Loader2, Zap, Building2 } from "lucide-react"
import { useAuth } from "../context/AuthContext"

export default function Login() {
  const [email, setEmail] = useState("admin@casagonzalito.py")
  const [cedula, setCedula] = useState("")
  const [password, setPassword] = useState("admin123")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<"login" | "register">("login")
  const [loginTipo, setLoginTipo] = useState<"email" | "cedula">("email")
  const [nombre, setNombre] = useState("")
  const [tenantNombre, setTenantNombre] = useState("")
  const { user, login, loginCedula, register, loginDemo } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true })
    }
  }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (mode === "login") {
        if (loginTipo === "cedula") {
          await loginCedula(cedula, password)
        } else {
          await login(email, password)
        }
      } else {
        if (!nombre || !tenantNombre) {
          setError("Todos los campos son obligatorios")
          setLoading(false)
          return
        }
        await register(email, password, nombre, tenantNombre)
      }
      navigate("/dashboard", { replace: true })
    } catch (err: unknown) {
      console.error("[Login] Error en handleSubmit:", err)
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 shadow-xl shadow-indigo-600/30 mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <div className="flex items-baseline justify-center gap-0">
            <span className="text-2xl font-black text-gray-900 dark:text-white">Inteli</span>
            <span className="text-2xl font-black text-teal-500">Market</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
            Casa Gonzalito — Distribución Mayorista Amambay
          </p>
        </div>

        {/* Card */}
        <div className="card p-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
            {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
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
                  placeholder="Juan Pérez"
                />
              </div>
            )}

            {mode === "login" && (
              <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl mb-1">
                <button
                  type="button"
                  onClick={() => setLoginTipo("email")}
                  className={`flex-1 text-sm font-medium py-1.5 rounded-lg transition ${loginTipo === "email" ? "bg-white dark:bg-gray-700 shadow text-indigo-600 dark:text-indigo-300 font-bold" : "text-gray-500"}`}
                >
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => setLoginTipo("cedula")}
                  className={`flex-1 text-sm font-medium py-1.5 rounded-lg transition ${loginTipo === "cedula" ? "bg-white dark:bg-gray-700 shadow text-indigo-600 dark:text-indigo-300 font-bold" : "text-gray-500"}`}
                >
                  Cédula (vendedores)
                </button>
              </div>
            )}

            {mode === "login" && loginTipo === "cedula" ? (
              <div>
                <label className="input-label">Cédula</label>
                <input
                  type="text"
                  className="input-field"
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value)}
                  placeholder="1234567"
                  required
                />
              </div>
            ) : (
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
            )}

            <div>
              <label className="input-label">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input-field pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
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
                  placeholder="Casa Gonzalito"
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
              className="btn-primary w-full bg-indigo-600 hover:bg-indigo-700 font-bold"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : mode === "login" ? (
                "Iniciar sesión"
              ) : (
                "Crear cuenta"
              )}
            </button>

            <button
              type="button"
              onClick={() => { loginDemo(); navigate("/dashboard", { replace: true }) }}
              className="btn-outline w-full flex items-center justify-center gap-2 border-teal-300 dark:border-teal-700 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 font-bold"
            >
              <Zap className="w-4 h-4" />
              Acceso directo (Casa Gonzalito)
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setMode(mode === "login" ? "register" : "login")
                setError("")
              }}
              className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-medium"
            >
              {mode === "login"
                ? "¿No tenés cuenta? Registrate"
                : "¿Ya tenés cuenta? Iniciar sesión"}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6 font-mono">
          © 2026 InteliMarket • Casa Gonzalito
        </p>
      </div>
    </div>
  )
}
