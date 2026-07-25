import { useState } from "react"
import {
  Users, Clock, CheckCircle, XCircle, AlertTriangle, TrendingUp,
  Calendar, DollarSign, ExternalLink, Search, ChevronRight,
  UserCheck, UserX, Coffee, Home, Activity, Briefcase
} from "lucide-react"

// ── Mock Data ─────────────────────────────────────────────────────────
const EMPLOYEES = [
  { id: "1", nombre: "María González", cargo: "Cajera", depto: "Caja", foto: "MG", salario: 4500000, estado: "activo", hoy: "presente", entrada: "07:52", horasExtras: 2 },
  { id: "2", nombre: "Carlos Rodríguez", cargo: "Carnicero", depto: "Carnicería", foto: "CR", salario: 5200000, estado: "activo", hoy: "presente", entrada: "07:58", horasExtras: 0 },
  { id: "3", nombre: "Ana Martínez", cargo: "Repositora", depto: "Almacén", foto: "AM", salario: 3900000, estado: "activo", hoy: "tardanza", entrada: "09:14", horasExtras: 0 },
  { id: "4", nombre: "Luis Pérez", cargo: "Supervisor", depto: "General", foto: "LP", salario: 7800000, estado: "activo", hoy: "presente", entrada: "07:45", horasExtras: 5 },
  { id: "5", nombre: "Rosa Benítez", cargo: "Panificadora", depto: "Panadería", foto: "RB", salario: 4200000, estado: "activo", hoy: "presente", entrada: "05:30", horasExtras: 1 },
  { id: "6", nombre: "Jorge Álvarez", cargo: "Verdulero", depto: "Verdulería", foto: "JA", salario: 3700000, estado: "activo", hoy: "ausente", entrada: "—", horasExtras: 0 },
  { id: "7", nombre: "Patricia Sosa", cargo: "Cajera", depto: "Caja", foto: "PS", salario: 4500000, estado: "activo", hoy: "presente", entrada: "07:55", horasExtras: 0 },
  { id: "8", nombre: "Roberto Garay", cargo: "Carnicero", depto: "Carnicería", foto: "RG", salario: 5000000, estado: "activo", hoy: "licencia", entrada: "—", horasExtras: 0 },
  { id: "9", nombre: "Sandra Torres", cargo: "Cajera", depto: "Caja", foto: "ST", salario: 4500000, estado: "activo", hoy: "presente", entrada: "08:01", horasExtras: 0 },
  { id: "10", nombre: "Miguel Cabrera", cargo: "Repositor", depto: "Almacén", foto: "MC", salario: 3900000, estado: "activo", hoy: "presente", entrada: "07:48", horasExtras: 3 },
  { id: "11", nombre: "Elena Giménez", cargo: "Supervisora", depto: "Caja", foto: "EG", salario: 6500000, estado: "activo", hoy: "presente", entrada: "07:30", horasExtras: 0 },
  { id: "12", nombre: "Fabio Romero", cargo: "Repartidor", depto: "Logística", foto: "FR", salario: 4100000, estado: "inactivo", hoy: "—", entrada: "—", horasExtras: 0 },
]

const SUELDOK_URL = "https://sueldok.com"

const COLORES_AVATAR = [
  "#6366f1", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b",
  "#10b981", "#3b82f6", "#ef4444", "#84cc16", "#f97316",
]

type TabType = "dashboard" | "asistencia" | "funcionarios"

const estadoConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  presente: { label: "Presente", color: "#10b981", bg: "rgba(16,185,129,0.1)", icon: CheckCircle },
  ausente: { label: "Ausente", color: "#ef4444", bg: "rgba(239,68,68,0.1)", icon: XCircle },
  tardanza: { label: "Tardanza", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", icon: AlertTriangle },
  licencia: { label: "Licencia", color: "#60a5fa", bg: "rgba(96,165,250,0.1)", icon: Coffee },
}

function AvatarCircle({ initials, idx, size = 40 }: { initials: string; idx: number; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: COLORES_AVATAR[idx % COLORES_AVATAR.length],
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "white", fontWeight: 900, fontSize: size * 0.35,
      flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
    }}>
      {initials}
    </div>
  )
}

