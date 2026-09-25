import { useState, useEffect, useCallback } from "react"
import {
  Users, Clock, CheckCircle, XCircle, AlertTriangle, TrendingUp,
  DollarSign, ExternalLink, Search, RefreshCw, Activity, Briefcase,
  UserCheck, UserX, Coffee, Fingerprint, ShieldCheck, Camera, X
} from "lucide-react"

// ── Configuración de Integración con SueldOK ──────────────────────────
const SUELDOK_BASE_URL = "https://sueldok.intellihouse.lat"
const SUELDOK_OVERVIEW_URL = `${SUELDOK_BASE_URL}/http/api/intelimarket/overview`
const SUELDOK_SSO_URL = `${SUELDOK_BASE_URL}/http/api/intelimarket/sso-token`

// Llaves de integración por empresa
const EMPRESAS_DISPONIBLES = [
  {
    id: "k177xrnra3m1na7sg640rrm85x8aj62k",
    nombre: "Grupo Santa Teresa E.A.S.",
    ruc: "80150377-9",
    apiKey: "ifk_santateresa_live_api_key_2026",
    relojInfo: "Dahua Facial (192.168.0.122)",
  },
  {
    id: "k17fz2ntbvprjrngkyysgrmb7589m4w7",
    nombre: "Casa Gonzalito S.R.L.",
    ruc: "80005427-0",
    apiKey: "ifk_m953H3eJeBUZj3ITBHtNlLQPbGg-AO8FLberndVxEdE",
    relojInfo: "SueldOK App Mobile",
  },
]

const COLORES_AVATAR = [
  "#6366f1", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b",
  "#10b981", "#3b82f6", "#ef4444", "#84cc16", "#f97316",
]

type TabType = "dashboard" | "asistencia" | "funcionarios"

const estadoConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  presente: { label: "Presente", color: "#10b981", bg: "rgba(16,185,129,0.12)", icon: CheckCircle },
  Late: { label: "Tardanza", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", icon: AlertTriangle },
  tardanza: { label: "Tardanza", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", icon: AlertTriangle },
  absent: { label: "Ausente", color: "#ef4444", bg: "rgba(239,68,68,0.12)", icon: XCircle },
  ausente: { label: "Ausente", color: "#ef4444", bg: "rgba(239,68,68,0.12)", icon: XCircle },
  licencia: { label: "Licencia / Permiso", color: "#60a5fa", bg: "rgba(96,165,250,0.12)", icon: Coffee },
}

function AvatarCircle({ initials, idx, size = 42 }: { initials: string; idx: number; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: COLORES_AVATAR[idx % COLORES_AVATAR.length],
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "white", fontWeight: 900, fontSize: size * 0.36,
      flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
    }}>
      {initials}
    </div>
  )
}

