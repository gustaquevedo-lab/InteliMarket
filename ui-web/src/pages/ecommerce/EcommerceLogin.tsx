import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Store } from "lucide-react"
import { ecommerceApi } from "../../api/ecommerce"

export default function EcommerceLogin() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError("")
    try {
      const data = await ecommerceApi.login({ email, password })
      localStorage.setItem("ecommerce_token", data.access_token)
      navigate("/tienda/dashboard")
    } catch { setError("Credenciales inválidas") }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Store className="w-12 h-12 text-blue-600 mx-auto mb-2" />
          <h1 className="text-lg sm:text-xl xl:text-xl 2xl:text-2xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">InteliMarket</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Tienda Online B2B — Accedé a tu cuenta</p>
        </div>
        <form onSubmit={handleLogin} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 space-y-5">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Iniciar Sesión</h2>
          {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50">
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
          <p className="text-center text-sm text-gray-500">
            ¿No tenés cuenta?{" "}
            <Link to="/tienda/registro" className="text-blue-600 hover:underline">Registrate</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