export default function SueldokPage() {
  const [tab, setTab] = useState<TabType>("dashboard")
  const [search, setSearch] = useState("")

  const activos = EMPLOYEES.filter(e => e.estado === "activo")
  const presentes = activos.filter(e => e.hoy === "presente").length
  const ausentes = activos.filter(e => e.hoy === "ausente").length
  const tardanzas = activos.filter(e => e.hoy === "tardanza").length
  const licencias = activos.filter(e => e.hoy === "licencia").length
  const tasaAsistencia = Math.round((presentes / activos.length) * 100)
  const totalHorasExtras = activos.reduce((s, e) => s + e.horasExtras, 0)
  const masasSalarial = activos.reduce((s, e) => s + e.salario, 0)

  const filtered = EMPLOYEES.filter(e =>
    e.nombre.toLowerCase().includes(search.toLowerCase()) ||
    e.cargo.toLowerCase().includes(search.toLowerCase()) ||
    e.depto.toLowerCase().includes(search.toLowerCase())
  )

  const c = {
    bg: "#0a0f1e",
    surface: "#0f172a",
    border: "#1e293b",
    text: "white",
    muted: "#64748b",
    accent: "#6366f1",
  }

  const card = (children: React.ReactNode, style: React.CSSProperties = {}) => (
    <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 20, padding: 20, ...style }}>
      {children}
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: "system-ui, sans-serif" }}>

      {/* ── HEADER ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 52, height: 52, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 24px rgba(99,102,241,0.4)" }}>
            <Briefcase style={{ width: 26, height: 26, color: "white" }} />
          </div>
          <div>
            <h1 style={{ color: "white", fontWeight: 900, fontSize: 22, letterSpacing: "-0.5px", lineHeight: 1 }}>SueldOK · RRHH</h1>
            <p style={{ color: "#818cf8", fontSize: 12, fontWeight: 600, marginTop: 2 }}>Gestión de Personal · Integrado con InteliMarket</p>
          </div>
        </div>
        <a
          href={SUELDOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", padding: "12px 20px", borderRadius: 14, fontWeight: 800, fontSize: 14, textDecoration: "none", boxShadow: "0 4px 20px rgba(99,102,241,0.4)", transition: "transform 0.2s" }}
        >
          <ExternalLink style={{ width: 16, height: 16 }} />
          Abrir SueldOK
        </a>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: "flex", gap: 6, background: c.surface, border: `1px solid ${c.border}`, borderRadius: 14, padding: 6, width: "fit-content" }}>
        {([
          { id: "dashboard", label: "Dashboard", icon: Activity },
          { id: "asistencia", label: "Asistencia Hoy", icon: Clock },
          { id: "funcionarios", label: "Funcionarios", icon: Users },
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
          {/* KPI Row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
            {[
              { label: "Funcionarios Activos", value: activos.length, sub: `${EMPLOYEES.filter(e => e.estado === "inactivo").length} inactivos`, icon: Users, color: "#6366f1", glow: "rgba(99,102,241,0.2)" },
              { label: "Presentes Hoy", value: presentes, sub: `de ${activos.length} activos`, icon: UserCheck, color: "#10b981", glow: "rgba(16,185,129,0.2)" },
              { label: "Asistencia", value: `${tasaAsistencia}%`, sub: "tasa del día", icon: TrendingUp, color: "#10b981", glow: "rgba(16,185,129,0.2)" },
              { label: "Ausentes", value: ausentes, sub: `${tardanzas} tardanzas`, icon: UserX, color: "#ef4444", glow: "rgba(239,68,68,0.2)" },
              { label: "Licencias", value: licencias, sub: "activas hoy", icon: Coffee, color: "#60a5fa", glow: "rgba(96,165,250,0.2)" },
              { label: "Hs. Extras Hoy", value: totalHorasExtras, sub: "horas acumuladas", icon: Clock, color: "#f59e0b", glow: "rgba(245,158,11,0.2)" },
            ].map(({ label, value, sub, icon: Icon, color, glow }) => (
              <div key={label} style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 18, padding: 18, display: "flex", flexDirection: "column", gap: 10, boxShadow: `0 0 20px ${glow}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <p style={{ color: c.muted, fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>{label}</p>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: glow, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon style={{ width: 18, height: 18, color }} />
                  </div>
                </div>
                <p style={{ color, fontWeight: 900, fontSize: 30, letterSpacing: "-1px", lineHeight: 1 }}>{value}</p>
                <p style={{ color: c.muted, fontSize: 11 }}>{sub}</p>
              </div>
            ))}
          </div>

          {/* Masa salarial + Depto breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {card(
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                  <DollarSign style={{ width: 20, height: 20, color: "#10b981" }} />
                  <h2 style={{ color: "white", fontWeight: 800, fontSize: 16 }}>Masa Salarial Mensual</h2>
                </div>
                <p style={{ color: "#10b981", fontWeight: 900, fontSize: 34, letterSpacing: "-2px" }}>
                  {new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG", minimumFractionDigits: 0 }).format(masasSalarial)}
                </p>
                <p style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>sobre {activos.length} funcionarios activos</p>
                <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                  {["Caja", "Carnicería", "Almacén", "Panadería"].map(depto => {
                    const deptoEmp = activos.filter(e => e.depto === depto)
                    const deptoSalario = deptoEmp.reduce((s, e) => s + e.salario, 0)
                    const pct = Math.round((deptoSalario / masasSalarial) * 100)
                    return (
                      <div key={depto}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ color: c.muted, fontSize: 12, fontWeight: 600 }}>{depto} ({deptoEmp.length})</span>
                          <span style={{ color: "white", fontSize: 12, fontWeight: 700 }}>{pct}%</span>
                        </div>
                        <div style={{ height: 6, background: c.border, borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #6366f1, #8b5cf6)", borderRadius: 4 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {card(
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                  <Calendar style={{ width: 20, height: 20, color: "#6366f1" }} />
                  <h2 style={{ color: "white", fontWeight: 800, fontSize: 16 }}>Resumen de la Semana</h2>
                </div>
                {[
                  { dia: "Lun", presentes: 10, total: 11 },
                  { dia: "Mar", presentes: 11, total: 11 },
                  { dia: "Mié", presentes: 9, total: 11 },
                  { dia: "Jue", presentes: 10, total: 11 },
                  { dia: "Hoy", presentes, total: activos.length },
                ].map(({ dia, presentes: p, total }) => {
                  const pct = Math.round((p / total) * 100)
                  const isHoy = dia === "Hoy"
                  return (
                    <div key={dia} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <span style={{ color: isHoy ? "#6366f1" : c.muted, fontSize: 12, fontWeight: 700, width: 32 }}>{dia}</span>
                      <div style={{ flex: 1, height: 8, background: c.border, borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: isHoy ? "linear-gradient(90deg, #6366f1, #8b5cf6)" : "linear-gradient(90deg, #10b981, #14b8a6)", borderRadius: 4, transition: "width 1s ease" }} />
                      </div>
                      <span style={{ color: isHoy ? "white" : c.muted, fontSize: 12, fontWeight: 700, width: 40, textAlign: "right" }}>{p}/{total}</span>
                    </div>
                  )
                })}

                <div style={{ marginTop: 20, padding: 14, background: "rgba(99,102,241,0.08)", borderRadius: 14, border: "1px solid rgba(99,102,241,0.2)" }}>
                  <p style={{ color: "#818cf8", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Próximos vencimientos</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: c.muted, fontSize: 12 }}>Vacaciones — Ana Martínez</span>
                      <span style={{ color: "#f59e0b", fontSize: 12, fontWeight: 700 }}>En 3 días</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: c.muted, fontSize: 12 }}>Contrato — Luis Pérez</span>
                      <span style={{ color: "#10b981", fontSize: 12, fontWeight: 700 }}>En 12 días</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* CTA SueldOK */}
          <div style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 20, padding: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div>
              <h3 style={{ color: "white", fontWeight: 900, fontSize: 18, marginBottom: 6 }}>Gestión completa en SueldOK</h3>
              <p style={{ color: "#94a3b8", fontSize: 14, maxWidth: 500 }}>
                Liquidación de sueldos, control de asistencia biométrico, generación de recibos, reportes IPS y mucho más. Tu empresa ya está creada y sincronizada.
              </p>
            </div>
            <a href={SUELDOK_URL} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", padding: "14px 24px", borderRadius: 14, fontWeight: 800, fontSize: 15, textDecoration: "none", whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(99,102,241,0.4)", flexShrink: 0 }}>
              <ExternalLink style={{ width: 18, height: 18 }} />
              Ir a SueldOK
              <ChevronRight style={{ width: 18, height: 18 }} />
            </a>
          </div>
        </>
      )}

      {/* ── ASISTENCIA TAB ── */}
      {tab === "asistencia" && (
        <>
          {/* Status pills */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { ...estadoConfig.presente, label: "Presentes", count: presentes },
              { ...estadoConfig.ausente, label: "Ausentes", count: ausentes },
              { ...estadoConfig.tardanza, label: "Tardanzas", count: tardanzas },
              { ...estadoConfig.licencia, label: "Licencias", count: licencias },
            ].map(({ label, count, color, bg, icon: Icon }) => (
              <div key={label} style={{ background: bg, border: `1px solid ${color}30`, borderRadius: 16, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
                <Icon style={{ width: 24, height: 24, color }} />
                <div>
                  <p style={{ color, fontWeight: 900, fontSize: 28, lineHeight: 1 }}>{count}</p>
                  <p style={{ color, fontSize: 12, fontWeight: 600, opacity: 0.8 }}>{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Attendance list */}
          {card(
            <>
              <h2 style={{ color: "white", fontWeight: 800, fontSize: 16, marginBottom: 16 }}>Registro de Asistencia — Hoy</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {activos.map((emp, i) => {
                  const cfg = estadoConfig[emp.hoy] || estadoConfig.presente
                  const Icon = cfg.icon
                  return (
                    <div key={emp.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", background: "rgba(30,41,59,0.4)", borderRadius: 14, border: `1px solid ${c.border}` }}>
                      <AvatarCircle initials={emp.foto} idx={i} size={38} />
                      <div style={{ flex: 1 }}>
                        <p style={{ color: "white", fontWeight: 700, fontSize: 14 }}>{emp.nombre}</p>
                        <p style={{ color: c.muted, fontSize: 12 }}>{emp.cargo} · {emp.depto}</p>
                      </div>
                      <div style={{ textAlign: "center", width: 80 }}>
                        <p style={{ color: c.muted, fontSize: 11 }}>Entrada</p>
                        <p style={{ color: emp.entrada !== "—" ? "#10b981" : c.muted, fontWeight: 700, fontSize: 14, fontFamily: "monospace" }}>{emp.entrada}</p>
                      </div>
                      {emp.horasExtras > 0 && (
                        <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: "3px 8px" }}>
                          <span style={{ color: "#f59e0b", fontSize: 11, fontWeight: 700 }}>+{emp.horasExtras}h extra</span>
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, background: cfg.bg, border: `1px solid ${cfg.color}40`, borderRadius: 10, padding: "5px 12px" }}>
                        <Icon style={{ width: 14, height: 14, color: cfg.color }} />
                        <span style={{ color: cfg.color, fontSize: 12, fontWeight: 700 }}>{cfg.label}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ── FUNCIONARIOS TAB ── */}
      {tab === "funcionarios" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
              <Search style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: c.muted }} />
              <input
                style={{ width: "100%", background: c.surface, border: `1px solid ${c.border}`, color: "white", padding: "10px 14px 10px 40px", borderRadius: 12, outline: "none", fontSize: 14, boxSizing: "border-box" }}
                placeholder="Buscar funcionario, cargo, depto…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <span style={{ color: c.muted, fontSize: 13 }}>{filtered.length} resultado(s)</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
            {filtered.map((emp, i) => {
              const cfg = emp.hoy !== "—" ? (estadoConfig[emp.hoy] || estadoConfig.presente) : null
              return (
                <div key={emp.id} style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 18, padding: 18, display: "flex", flexDirection: "column", gap: 14, opacity: emp.estado === "inactivo" ? 0.6 : 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <AvatarCircle initials={emp.foto} idx={i} size={48} />
                    <div style={{ flex: 1 }}>
                      <p style={{ color: "white", fontWeight: 800, fontSize: 15 }}>{emp.nombre}</p>
                      <p style={{ color: c.muted, fontSize: 12 }}>{emp.cargo}</p>
                    </div>
                    <span style={{ background: emp.estado === "activo" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: emp.estado === "activo" ? "#10b981" : "#ef4444", border: `1px solid ${emp.estado === "activo" ? "#10b981" : "#ef4444"}40`, borderRadius: 8, padding: "3px 8px", fontSize: 11, fontWeight: 700 }}>
                      {emp.estado === "activo" ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ background: "rgba(30,41,59,0.5)", borderRadius: 10, padding: "8px 12px" }}>
                      <p style={{ color: c.muted, fontSize: 10, fontWeight: 600 }}>DEPARTAMENTO</p>
                      <p style={{ color: "white", fontSize: 13, fontWeight: 700 }}>{emp.depto}</p>
                    </div>
                    <div style={{ background: "rgba(30,41,59,0.5)", borderRadius: 10, padding: "8px 12px" }}>
                      <p style={{ color: c.muted, fontSize: 10, fontWeight: 600 }}>SALARIO</p>
                      <p style={{ color: "#10b981", fontSize: 13, fontWeight: 700 }}>Gs. {(emp.salario / 1000).toFixed(0)}K</p>
                    </div>
                  </div>
                  {cfg && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: cfg.bg, borderRadius: 10, padding: "8px 12px", border: `1px solid ${cfg.color}30` }}>
                      <cfg.icon style={{ width: 14, height: 14, color: cfg.color }} />
                      <span style={{ color: cfg.color, fontSize: 12, fontWeight: 700 }}>{cfg.label}</span>
                      {emp.entrada !== "—" && <span style={{ color: cfg.color, fontSize: 12, opacity: 0.7, marginLeft: "auto" }}>Entrada: {emp.entrada}</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