export default function SueldokPage() {
  const [selectedCompany, setSelectedCompany] = useState(EMPRESAS_DISPONIBLES[0])
  const [tab, setTab] = useState<TabType>("dashboard")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [ssoLoading, setSsoLoading] = useState(false)
  const [data, setData] = useState<{
    company?: any
    metrics?: any
    employees?: any[]
    todayAttendance?: any[]
  } | null>(null)
  const [selectedPunchPhoto, setSelectedPunchPhoto] = useState<{
    photoUrl: string
    nombre: string
    hora: string
    status: string
    cargo?: string
  } | null>(null)

  // Carga reactiva de datos desde SueldOK
  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const res = await fetch(`${SUELDOK_OVERVIEW_URL}?apiKey=${selectedCompany.apiKey}`, {
        method: "GET",
        headers: { "Accept": "application/json" }
      })
      if (res.ok) {
        const json = await res.json()
        setData(json)
        setLastUpdated(new Date())
      } else {
        console.error("Error al cargar SueldOK overview:", res.status)
      }
    } catch (err) {
      console.error("Error conectando a SueldOK:", err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedCompany])

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchData(), 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleLaunchSso = async () => {
    setSsoLoading(true)
    try {
      const res = await fetch(SUELDOK_SSO_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${selectedCompany.apiKey}`
        },
        body: JSON.stringify({ redirect: "/attendance" })
      })

      if (res.ok) {
        const json = await res.json()
        if (json.ssoUrl) {
          window.open(json.ssoUrl, "_blank")
          return
        }
      }
      window.open(SUELDOK_BASE_URL, "_blank")
    } catch (err) {
      console.error("Error generando token SSO:", err)
      window.open(SUELDOK_BASE_URL, "_blank")
    } finally {
      setSsoLoading(false)
    }
  }

  const c = {
    bg: "#0a0f1e",
    surface: "#0f172a",
    surfaceAlt: "#1e293b",
    border: "#1e293b",
    borderLight: "rgba(255,255,255,0.08)",
    text: "white",
    muted: "#94a3b8",
    accent: "#6366f1",
    green: "#10b981",
  }

  const metrics = data?.metrics || {
    totalEmployees: 0,
    activeEmployees: 0,
    presentToday: 0,
    lateToday: 0,
    absentToday: 0,
    attendanceRate: 0,
    totalPayroll: 0,
  }

  const employees = data?.employees || []
  const todayAttendance = data?.todayAttendance || []

  const filteredEmployees = employees.filter((e: any) =>
    (e.nombre || "").toLowerCase().includes(search.toLowerCase()) ||
    (e.cargo || "").toLowerCase().includes(search.toLowerCase()) ||
    (e.depto || "").toLowerCase().includes(search.toLowerCase()) ||
    (e.ci || "").includes(search)
  )

  const card = (children: React.ReactNode, style: React.CSSProperties = {}) => (
    <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 20, padding: 20, ...style }}>
      {children}
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* ── HEADER PRINCIPAL ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 54, height: 54, background: "linear-gradient(135deg, #4f46e5, #7c3aed)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 25px rgba(99,102,241,0.4)" }}>
            <Briefcase style={{ width: 28, height: 28, color: "white" }} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ color: "white", fontWeight: 900, fontSize: 24, letterSpacing: "-0.5px", margin: 0 }}>SueldOK · RRHH</h1>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 800 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981" }} />
                En Vivo: {selectedCompany.relojInfo}
              </span>
            </div>
            <p style={{ color: "#a5b4fc", fontSize: 13, fontWeight: 600, marginTop: 4, margin: 0 }}>
              Gestión de Nómina & Asistencia Facial Integrada · {data?.company?.name || selectedCompany.nombre}
            </p>
          </div>
        </div>

        {/* Acciones del Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Selector de Empresa */}
          <select
            value={selectedCompany.id}
            onChange={(e) => {
              const emp = EMPRESAS_DISPONIBLES.find(item => item.id === e.target.value)
              if (emp) setSelectedCompany(emp)
            }}
            style={{
              background: c.surface,
              border: `1px solid ${c.border}`,
              color: "white",
              padding: "10px 14px",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              outline: "none"
            }}
          >
            {EMPRESAS_DISPONIBLES.map(emp => (
              <option key={emp.id} value={emp.id} style={{ background: "#0f172a", color: "white" }}>
                {emp.nombre}
              </option>
            ))}
          </select>

          {/* Botón Refrescar */}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            title="Actualizar datos ahora"
            style={{
              display: "flex", alignItems: "center", gap: 6, background: c.surface, border: `1px solid ${c.border}`,
              color: c.muted, padding: "10px 14px", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            <RefreshCw style={{ width: 15, height: 15, animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            {lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Actualizar"}
          </button>

          {/* Botón Abrir SueldOK con SSO */}
          <button
            onClick={handleLaunchSso}
            disabled={ssoLoading}
            style={{
              display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
              color: "white", padding: "10px 18px", borderRadius: 12, fontWeight: 800, fontSize: 14,
              border: "none", cursor: "pointer", boxShadow: "0 4px 18px rgba(99,102,241,0.35)",
              transition: "transform 0.15s, opacity 0.2s", opacity: ssoLoading ? 0.7 : 1
            }}
          >
            <ExternalLink style={{ width: 16, height: 16 }} />
            {ssoLoading ? "Iniciando SSO..." : "Abrir SueldOK"}
          </button>
        </div>
      </div>

      {/* ── TABS DE NAVEGACIÓN ── */}
      <div style={{ display: "flex", gap: 6, background: c.surface, border: `1px solid ${c.border}`, borderRadius: 14, padding: 6, width: "fit-content" }}>
        {([
          { id: "dashboard", label: "Dashboard Ejecutivo", icon: Activity },
          { id: "asistencia", label: `Marcaciones de Hoy (${todayAttendance.length})`, icon: Clock },
          { id: "funcionarios", label: `Funcionarios (${employees.length})`, icon: Users },
        ] as { id: TabType; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10,
              background: tab === id ? c.accent : "transparent",
              color: tab === id ? "white" : c.muted,
              border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, transition: "all 0.2s"
            }}
          >
            <Icon style={{ width: 15, height: 15 }} />
            {label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD TAB ── */}
      {tab === "dashboard" && (
        <>
          {/* Fila de KPIs Principales */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
            {[
              {
                label: "Funcionarios Activos",
                value: metrics.activeEmployees,
                sub: `Empresa: ${selectedCompany.nombre.split(" ")[0]}`,
                icon: Users,
                color: "#6366f1",
                glow: "rgba(99,102,241,0.15)"
              },
              {
                label: "Presentes Hoy",
                value: metrics.presentToday + metrics.lateToday,
                sub: `${metrics.presentToday} a tiempo · ${metrics.lateToday} tardanzas`,
                icon: UserCheck,
                color: "#10b981",
                glow: "rgba(16,185,129,0.15)"
              },
              {
                label: "Tasa de Asistencia",
                value: `${metrics.attendanceRate}%`,
                sub: `de ${metrics.activeEmployees} funcionarios`,
                icon: TrendingUp,
                color: metrics.attendanceRate > 70 ? "#10b981" : "#f59e0b",
                glow: "rgba(16,185,129,0.15)"
              },
              {
                label: "Ausentes Pendientes",
                value: metrics.absentToday,
                sub: "sin marcación registrada hoy",
                icon: UserX,
                color: "#ef4444",
                glow: "rgba(239,68,68,0.15)"
              },
              {
                label: "Masa Salarial Mensual",
                value: `Gs. ${(metrics.totalPayroll / 1000000).toFixed(1)}M`,
                sub: "nómina bruta activa",
                icon: DollarSign,
                color: "#8b5cf6",
                glow: "rgba(139,92,246,0.15)"
              },
            ].map(({ label, value, sub, icon: Icon, color, glow }) => (
              <div key={label} style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 18, padding: 18, display: "flex", flexDirection: "column", gap: 10, boxShadow: `0 0 20px ${glow}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span style={{ color: c.muted, fontSize: 12, fontWeight: 700 }}>{label}</span>
                  <div style={{ width: 34, height: 34, background: `${color}18`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon style={{ width: 17, height: 17, color }} />
                  </div>
                </div>
                <div style={{ color: "white", fontWeight: 900, fontSize: 26, letterSpacing: "-0.5px" }}>{value}</div>
                <span style={{ color: c.muted, fontSize: 12, fontWeight: 500 }}>{sub}</span>
              </div>
            ))}
          </div>

          {/* Sección de 2 Columnas: Marcaciones en Vivo + Enlace Dahua */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Columna Izquierda: Últimas Marcaciones del Reloj */}
            {card(
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Fingerprint style={{ width: 20, height: 20, color: "#818cf8" }} />
                    <h3 style={{ color: "white", fontWeight: 800, fontSize: 16, margin: 0 }}>Últimas Marcaciones en Vivo</h3>
                  </div>
                  <span style={{ color: c.muted, fontSize: 12 }}>Reloj Facial Dahua</span>
                </div>

                {todayAttendance.length === 0 ? (
                  <div style={{ padding: "30px 20px", textAlign: "center", color: c.muted }}>
                    <Clock style={{ width: 32, height: 32, margin: "0 auto 10px", opacity: 0.4 }} />
                    <p style={{ margin: 0, fontSize: 14 }}>No hay marcaciones registradas todavía en la jornada de hoy.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 380, overflowY: "auto" }}>
                    {todayAttendance.slice(0, 8).map((att: any, idx: number) => {
                      const cfg = estadoConfig[att.status] || estadoConfig.Late
                      const Icon = cfg.icon
                      return (
                        <div key={att.id || idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(30,41,59,0.5)", border: `1px solid ${c.borderLight}`, borderRadius: 12, padding: "10px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ background: "#4f46e5", color: "white", borderRadius: 8, padding: "4px 8px", fontSize: 12, fontWeight: 800, fontFamily: "monospace" }}>
                              {att.horaEntrada || "—"}
                            </div>
                            <div>
                              <p style={{ color: "white", fontWeight: 700, fontSize: 14, margin: 0 }}>{att.nombre}</p>
                              <p style={{ color: c.muted, fontSize: 11, margin: "2px 0 0" }}>{att.cargo} · {att.depto}</p>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, background: cfg.bg, border: `1px solid ${cfg.color}30`, borderRadius: 8, padding: "4px 10px" }}>
                            <Icon style={{ width: 13, height: 13, color: cfg.color }} />
                            <span style={{ color: cfg.color, fontSize: 11, fontWeight: 800 }}>{cfg.label}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Columna Derecha: Estado de la Integración y Hardware */}
            {card(
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <ShieldCheck style={{ width: 20, height: 20, color: "#10b981" }} />
                  <h3 style={{ color: "white", fontWeight: 800, fontSize: 16, margin: 0 }}>Integración y Hardware</h3>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ background: "rgba(30,41,59,0.5)", borderRadius: 14, padding: 14, border: `1px solid ${c.borderLight}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ color: c.muted, fontSize: 12, fontWeight: 600 }}>DISPOSITIVO PRINCIPAL</span>
                      <span style={{ color: "#10b981", fontSize: 12, fontWeight: 800 }}>Online 🟢</span>
                    </div>
                    <p style={{ color: "white", fontWeight: 800, fontSize: 14, margin: 0 }}>Dahua DHI-ASI3214A-W (Facial / Biométrico)</p>
                    <p style={{ color: c.muted, fontSize: 12, margin: "4px 0 0" }}>IP: 192.168.0.122 · Subnet Router Tailscale activo</p>
                  </div>

                  <div style={{ background: "rgba(30,41,59,0.5)", borderRadius: 14, padding: 14, border: `1px solid ${c.borderLight}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ color: c.muted, fontSize: 12, fontWeight: 600 }}>VINCULACIÓN DE PERSONAL</span>
                      <span style={{ color: "#818cf8", fontSize: 12, fontWeight: 800 }}>30 Vinculados</span>
                    </div>
                    <p style={{ color: "white", fontWeight: 800, fontSize: 14, margin: 0 }}>30 de 37 funcionarios cruzados con ID del reloj</p>
                    <p style={{ color: c.muted, fontSize: 12, margin: "4px 0 0" }}>Los rostros marcados en pared ingresan directo a la nómina</p>
                  </div>

                  <div style={{ background: "rgba(30,41,59,0.5)", borderRadius: 14, padding: 14, border: `1px solid ${c.borderLight}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ color: c.muted, fontSize: 12, fontWeight: 600 }}>TOLERANCIA Y JORNADA</span>
                      <span style={{ color: "#f59e0b", fontSize: 12, fontWeight: 800 }}>10 min tolerancia</span>
                    </div>
                    <p style={{ color: "white", fontWeight: 800, fontSize: 14, margin: 0 }}>Entrada: 08:00 · Salida: 18:00</p>
                    <p style={{ color: c.muted, fontSize: 12, margin: "4px 0 0" }}>Cálculo automático de llegadas tardías y horas extras en IPS</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── ASISTENCIA TAB ── */}
      {tab === "asistencia" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ color: "white", fontWeight: 800, fontSize: 18, margin: 0 }}>
              Registro de Marcaciones de Hoy ({todayAttendance.length})
            </h3>
            <span style={{ color: c.muted, fontSize: 13 }}>
              Capturadas vía Reloj Facial Dahua & App SueldOK
            </span>
          </div>

          {todayAttendance.length === 0 ? (
            card(
              <div style={{ textAlign: "center", padding: "40px 20px", color: c.muted }}>
                <Clock style={{ width: 40, height: 40, margin: "0 auto 12px", opacity: 0.4 }} />
                <p style={{ fontSize: 15, margin: 0 }}>No hay marcaciones para mostrar en la fecha actual.</p>
              </div>
            )
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {todayAttendance.map((att: any, idx: number) => {
                const cfg = estadoConfig[att.status] || estadoConfig.Late
                const Icon = cfg.icon
                return (
                  <div
                    key={att.id || idx}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
                      background: c.surface, border: `1px solid ${c.border}`, borderRadius: 16, padding: "14px 20px"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      {(att.checkInPhotoUrl || att.checkOutPhotoUrl) ? (
                        <div 
                          onClick={() => setSelectedPunchPhoto({
                            photoUrl: att.checkInPhotoUrl || att.checkOutPhotoUrl,
                            nombre: att.nombre,
                            hora: att.checkInPhotoUrl ? `Entrada: ${att.horaEntrada}` : `Salida: ${att.horaSalida || "—"}`,
                            status: cfg.label,
                            cargo: `${att.cargo} · ${att.depto}`
                          })}
                          style={{ position: "relative", cursor: "pointer", flexShrink: 0 }}
                          title="Ver foto capturada en el marcador Dahua"
                        >
                          <img 
                            src={att.checkInPhotoUrl || att.checkOutPhotoUrl} 
                            alt={att.nombre}
                            style={{ 
                              width: 44, height: 44, borderRadius: 12, objectFit: "cover",
                              border: "2px solid #818cf8", boxShadow: "0 2px 8px rgba(0,0,0,0.4)"
                            }} 
                          />
                          <div style={{
                            position: "absolute", bottom: -4, right: -4, background: "#4f46e5",
                            borderRadius: "50%", padding: 3, display: "flex", alignItems: "center", justifyContent: "center"
                          }}>
                            <Camera style={{ width: 10, height: 10, color: "white" }} />
                          </div>
                        </div>
                      ) : null}

                      <div style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#818cf8", borderRadius: 10, padding: "6px 12px", fontFamily: "monospace", fontSize: 14, fontWeight: 900 }}>
                        {att.horaEntrada || "—"}
                      </div>
                      <div>
                        <p style={{ color: "white", fontWeight: 800, fontSize: 15, margin: 0 }}>{att.nombre}</p>
                        <p style={{ color: c.muted, fontSize: 12, margin: "3px 0 0" }}>{att.cargo} · {att.depto}</p>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {att.notes && (
                        <span style={{ color: c.muted, fontSize: 12, background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "4px 8px" }}>
                          {att.notes}
                        </span>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, background: cfg.bg, border: `1px solid ${cfg.color}30`, borderRadius: 10, padding: "6px 12px" }}>
                        <Icon style={{ width: 14, height: 14, color: cfg.color }} />
                        <span style={{ color: cfg.color, fontSize: 12, fontWeight: 800 }}>{cfg.label}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── FUNCIONARIOS TAB ── */}
      {tab === "funcionarios" && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ position: "relative", flex: 1, maxWidth: 380 }}>
              <Search style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: c.muted }} />
              <input
                style={{
                  width: "100%", background: c.surface, border: `1px solid ${c.border}`, color: "white",
                  padding: "10px 14px 10px 40px", borderRadius: 12, outline: "none", fontSize: 14, boxSizing: "border-box"
                }}
                placeholder="Buscar funcionario por nombre, CI, cargo…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <span style={{ color: c.muted, fontSize: 13, fontWeight: 600 }}>
              {filteredEmployees.length} de {employees.length} funcionario(s)
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
            {filteredEmployees.map((emp: any, i: number) => {
              const cfg = emp.hoy !== "—" ? (estadoConfig[emp.hoy] || estadoConfig.presente) : null
              return (
                <div
                  key={emp.id || i}
                  style={{
                    background: c.surface, border: `1px solid ${c.border}`, borderRadius: 18, padding: 18,
                    display: "flex", flexDirection: "column", gap: 14
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <AvatarCircle initials={emp.foto || "OK"} idx={i} size={48} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: "white", fontWeight: 800, fontSize: 15, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {emp.nombre}
                      </p>
                      <p style={{ color: c.muted, fontSize: 12, margin: "2px 0 0" }}>
                        CI: {emp.ci || "—"} · {emp.cargo}
                      </p>
                    </div>
                    {emp.biometricId && (
                      <span
                        title={`Enrolado en el Reloj Dahua con ID ${emp.biometricId}`}
                        style={{
                          background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)",
                          borderRadius: 8, padding: "3px 8px", fontSize: 11, fontWeight: 800
                        }}
                      >
                        Dahua #{emp.biometricId}
                      </span>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ background: "rgba(30,41,59,0.5)", borderRadius: 10, padding: "8px 12px" }}>
                      <p style={{ color: c.muted, fontSize: 10, fontWeight: 700, margin: 0 }}>DEPARTAMENTO</p>
                      <p style={{ color: "white", fontSize: 13, fontWeight: 700, margin: "2px 0 0" }}>{emp.depto}</p>
                    </div>
                    <div style={{ background: "rgba(30,41,59,0.5)", borderRadius: 10, padding: "8px 12px" }}>
                      <p style={{ color: c.muted, fontSize: 10, fontWeight: 700, margin: 0 }}>SALARIO BASE</p>
                      <p style={{ color: "#10b981", fontSize: 13, fontWeight: 700, margin: "2px 0 0" }}>
                        Gs. {Number(emp.salario || 0).toLocaleString("es-PY")}
                      </p>
                    </div>
                  </div>

                  {cfg && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: cfg.bg, borderRadius: 10, padding: "8px 12px", border: `1px solid ${cfg.color}30` }}>
                      <cfg.icon style={{ width: 14, height: 14, color: cfg.color }} />
                      <span style={{ color: cfg.color, fontSize: 12, fontWeight: 800 }}>{cfg.label}</span>
                      {emp.entrada && emp.entrada !== "—" && (
                        <span style={{ color: cfg.color, fontSize: 12, fontWeight: 700, marginLeft: "auto" }}>
                          Entrada: {emp.entrada}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Modal Zoom Foto Dahua */}
      {selectedPunchPhoto && (
        <div 
          onClick={() => setSelectedPunchPhoto(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0, 0, 0, 0.85)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: c.surface, border: `1px solid ${c.border}`, borderRadius: 24,
              maxWidth: 420, width: "100%", overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)"
            }}
          >
            <div style={{ position: "relative", width: "100%", aspectRatio: "4/5", background: "#000" }}>
              <img 
                src={selectedPunchPhoto.photoUrl} 
                alt={selectedPunchPhoto.nombre}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
              <button
                onClick={() => setSelectedPunchPhoto(null)}
                style={{
                  position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.6)",
                  border: "none", color: "white", borderRadius: "50%", width: 32, height: 32,
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer"
                }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
              <div style={{
                position: "absolute", bottom: 12, left: 12, background: "rgba(0,0,0,0.7)",
                borderRadius: 8, padding: "4px 8px", display: "flex", alignItems: "center", gap: 6
              }}>
                <Camera style={{ width: 12, height: 12, color: "#818cf8" }} />
                <span style={{ color: "white", fontSize: 11, fontWeight: 700 }}>Foto Reloj Dahua Facial</span>
              </div>
            </div>
            <div style={{ padding: "16px 20px" }}>
              <p style={{ color: "white", fontWeight: 800, fontSize: 16, margin: 0 }}>{selectedPunchPhoto.nombre}</p>
              <p style={{ color: c.muted, fontSize: 13, margin: "4px 0 0" }}>{selectedPunchPhoto.cargo}</p>
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "monospace", color: "#818cf8", fontWeight: 800, fontSize: 14 }}>
                  Hora: {selectedPunchPhoto.hora}
                </span>
                <span style={{ fontSize: 12, color: c.muted }}>Captura Biométrica Verificada</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
