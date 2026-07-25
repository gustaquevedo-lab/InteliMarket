import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Store } from "lucide-react"
import { ecommerceApi } from "../../api/ecommerce"

export default function EcommerceRegister() {
  const [form, setForm] = useState({ customer_id: "", email: "", password: "", nombre: "", telefono: "", direccion_envio: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError("")
    try {
      const data = await ecommerceApi.register(form)
      localStorage.setItem("ecommerce_token", data.access_token)
      navigate("/tienda/dashboard")
    } catch { setError("Error al registrarse. Verificá los datos.") }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <Store className="w-10 h-10 text-blue-600 mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Crear Cuenta</h1>
          <p className="text-sm text-gray-500 mt-1">Registrate para comprar en InteliMarket</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 space-y-4">
          {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-600 text-sm p-3 rounded-lg">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Nombre Completo *</label>
              <input name="nombre" value={form.nombre} onChange={handleChange} required className="input-field w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email *</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} required className="input-field w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contraseña *</label>
              <input type="password" name="password" value={form.password} onChange={handleChange} required className="input-field w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Teléfono</label>
              <input name="telefono" value={form.telefono} onChange={handleChange} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ID Cliente *</label>
              <input name="customer_id" value={form.customer_id} onChange={handleChange} required className="input-field w-full" placeholder="UUID del cliente" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Dirección de Envío</label>
              <textarea name="direccion_envio" value={form.direccion_envio} onChange={handleChange} rows={2} className="input-field w-full" />
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50">
            {loading ? "Registrando..." : "Crear Cuenta"}
          </button>
          <p className="text-center text-sm text-gray-500">
            ¿Ya tenés cuenta? <Link to="/tienda/login" className="text-blue-600 hover:underline">Iniciar Sesión</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
