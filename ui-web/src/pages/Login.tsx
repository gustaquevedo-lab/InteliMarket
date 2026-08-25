import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ShoppingBag, Eye, EyeOff, Loader2, User as UserIcon, ArrowLeft, ShieldCheck } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../context/ToastContext"
import { api } from "../api"

interface PosStaffMember {
  id: string
  email: string
  nombre: string
  rol: string
  foto_url?: string | null
  en_turno: boolean
}

const POS_ALLOWED_ROLES = ["cajero", "supervisor"]

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<"login" | "register">("login")
  const [nombre, setNombre] = useState("")
  const [tenantNombre, setTenantNombre] = useState("")
  const { login, register, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const isElectron = typeof window !== "undefined" && !!(window as any).electronAPI

  // ── SELECTOR DE CAJERO/SUPERVISOR PARA ELECTRON (POS) ──────────────────────
  const [posStaff, setPosStaff] = useState<PosStaffMember[]>([])
  const [posStaffLoading, setPosStaffLoading] = useState(isElectron)
  const [posStaffError, setPosStaffError] = useState("")
  const [selectedStaff, setSelectedStaff] = useState<PosStaffMember | null>(null)
  const [posPassword, setPosPassword] = useState("")
  const [posShowPassword, setPosShowPassword] = useState(false)
  const [posError, setPosError] = useState("")
  const [posLoading, setPosLoading] = useState(false)

  useEffect(() => {
    if (!isElectron) return
    let cancelled = false
    setPosStaffLoading(true)
    api.auth.posStaff()
      .then((res) => { if (!cancelled) setPosStaff(res.staff || []) })
      .catch(() => { if (!cancelled) setPosStaffError("No se pudo cargar la lista de personal. Verifique la conexión con el servidor.") })
      .finally(() => { if (!cancelled) setPosStaffLoading(false) })
    return () => { cancelled = true }
  }, [isElectron])

  const handlePosLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStaff) return
    setPosError("")
    setPosLoading(true)
    try {
      await login(selectedStaff.email, posPassword)
      const me = await api.auth.me()
      if (!POS_ALLOWED_ROLES.includes(me.rol)) {
        logout()
        setPosError("Solo cajeros y supervisores pueden ingresar a la caja.")
        setPosLoading(false)
        return
      }
      try {
        await api.auth.startPosShift()
      } catch {
        // Si falla no se bloquea el ingreso a la caja, pero antes quedaba
        // en silencio total: el cajero/supervisor entraba pensando que su
        // turno quedó registrado y recién se enteraba horas después, al
        // necesitar autorizar algo, de que el sistema no lo veía "en
        // turno". Ahora se avisa de una vez para que reintente el login.
        toast.warning(
          "No se pudo registrar el turno",
          "Entró a la caja, pero el sistema no pudo confirmar su turno activo. Si necesita autorizar acciones de supervisor, cierre sesión y vuelva a entrar."
        )
      }
      navigate("/pos")
    } catch (err: unknown) {
      setPosError(err instanceof Error ? err.message : "Contraseña incorrecta")
    } finally {
      setPosLoading(false)
    }
  }

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
      navigate(isElectron ? "/pos" : "/")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al autenticar")
    } finally {
      setLoading(false)
    }
  }

  if (isElectron) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-body-light dark:bg-body-dark p-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-dark shadow-xl shadow-primary/30 mb-4">
              <ShoppingBag className="w-8 h-8 text-white" />
            </div>
            <div className="flex items-baseline justify-center gap-0">
              <span className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-primary-700 dark:text-primary-300">Inteli</span>
              <span className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-accent">market</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Punto de Venta</p>
          </div>

          <div className="card p-8">
            {!selectedStaff ? (
              <>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">¿Quién va a atender la caja?</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Elegí tu nombre de la lista para iniciar tu turno.</p>

                {posStaffLoading && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                )}

                {!posStaffLoading && posStaffError && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400">
                    {posStaffError}
                  </div>
                )}

                {!posStaffLoading && !posStaffError && posStaff.length === 0 && (
                  <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-12">
                    No hay cajeros ni supervisores cargados todavía. Pedile a un administrador que te dé de alta desde Usuarios.
                  </div>
                )}

                {!posStaffLoading && posStaff.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {posStaff.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => { setSelectedStaff(s); setPosPassword(""); setPosError("") }}
                        className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary transition-colors bg-white dark:bg-gray-800"
                      >
                        <div className="relative w-14 h-14 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center overflow-hidden">
                          {s.foto_url ? (
                            <img src={s.foto_url} alt={s.nombre} className="w-full h-full object-cover" />
                          ) : (
                            <UserIcon className="w-7 h-7 text-primary" />
                          )}
                          {s.en_turno && (
                            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-gray-800" title="En turno" />
                          )}
                        </div>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white text-center leading-tight">{s.nombre}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${s.rol === "supervisor" ? "bg-purple-500/15 text-purple-600 dark:text-purple-400" : "bg-blue-500/15 text-blue-600 dark:text-blue-400"}`}>
                          {s.rol}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={() => { setSelectedStaff(null); setPosPassword(""); setPosError("") }}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-4"
                >
                  <ArrowLeft className="w-4 h-4" /> Cambiar
                </button>

                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center overflow-hidden">
                    {selectedStaff.foto_url ? (
                      <img src={selectedStaff.foto_url} alt={selectedStaff.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{selectedStaff.nombre}</h2>
                    <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{selectedStaff.rol}</span>
                  </div>
                </div>

                <form onSubmit={handlePosLogin} className="space-y-4">
                  <div>
                    <label className="input-label">Contraseña</label>
                    <div className="relative">
                      <input
                        type={posShowPassword ? "text" : "password"}
                        className="input-field pr-10"
                        value={posPassword}
                        onChange={(e) => setPosPassword(e.target.value)}
                        autoFocus
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setPosShowPassword(!posShowPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        {posShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {posError && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400">
                      {posError}
                    </div>
                  )}

                  <button type="submit" disabled={posLoading} className="btn-primary w-full flex items-center justify-center gap-2">
                    {posLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ShieldCheck className="w-4 h-4" /> Iniciar turno</>}
                  </button>
                </form>
              </>
            )}
          </div>

          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
            © 2026 IntelliHouse Soluciones
          </p>
        </div>
      </div>
    )
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
            <span className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-primary-700 dark:text-primary-300">Inteli</span>
            <span className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-accent">market</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">ERP para comercios en Paraguay</p>
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
                "Iniciar sesión"
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
                ? "¿No tenés cuenta? Registrate"
                : "¿Ya tenés cuenta? Iniciar sesión"}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
          © 2026 IntelliHouse Soluciones
        </p>
      </div>
    </div>
  )
}
