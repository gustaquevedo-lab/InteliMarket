import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Eye, EyeOff, Loader2, User as UserIcon, ArrowLeft, ShieldCheck, Zap, RefreshCw } from "lucide-react"

import { useAuth } from "../context/AuthContext"
import { useToast } from "../context/ToastContext"
import { api } from "../api"
import { InteliMarketIsotypeWhite } from "../components/Logo"

interface PosStaffMember {
  id: string
  email: string
  nombre: string
  rol: string
  foto_url?: string | null
  en_turno: boolean
}

const POS_ALLOWED_ROLES = ["cajero", "supervisor"]

// Orbs animados para el fondo
function BackgroundOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Gradiente base oscuro */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#050d1f] via-[#091633] to-[#0a0d2e]" />

      {/* Orb 1 - azul primario grande */}
      <div
        className="absolute rounded-full opacity-40 blur-[120px]"
        style={{
          width: "700px", height: "700px",
          background: "radial-gradient(circle, #1e4db7 0%, #0d2a6e 60%, transparent 100%)",
          top: "-200px", left: "-150px",
          animation: "orb1 18s ease-in-out infinite alternate",
        }}
      />
      {/* Orb 2 - emerald */}
      <div
        className="absolute rounded-full opacity-30 blur-[100px]"
        style={{
          width: "500px", height: "500px",
          background: "radial-gradient(circle, #059669 0%, #064e3b 60%, transparent 100%)",
          bottom: "-100px", right: "-100px",
          animation: "orb2 22s ease-in-out infinite alternate",
        }}
      />
      {/* Orb 3 - indigo accent */}
      <div
        className="absolute rounded-full opacity-25 blur-[140px]"
        style={{
          width: "400px", height: "400px",
          background: "radial-gradient(circle, #6366f1 0%, #312e81 60%, transparent 100%)",
          top: "40%", left: "60%",
          animation: "orb3 26s ease-in-out infinite alternate",
        }}
      />
      {/* Grid overlay sutil */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <style>{`
        @keyframes orb1 {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(80px, 60px) scale(1.1); }
          100% { transform: translate(-40px, 40px) scale(0.95); }
        }
        @keyframes orb2 {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(-60px, -80px) scale(1.15); }
          100% { transform: translate(40px, -30px) scale(0.9); }
        }
        @keyframes orb3 {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(-50px, 70px) scale(1.2); }
          100% { transform: translate(30px, -50px) scale(0.85); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .glass-card {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.05) inset,
            0 24px 64px rgba(0, 0, 0, 0.5),
            0 8px 24px rgba(0, 0, 0, 0.3);
        }
        .glass-input {
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(8px);
          color: #f1f5f9;
          transition: all 0.2s ease;
        }
        .glass-input::placeholder { color: rgba(148, 163, 184, 0.6); }
        .glass-input:focus {
          outline: none;
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(99, 102, 241, 0.6);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15), 0 0 20px rgba(99, 102, 241, 0.1);
        }
        .glass-btn {
          background: linear-gradient(135deg, #1e4db7 0%, #6366f1 100%);
          box-shadow: 0 8px 32px rgba(99, 102, 241, 0.4), 0 2px 8px rgba(0,0,0,0.3);
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }
        .glass-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%);
        }
        .glass-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 40px rgba(99, 102, 241, 0.5), 0 4px 12px rgba(0,0,0,0.4);
        }
        .glass-btn:active { transform: translateY(0); }
        .login-form-wrapper {
          animation: fadeInUp 0.6s ease both;
        }
        .logo-glow {
          box-shadow: 0 0 40px rgba(99, 102, 241, 0.5), 0 0 80px rgba(30, 77, 183, 0.3);
        }
        .badge-staff {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(8px);
          transition: all 0.2s ease;
        }
        .badge-staff:hover {
          background: rgba(99, 102, 241, 0.2);
          border-color: rgba(99, 102, 241, 0.4);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.2);
        }
        .badge-staff.selected {
          background: rgba(99, 102, 241, 0.25);
          border-color: rgba(99, 102, 241, 0.6);
        }
        .label-glass {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(148, 163, 184, 0.8);
        }
        .text-gradient {
          background: linear-gradient(135deg, #818cf8 0%, #6366f1 40%, #38bdf8 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .link-glass {
          color: rgba(148, 163, 184, 0.7);
          font-size: 0.8rem;
          font-weight: 600;
          transition: color 0.2s;
        }
        .link-glass:hover { color: #818cf8; }
      `}</style>
    </div>
  )
}

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
  const emailRef = useRef<HTMLInputElement>(null)

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

  const loadStaff = useCallback(() => {
    setPosStaffLoading(true)
    setPosStaffError("")
    api.auth.posStaff()
      .then((res) => {
        setPosStaff(res.staff || [])
        setPosStaffError("")
      })
      .catch((err) => {
        console.error("Error al cargar pos-staff:", err)
        setPosStaffError("No se pudo cargar la lista de personal. Verifique la conexión con el servidor.")
      })
      .finally(() => {
        setPosStaffLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!isElectron) return
    loadStaff()
  }, [isElectron, loadStaff])


  useEffect(() => {
    if (!isElectron) emailRef.current?.focus()
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

  // ── POS / ELECTRON ──────────────────────────────────────────────────────────
  if (isElectron) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <BackgroundOrbs />
        <div className="relative z-10 w-full max-w-2xl login-form-wrapper">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl logo-glow mb-4"
              style={{ background: "linear-gradient(135deg, #1e4db7 0%, #6366f1 100%)" }}>
              <InteliMarketIsotypeWhite className="w-10 h-10" />
            </div>
            <div className="flex items-baseline justify-center gap-0 mb-1">
              <span className="text-2xl font-black tracking-tight text-white">Inteli</span>
              <span className="text-2xl font-black tracking-tight text-gradient">market</span>
            </div>
            <p className="text-sm text-slate-400 font-medium">Punto de Venta</p>
          </div>

          <div className="glass-card rounded-3xl p-8">
            {!selectedStaff ? (
              <>
                <h2 className="text-xl font-bold text-white mb-1">¿Quién va a atender la caja?</h2>
                <p className="text-sm text-slate-400 mb-6 font-medium">Elegí tu nombre de la lista para iniciar tu turno.</p>

                {posStaffLoading && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                  </div>
                )}
                {!posStaffLoading && posStaffError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
                    <p className="text-sm text-red-300 mb-3">{posStaffError}</p>
                    <button
                      type="button"
                      onClick={loadStaff}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 mx-auto"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Reintentar Carga de Personal
                    </button>
                  </div>
                )}

                {!posStaffLoading && !posStaffError && posStaff.length === 0 && (
                  <div className="text-center text-sm text-slate-400 py-12">
                    No hay cajeros ni supervisores cargados todavía. Pedile a un administrador que te dé de alta.
                  </div>
                )}
                {!posStaffLoading && posStaff.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {posStaff.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => { setSelectedStaff(s); setPosPassword(""); setPosError("") }}
                        className="badge-staff flex flex-col items-center gap-2 p-4 rounded-2xl cursor-pointer"
                      >
                        <div className="relative w-14 h-14 rounded-full overflow-hidden"
                          style={{ background: "linear-gradient(135deg, #1e4db7, #6366f1)" }}>
                          {s.foto_url ? (
                            <img src={s.foto_url} alt={s.nombre} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <UserIcon className="w-7 h-7 text-white" />
                            </div>
                          )}
                          {s.en_turno && (
                            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#091633]" title="En turno" />
                          )}
                        </div>
                        <span className="text-sm font-bold text-white text-center leading-tight">{s.nombre}</span>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          s.rol === "supervisor"
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        }`}>
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
                  className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 font-semibold mb-5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Cambiar
                </button>

                <div className="flex items-center gap-3 mb-7 p-3.5 rounded-2xl"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div className="w-11 h-11 rounded-full overflow-hidden shrink-0"
                    style={{ background: "linear-gradient(135deg, #1e4db7, #6366f1)" }}>
                    {selectedStaff.foto_url ? (
                      <img src={selectedStaff.foto_url} alt={selectedStaff.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <UserIcon className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white leading-tight">{selectedStaff.nombre}</h2>
                    <span className="text-xs text-slate-400 capitalize font-medium">{selectedStaff.rol}</span>
                  </div>
                </div>

                <form onSubmit={handlePosLogin} className="space-y-4">
                  <div>
                    <label className="label-glass block mb-1.5">Contraseña</label>
                    <div className="relative">
                      <input
                        type={posShowPassword ? "text" : "password"}
                        className="glass-input w-full rounded-xl px-4 py-3 pr-11 text-sm font-medium"
                        value={posPassword}
                        onChange={(e) => setPosPassword(e.target.value)}
                        autoFocus
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setPosShowPassword(!posShowPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        {posShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {posError && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300 font-medium">
                      {posError}
                    </div>
                  )}

                  <button type="submit" disabled={posLoading}
                    className="glass-btn w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
                    {posLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ShieldCheck className="w-4 h-4" /> Iniciar turno</>}
                  </button>
                </form>
              </>
            )}
          </div>

          <p className="text-center text-xs text-slate-600 mt-6 font-medium">
            © 2026 IntelliHouse Soluciones
          </p>
        </div>
      </div>
    )
  }

  // ── WEB LOGIN ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen relative flex items-center justify-center p-4" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <BackgroundOrbs />

      <div className="relative z-10 w-full max-w-md login-form-wrapper">

        {/* Logo + Brand */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-3xl logo-glow mb-5"
            style={{ background: "linear-gradient(135deg, #1e4db7 0%, #6366f1 60%, #38bdf8 100%)" }}
          >
            <InteliMarketIsotypeWhite className="w-12 h-12" />
          </div>

          <h1 className="text-3xl font-black text-white mb-1 tracking-tight">
            Inteli<span className="text-gradient">market</span>
          </h1>
          <p className="text-sm text-slate-400 font-medium">ERP para comercios en Paraguay</p>
        </div>

        {/* Glass Card */}
        <div className="glass-card rounded-3xl p-8">

          {/* Título del formulario */}
          <div className="mb-7">
            <h2 className="text-xl font-extrabold text-white">
              {mode === "login" ? "Bienvenido de vuelta" : "Crear cuenta nueva"}
            </h2>
            <p className="text-sm text-slate-400 mt-1 font-medium">
              {mode === "login"
                ? "Ingresá tus credenciales para acceder"
                : "Completá los datos para comenzar"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "register" && (
              <div>
                <label className="label-glass block mb-1.5">Nombre completo</label>
                <input
                  type="text"
                  className="glass-input w-full rounded-xl px-4 py-3 text-sm font-medium"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Juan Pérez"
                />
              </div>
            )}

            <div>
              <label className="label-glass block mb-1.5">Email</label>
              <input
                ref={emailRef}
                type="email"
                className="glass-input w-full rounded-xl px-4 py-3 text-sm font-medium"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="label-glass block mb-1.5">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="glass-input w-full rounded-xl px-4 py-3 pr-11 text-sm font-medium"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === "register" && (
              <div>
                <label className="label-glass block mb-1.5">Nombre de tu negocio</label>
                <input
                  type="text"
                  className="glass-input w-full rounded-xl px-4 py-3 text-sm font-medium"
                  value={tenantNombre}
                  onChange={(e) => setTenantNombre(e.target.value)}
                  placeholder="Mi Tienda SA"
                />
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3 text-sm text-red-300 font-semibold">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="glass-btn w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
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

          {/* Switch mode */}
          <div className="mt-6 text-center">
            <button
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError("") }}
              className="link-glass"
            >
              {mode === "login"
                ? "¿No tenés cuenta? Registrate"
                : "¿Ya tenés cuenta? Iniciar sesión"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-600 mt-6 font-medium">
          © 2026 IntelliHouse Soluciones · Extra Supermercado Mayorista
        </p>
      </div>
    </div>
  )
}
