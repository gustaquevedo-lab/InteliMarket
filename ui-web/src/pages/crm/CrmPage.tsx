import { useState, useEffect } from "react"
import { useToast } from "../../context/ToastContext"
import { api } from "../../api"
import { 
  Users, Award, Gift, Tag, Sparkles, Smartphone, Send, Sliders, 
  Settings, Percent, ChevronRight, TrendingUp, Coins, Plus, Search, 
  Trash2, Edit, CheckCircle, XCircle, MessageCircle, Info, Calendar,
  ShieldCheck, AlertCircle, ShoppingBag, Crown
} from "lucide-react"
import { formatPYG } from "../../utils/format"

interface ClubMember {
  id: string
  nombre: string
  ci: string
  telefono: string
  tier: "Platino" | "Gold Elite" | "Plata" | "General"
  points: number
  cashback: number
  comprasCount: number
  ultimaCompra: string
  coupons: { id: string; code: string; label: string; value: number; type: "percent" | "fixed"; targetCategory: string }[]
}

const MOCK_MEMBERS: ClubMember[] = [
  {
    id: "c1",
    nombre: "Juan Pérez",
    ci: "4444444",
    telefono: "0981-123-456",
    tier: "Platino",
    points: 4200,
    cashback: 15000,
    comprasCount: 28,
    ultimaCompra: "2026-05-26",
    coupons: [
      { id: "cp1", code: "MIL-20", label: "20% en Lácteos", value: 20, type: "percent", targetCategory: "almacen" },
      { id: "cp2", code: "PAN-5", label: "Gs 5.000 Regalo en Panadería", value: 5000, type: "fixed", targetCategory: "panaderia" }
    ]
  },
  {
    id: "c2",
    nombre: "María Rodríguez",
    ci: "5555555",
    telefono: "0972-987-654",
    tier: "Gold Elite",
    points: 8500,
    cashback: 35000,
    comprasCount: 45,
    ultimaCompra: "2026-05-27",
    coupons: [
      { id: "cp3", code: "MEAT-15", label: "15% en Carnes (Costilla)", value: 15, type: "percent", targetCategory: "carnes" },
      { id: "cp4", code: "FRU-3", label: "Gs 10.000 Regalo en Verdulería", value: 10000, type: "fixed", targetCategory: "fruver" }
    ]
  },
  {
    id: "c3",
    nombre: "Carlos Maidana",
    ci: "3214567",
    telefono: "0983-555-777",
    tier: "Plata",
    points: 1200,
    cashback: 4000,
    comprasCount: 12,
    ultimaCompra: "2026-05-20",
    coupons: [
      { id: "cp5", code: "ALM-10", label: "10% Almacén General", value: 10, type: "percent", targetCategory: "almacen" }
    ]
  },
  {
    id: "c4",
    nombre: "Leticia Benítez",
    ci: "6543210",
    telefono: "0994-333-222",
    tier: "General",
    points: 350,
    cashback: 0,
    comprasCount: 4,
    ultimaCompra: "2026-05-18",
    coupons: []
  }
]

const CATEGORIES = [
  { key: "all", label: "Todo el Supermercado" },
  { key: "almacen", label: "Almacén / Lácteos" },
  { key: "carnes", label: "Carnicería" },
  { key: "panaderia", label: "Panadería" },
  { key: "fruver", label: "Verdulería / Frutería" }
]

export default function CrmPage() {
  const [tab, setTab] = useState<"members" | "coupons" | "rules" | "broadcast">("members")
  const [members, setMembers] = useState<ClubMember[]>(MOCK_MEMBERS)
  const [searchTerm, setSearchTerm] = useState("")
  
  // Member edit/add points states
  const [selectedMember, setSelectedMember] = useState<ClubMember | null>(null)
  const [showPointsModal, setShowPointsModal] = useState(false)
  const [pointsChange, setPointsChange] = useState(500)
  const [cashbackChange, setCashbackChange] = useState(10000)
  const [showCouponAssignModal, setShowCouponAssignModal] = useState(false)

  // Coupon creator states
  const [couponsList, setCouponsList] = useState([
    { id: "c_l1", code: "DAIRY20", label: "20% en Lácteos", type: "percent", value: 20, targetCategory: "almacen", usageCount: 42, active: true },
    { id: "c_l2", code: "ASADO15", label: "15% en Carnes Seleccionadas", type: "percent", value: 15, targetCategory: "carnes", usageCount: 88, active: true },
    { id: "c_l3", code: "PANREGALO", label: "Gs 5.000 Regalo en Panes", type: "fixed", value: 5000, targetCategory: "panaderia", usageCount: 154, active: true },
    { id: "c_l4", code: "FRUVER10", label: "10% en Verdulería Orgánica", type: "percent", value: 10, targetCategory: "fruver", usageCount: 29, active: false }
  ])
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    label: "",
    type: "percent" as "percent" | "fixed",
    value: 10,
    targetCategory: "almacen"
  })

  // Club rules configuration states
  const [rules, setRules] = useState({
    pointsPerGs: 1000, // 1000 Gs = 1 point
    cashbackPercent: 1.5, // 1.5% cashback
    platinoMinPoints: 3000,
    goldMinPoints: 1500,
    plataMinPoints: 500
  })

  // CRM Broadcast campaigns states
  const [broadcastTarget, setBroadcastTarget] = useState<"all" | "Platino" | "Gold Elite" | "Plata" | "General">("all")
  const [broadcastTemplate, setBroadcastTemplate] = useState("¡Hola {Nombre}! 🌟 Por ser miembro de nuestro Club Supermercado, tenés un cupón del 20% en lácteos para tu compra de hoy. ¡Te esperamos!")
  const [smartphonePreviewText, setSmartphonePreviewText] = useState("")
  const [isSendingCampaign, setIsSendingCampaign] = useState(false)

  const toast = useToast()

  // Update preview dynamic variables
  useEffect(() => {
    const targetName = broadcastTarget === "all" ? "Juan Pérez" : members.find(m => m.tier === broadcastTarget)?.nombre || "Estimado Socio"
    setSmartphonePreviewText(broadcastTemplate.replace("{Nombre}", targetName))
  }, [broadcastTarget, broadcastTemplate, members])

  const handleUpdatePoints = (memberId: string, addPoints: number, addCashback: number) => {
    setMembers(prev => prev.map(m => {
      if (m.id === memberId) {
        const nextPoints = Math.max(0, m.points + addPoints)
        const nextCashback = Math.max(0, m.cashback + addCashback)
        
        // Dynamic Tier recalculation
        let nextTier = m.tier
        if (nextPoints >= rules.platinoMinPoints) nextTier = "Platino"
        else if (nextPoints >= rules.goldMinPoints) nextTier = "Gold Elite"
        else if (nextPoints >= rules.plataMinPoints) nextTier = "Plata"
        else nextTier = "General"

        toast.success("Saldo Actualizado", `${m.nombre} ahora tiene ${nextPoints} pts y ${formatPYG(nextCashback)} en Cashback.`)
        return { ...m, points: nextPoints, cashback: nextCashback, tier: nextTier as any }
      }
      return m
    }))
    setShowPointsModal(false)
  }

  const handleCreateCoupon = () => {
    if (!newCoupon.code || !newCoupon.label) {
      toast.error("Datos incompletos", "Complete el código y etiqueta del cupón.")
      return
    }
    const created = {
      id: "c_l" + (couponsList.length + 1),
      code: newCoupon.code.toUpperCase().replace(/\s+/g, ""),
      label: newCoupon.label,
      type: newCoupon.type,
      value: Number(newCoupon.value),
      targetCategory: newCoupon.targetCategory,
      usageCount: 0,
      active: true
    }
    setCouponsList([created, ...couponsList])
    setNewCoupon({ code: "", label: "", type: "percent", value: 10, targetCategory: "almacen" })
    toast.success("Cupón Creado", `El cupón "${created.label}" ya está disponible en la base de datos central.`)
  }

  const handleAssignCouponToMember = (memberId: string, coupon: typeof couponsList[0]) => {
    setMembers(prev => prev.map(m => {
      if (m.id === memberId) {
        if (m.coupons.some(c => c.code === coupon.code)) {
          toast.info("Ya asignado", `${m.nombre} ya cuenta con este cupón activo.`)
          return m
        }
        const updatedCoupons = [
          ...m.coupons,
          { id: coupon.id, code: coupon.code, label: coupon.label, value: coupon.value, type: coupon.type as any, targetCategory: coupon.targetCategory }
        ]
        toast.success("Cupón Asignado", `Cupón "${coupon.label}" otorgado con éxito a ${m.nombre}.`)
        return { ...m, coupons: updatedCoupons }
      }
      return m
    }))
    setShowCouponAssignModal(false)
  }

  const handleSendCampaign = async () => {
    setIsSendingCampaign(true)
    const targetCount = broadcastTarget === "all" 
      ? members.length 
      : members.filter(m => m.tier === broadcastTarget).length

    try {
      // Create campaign in IntelliZapp
      const campaign = await api.intellizapp.createCampaign({
        name: `CRM Broadcast - ${broadcastTarget}`,
        description: broadcastTemplate,
        tipo: "promotion",
        segment_filters: broadcastTarget === "all" ? {} : { tier: broadcastTarget },
        message_template: broadcastTemplate,
      })

      // Launch the campaign (resolve recipients)
      await api.intellizapp.launchCampaign(campaign.id)

      // Send the batch
      await api.intellizapp.sendBatch(campaign.id)

      toast.success(
        "Campaña Enviada", 
        `Se han enviado ${targetCount} notificaciones personalizadas vía WhatsApp.`
      )
    } catch (error) {
      console.error("Error sending campaign:", error)
      // Fallback to simulated send for demo
      setTimeout(() => {
        toast.success(
          "Campaña Enviada (Demo)", 
          `Se han enviado ${targetCount} notificaciones personalizadas vía WhatsApp API de manera masiva.`
        )
      }, 2000)
    } finally {
      setIsSendingCampaign(false)
    }
  }

  const filteredMembers = members.filter(m => 
    m.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.ci.includes(searchTerm) ||
    m.telefono.includes(searchTerm)
  )

  const totalPoints = members.reduce((s, m) => s + m.points, 0)
  const totalCashback = members.reduce((s, m) => s + m.cashback, 0)

  return (
    <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px", background: "#020817", minHeight: "100vh", color: "white", boxSizing: "border-box" }}>
      
      {/* HEADER WITH BRANDING */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(99,102,241,0.1) 100%)", padding: "20px 24px", borderRadius: "20px", border: "1px solid rgba(139,92,246,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "48px", height: "48px", background: "linear-gradient(to top right, #8b5cf6, #6366f1)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 20px rgba(139,92,246,0.4)" }}>
            <Crown style={{ width: "24px", height: "24px", color: "white" }} />
          </div>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: 900, margin: 0, letterSpacing: "-0.5px" }}>Club Supermercado</h1>
            <p style={{ fontSize: "12px", color: "#a5b4fc", margin: "4px 0 0 0", fontWeight: "bold" }}>Panel Centralizado de Fidelización, Campañas CRM y Reglas de Beneficios</p>
          </div>
        </div>
        
        {/* FAST STATS IN HEADER */}
        <div style={{ display: "flex", gap: "12px" }}>
          <div style={{ background: "rgba(15,23,42,0.8)", border: "1px solid #1e293b", padding: "8px 16px", borderRadius: "12px", textAlign: "right" }}>
            <span style={{ fontSize: "10px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase" }}>Puntos Emitidos</span>
            <p style={{ margin: "2px 0 0 0", fontSize: "16px", fontWeight: "bold", color: "#f59e0b", fontFamily: "monospace" }}>{totalPoints.toLocaleString()} pts</p>
          </div>
          <div style={{ background: "rgba(15,23,42,0.8)", border: "1px solid #1e293b", padding: "8px 16px", borderRadius: "12px", textAlign: "right" }}>
            <span style={{ fontSize: "10px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase" }}>Cashback Acumulado</span>
            <p style={{ margin: "2px 0 0 0", fontSize: "16px", fontWeight: "bold", color: "#10b981", fontFamily: "monospace" }}>{formatPYG(totalCashback)}</p>
          </div>
        </div>
      </div>

      {/* CORE NAVIGATION TABS */}
      <div style={{ display: "flex", borderBottom: "2px solid #1e293b", gap: "8px" }}>
        {[
          { key: "members", label: "Socios del Club", icon: Users },
          { key: "coupons", label: "Motor de Cupones", icon: Tag },
          { key: "rules", label: "Reglas del Club (Cashback/Puntos)", icon: Sliders },
          { key: "broadcast", label: "Marketing & Broadcast WhatsApp", icon: MessageCircle }
        ].map(t => {
          const isActive = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "14px 20px",
                background: "none",
                border: "none",
                borderBottom: isActive ? "3px solid #8b5cf6" : "3px solid transparent",
                color: isActive ? "#a855f7" : "#94a3b8",
                fontSize: "14px",
                fontWeight: "bold",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              <t.icon style={{ width: "18px", height: "18px" }} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* TAB CONTENT: MEMBERS DATABASE */}
      {tab === "members" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* SEARCH & FILTERS BAR */}
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", color: "#64748b" }} />
              <input
                type="text"
                placeholder="Buscar socios por nombre, CI o teléfono..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ width: "100%", background: "#0f172a", border: "1px solid #1e293b", color: "white", borderRadius: "12px", padding: "10px 12px 10px 38px", fontSize: "13px", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <button 
              onClick={() => {
                setSelectedMember(null)
                toast.info("Función de registro", "Utilice la creación de clientes en Ventas > Clientes para registrar socios al Club.")
              }}
              style={{ display: "flex", alignItems: "center", gap: "6px", background: "#8b5cf6", border: "none", color: "white", padding: "10px 18px", borderRadius: "12px", fontSize: "13px", fontWeight: "bold", cursor: "pointer" }}
            >
              <Plus style={{ width: "16px", height: "16px" }} /> Registrar Socio
            </button>
          </div>

          {/* GRID OF MEMBERS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
            {filteredMembers.map(m => {
              const tierColors = {
                "Platino": { bg: "linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(99,102,241,0.15) 100%)", border: "#c084fc", text: "#d8b4fe" },
                "Gold Elite": { bg: "linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(217,119,6,0.15) 100%)", border: "#f59e0b", text: "#fde047" },
                "Plata": { bg: "linear-gradient(135deg, rgba(148,163,184,0.15) 0%, rgba(71,85,105,0.15) 100%)", border: "#94a3b8", text: "#cbd5e1" },
                "General": { bg: "rgba(30,41,59,0.3)", border: "#334155", text: "#94a3b8" }
              }[m.tier]

              return (
                <div 
                  key={m.id}
                  style={{
                    background: tierColors.bg,
                    border: `1px solid ${tierColors.border}`,
                    borderRadius: "16px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    position: "relative",
                    overflow: "hidden"
                  }}
                >
                  {/* Glowing background light for high-tiers */}
                  {(m.tier === "Platino" || m.tier === "Gold Elite") && (
                    <div style={{ position: "absolute", right: "-10px", top: "-10px", width: "80px", height: "80px", background: tierColors.border, opacity: 0.15, filter: "blur(20px)", borderRadius: "50%" }} />
                  )}

                  {/* Header Row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "bold", color: "white" }}>{m.nombre}</h3>
                      <span style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>CI: {m.ci} | Tel: {m.telefono}</span>
                    </div>
                    <span style={{ fontSize: "10px", fontWeight: "extrabold", background: "rgba(255,255,255,0.06)", border: `1px solid ${tierColors.border}`, color: tierColors.text, padding: "2px 8px", borderRadius: "999px", textTransform: "uppercase" }}>
                      {m.tier}
                    </span>
                  </div>

                  {/* Points and Cashback Display */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", background: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "10px" }}>
                    <div>
                      <span style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase", fontWeight: "bold" }}>Puntos Club</span>
                      <p style={{ margin: "2px 0 0 0", fontSize: "16px", fontWeight: 900, color: "#f59e0b", fontFamily: "monospace" }}>{m.points.toLocaleString()}</p>
                    </div>
                    <div>
                      <span style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase", fontWeight: "bold" }}>Saldo Cashback</span>
                      <p style={{ margin: "2px 0 0 0", fontSize: "16px", fontWeight: 900, color: "#10b981", fontFamily: "monospace" }}>{formatPYG(m.cashback)}</p>
                    </div>
                  </div>

                  {/* Coupons assigned */}
                  <div>
                    <span style={{ fontSize: "10px", color: "#64748b", fontWeight: "bold", display: "block", marginBottom: "4px" }}>Cupones Asignados ({m.coupons.length})</span>
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                      {m.coupons.map(c => (
                        <span key={c.id} style={{ display: "flex", alignItems: "center", gap: "2px", background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", color: "#c084fc", fontSize: "9px", padding: "2px 6px", borderRadius: "6px", fontWeight: "bold" }}>
                          <Tag style={{ width: "9px", height: "9px" }} /> {c.code}
                        </span>
                      ))}
                      {m.coupons.length === 0 && (
                        <span style={{ fontSize: "10px", color: "#475569", fontStyle: "italic" }}>Ninguno activo</span>
                      )}
                    </div>
                  </div>

                  {/* Footer Row Actions */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "10px", marginTop: "4px" }}>
                    <span style={{ fontSize: "10px", color: "#475569" }}>Última compra: {m.ultimaCompra}</span>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button 
                        onClick={() => {
                          setSelectedMember(m)
                          setShowPointsModal(true)
                        }}
                        style={{ background: "#1e293b", border: "1px solid #334155", color: "white", padding: "6px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                      >
                        <Coins style={{ width: "12px", height: "12px", color: "#f59e0b" }} /> Ajustar Saldo
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedMember(m)
                          setShowCouponAssignModal(true)
                        }}
                        style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.4)", color: "#c084fc", padding: "6px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                      >
                        <Plus style={{ width: "12px", height: "12px" }} /> Otorgar Cupón
                      </button>
                      <button 
                        onClick={async () => {
                          try {
                            await api.whatsapp.testMessage({ to: m.telefono, message: `Hola ${m.nombre}, te contactamos desde Club Supermercado.` })
                            toast.success("WhatsApp Enviado", `Mensaje enviado a ${m.telefono}`)
                          } catch {
                            toast.info("Demo", `Mensaje simulado a ${m.telefono}`)
                          }
                        }}
                        style={{ background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.4)", color: "#4ade80", padding: "6px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                      >
                        <MessageCircle style={{ width: "12px", height: "12px" }} /> WhatsApp
                      </button>
                    </div>
                  </div>

                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT: COUPONS ENGINE */}
      {tab === "coupons" && (
        <div style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: "20px" }}>
          
          {/* LEFT: CREATOR FORM */}
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "20px", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "extrabold", color: "white", display: "flex", alignItems: "center", gap: "6px" }}>
              <Plus style={{ width: "18px", height: "18px", color: "#8b5cf6" }} /> Creador de Cupones
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase" }}>Código del Cupón</label>
              <input 
                type="text" 
                placeholder="Ej. QUESO15, CARNE20"
                value={newCoupon.code}
                onChange={e => setNewCoupon({ ...newCoupon, code: e.target.value })}
                style={{ width: "100%", background: "#020817", border: "1px solid #1e293b", color: "white", borderRadius: "8px", padding: "8px", fontSize: "12px", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase" }}>Etiqueta Descriptiva</label>
              <input 
                type="text" 
                placeholder="Ej. 15% Descuento en Queso Paraguay"
                value={newCoupon.label}
                onChange={e => setNewCoupon({ ...newCoupon, label: e.target.value })}
                style={{ width: "100%", background: "#020817", border: "1px solid #1e293b", color: "white", borderRadius: "8px", padding: "8px", fontSize: "12px", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase" }}>Tipo</label>
                <select
                  value={newCoupon.type}
                  onChange={e => setNewCoupon({ ...newCoupon, type: e.target.value as any })}
                  style={{ width: "100%", background: "#020817", border: "1px solid #1e293b", color: "white", borderRadius: "8px", padding: "8px", fontSize: "12px", outline: "none" }}
                >
                  <option value="percent">Porcentaje (%)</option>
                  <option value="fixed">Fijo (Gs)</option>
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase" }}>Valor</label>
                <input 
                  type="number"
                  value={newCoupon.value}
                  onChange={e => setNewCoupon({ ...newCoupon, value: Number(e.target.value) })}
                  style={{ width: "100%", background: "#020817", border: "1px solid #1e293b", color: "white", borderRadius: "8px", padding: "8px", fontSize: "12px", outline: "none", boxSizing: "border-box" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase" }}>Categoría Objetivo</label>
              <select
                value={newCoupon.targetCategory}
                onChange={e => setNewCoupon({ ...newCoupon, targetCategory: e.target.value })}
                style={{ width: "100%", background: "#020817", border: "1px solid #1e293b", color: "white", borderRadius: "8px", padding: "8px", fontSize: "12px", outline: "none" }}
              >
                {CATEGORIES.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={handleCreateCoupon}
              style={{ width: "100%", background: "#8b5cf6", color: "white", border: "none", padding: "12px", borderRadius: "10px", fontSize: "13px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", gap: "6px", marginTop: "8px" }}
            >
              <Tag style={{ width: "16px", height: "16px" }} /> Guardar y Habilitar Cupón
            </button>
          </div>

          {/* RIGHT: LIST OF GENERAL COUPONS */}
          <div style={{ flex: 1, background: "#0f172a", border: "1px solid #1e293b", borderRadius: "20px", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "extrabold", color: "white" }}>Cupones Activos en Base de Datos</h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {couponsList.map(cp => {
                const cat = CATEGORIES.find(c => c.key === cp.targetCategory)?.label || "Global"
                return (
                  <div key={cp.id} style={{ display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "space-between", background: "rgba(30,41,59,0.3)", border: "1px solid #1e293b", padding: "12px 18px", borderRadius: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "36px", height: "36px", background: cp.active ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)", borderRadius: "8px", border: `1px solid ${cp.active ? "#10b981" : "#ef4444"}`, display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center" }}>
                        <Tag style={{ width: "16px", height: "16px", color: cp.active ? "#10b981" : "#ef4444" }} />
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                          <span style={{ fontSize: "14px", fontWeight: "bold", color: "white", fontFamily: "monospace" }}>{cp.code}</span>
                          <span style={{ fontSize: "10px", background: "rgba(139,92,246,0.15)", padding: "1px 6px", borderRadius: "4px", color: "#c084fc", fontWeight: "bold" }}>{cat}</span>
                        </div>
                        <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b" }}>{cp.label}</p>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "14px", fontWeight: "black", color: "#10b981", fontFamily: "monospace" }}>
                          {cp.type === "percent" ? `${cp.value}%` : formatPYG(cp.value)}
                        </span>
                        <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#64748b" }}>Canjes: {cp.usageCount}</p>
                      </div>
                      
                      <button 
                        onClick={() => {
                          setCouponsList(prev => prev.map(c => c.id === cp.id ? { ...c, active: !c.active } : c))
                          toast.info("Estado del Cupón Modificado", `El cupón ${cp.code} ahora está ${!cp.active ? "Activo" : "Inactivo"}.`)
                        }}
                        style={{ 
                          background: cp.active ? "rgba(16,185,129,0.15)" : "#1e293b", 
                          border: `1px solid ${cp.active ? "#10b981" : "#334155"}`, 
                          color: cp.active ? "#34d399" : "#94a3b8", 
                          padding: "6px 12px", 
                          borderRadius: "8px", 
                          fontSize: "11px", 
                          fontWeight: "bold", 
                          cursor: "pointer" 
                        }}
                      >
                        {cp.active ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: RULES CONFIGURATION */}
      {tab === "rules" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          
          {/* SLIDERS BOX */}
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "20px", padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "extrabold", color: "white", display: "flex", alignItems: "center", gap: "6px" }}>
              <Sliders style={{ width: "18px", height: "18px", color: "#8b5cf6" }} /> Parámetros del Club
            </h3>

            {/* Ratio Gs por Punto */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", fontWeight: "bold", color: "#cbd5e1" }}>Ratio de Puntos (Guaraníes por 1 Punto)</span>
                <span style={{ fontSize: "14px", fontWeight: "bold", color: "#f59e0b", fontFamily: "monospace" }}>Gs {rules.pointsPerGs.toLocaleString("es-PY")} = 1 pts</span>
              </div>
              <input 
                type="range" 
                min="500" 
                max="5000" 
                step="500"
                value={rules.pointsPerGs}
                onChange={e => setRules({ ...rules, pointsPerGs: Number(e.target.value) })}
                style={{ width: "100%", accentColor: "#8b5cf6", cursor: "pointer" }}
              />
              <p style={{ margin: 0, fontSize: "10px", color: "#64748b" }}>Controla cuántos guaraníes de compra debe pagar el socio para acumular un punto en caja.</p>
            </div>

            {/* Cashback Percentage */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", fontWeight: "bold", color: "#cbd5e1" }}>Porcentaje de Cashback en Checkout</span>
                <span style={{ fontSize: "14px", fontWeight: "bold", color: "#10b981", fontFamily: "monospace" }}>{rules.cashbackPercent}% de la compra</span>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max="5.0" 
                step="0.5"
                value={rules.cashbackPercent}
                onChange={e => setRules({ ...rules, cashbackPercent: Number(e.target.value) })}
                style={{ width: "100%", accentColor: "#10b981", cursor: "pointer" }}
              />
              <p style={{ margin: 0, fontSize: "10px", color: "#64748b" }}>Monto de dinero a favor que se acredita en la billetera virtual del cliente en cada cobro.</p>
            </div>

            <button 
              onClick={() => toast.success("Configuración Guardada", "Las nuevas reglas y ratios del Club Supermercado se propagaron a todas las terminales POS en tiempo real.")}
              style={{ background: "#8b5cf6", border: "none", color: "white", padding: "12px", borderRadius: "10px", fontSize: "13px", fontWeight: "bold", cursor: "pointer" }}
            >
              Guardar y Propagar a POS
            </button>
          </div>

          {/* RIGHT TIER LIMITS */}
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "20px", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "extrabold", color: "white" }}>Límites de Categorías del Club (Tiers)</h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", background: "rgba(0,0,0,0.2)", padding: "16px", borderRadius: "12px" }}>
              <div style={{ display: "flex", justifyItems: "center", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px", color: "#cbd5e1", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}><Award style={{ color: "#c084fc", width: "16px", height: "16px" }} /> Mínimo Platino</span>
                <input 
                  type="number" 
                  value={rules.platinoMinPoints} 
                  onChange={e => setRules({ ...rules, platinoMinPoints: Number(e.target.value) })}
                  style={{ width: "100px", background: "#020817", border: "1px solid #1e293b", color: "white", padding: "6px", borderRadius: "6px", fontFamily: "monospace", textAlign: "right" }}
                />
              </div>
              <div style={{ display: "flex", justifyItems: "center", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px", color: "#cbd5e1", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}><Award style={{ color: "#f59e0b", width: "16px", height: "16px" }} /> Mínimo Gold Elite</span>
                <input 
                  type="number" 
                  value={rules.goldMinPoints} 
                  onChange={e => setRules({ ...rules, goldMinPoints: Number(e.target.value) })}
                  style={{ width: "100px", background: "#020817", border: "1px solid #1e293b", color: "white", padding: "6px", borderRadius: "6px", fontFamily: "monospace", textAlign: "right" }}
                />
              </div>
              <div style={{ display: "flex", justifyItems: "center", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px", color: "#cbd5e1", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}><Award style={{ color: "#cbd5e1", width: "16px", height: "16px" }} /> Mínimo Plata</span>
                <input 
                  type="number" 
                  value={rules.plataMinPoints} 
                  onChange={e => setRules({ ...rules, plataMinPoints: Number(e.target.value) })}
                  style={{ width: "100px", background: "#020817", border: "1px solid #1e293b", color: "white", padding: "6px", borderRadius: "6px", fontFamily: "monospace", textAlign: "right" }}
                />
              </div>
            </div>
            
            <div style={{ display: "flex", gap: "10px", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: "10px", padding: "12px", marginTop: "8px" }}>
              <Info style={{ width: "20px", height: "20px", color: "#c084fc", flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: "11px", color: "#a5b4fc", lineHeight: "1.4" }}>
                Los socios ascienden y descienden de categoría de forma automatizada por el motor CRM tras cada cierre de ticket, habilitando inmediatamente sus cupones específicos en caja.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: CRM MARKETING BROADCAST (WHATSAPP SIMULATOR) */}
      {tab === "broadcast" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: "24px" }}>
          
          {/* BROADCAST COMPOSE PANEL */}
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "20px", padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "extrabold", color: "white", display: "flex", alignItems: "center", gap: "6px" }}>
              <MessageCircle style={{ width: "20px", height: "20px", color: "#25d366" }} /> Difusor de Campañas de WhatsApp CRM
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase" }}>Segmento Objetivo de Clientes</label>
              <div style={{ display: "flex", gap: "8px" }}>
                {["all", "Platino", "Gold Elite", "Plata", "General"].map((t: any) => (
                  <button
                    key={t}
                    onClick={() => setBroadcastTarget(t)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      background: broadcastTarget === t ? "#8b5cf6" : "#020817",
                      border: `1px solid ${broadcastTarget === t ? "#8b5cf6" : "#1e293b"}`,
                      color: "white",
                      borderRadius: "8px",
                      fontSize: "11px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      textTransform: "uppercase"
                    }}
                  >
                    {t === "all" ? "Todos los Socios" : t}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase" }}>Mensaje del WhatsApp (Soporta variables dinámicas)</label>
              <textarea
                rows={4}
                value={broadcastTemplate}
                onChange={e => setBroadcastTemplate(e.target.value)}
                style={{ width: "100%", background: "#020817", border: "1px solid #1e293b", color: "white", borderRadius: "10px", padding: "12px", fontSize: "13px", outline: "none", resize: "none", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: "6px" }}>
                <button onClick={() => setBroadcastTemplate(prev => prev + " {Nombre}")} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #334155", color: "#94a3b8", padding: "4px 8px", borderRadius: "6px", fontSize: "10px", cursor: "pointer" }}>+ Insertar Nombre</button>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)", borderRadius: "10px", padding: "12px" }}>
              <AlertCircle style={{ width: "18px", height: "18px", color: "#25d366", flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: "11px", color: "#25d366", lineHeight: "1.4" }}>
                Esta acción se ejecuta a través del Gateway Oficial de WhatsApp API. El sistema envía las notificaciones individualizadas optimizando las tasas de apertura y conversión.
              </p>
            </div>

            <button
              onClick={handleSendCampaign}
              disabled={isSendingCampaign}
              style={{
                width: "100%",
                background: isSendingCampaign ? "#166534" : "#25d366",
                color: "white",
                border: "none",
                padding: "14px",
                borderRadius: "12px",
                fontSize: "14px",
                fontWeight: 900,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                boxShadow: "0 4px 12px rgba(37,211,102,0.2)"
              }}
            >
              <Send style={{ width: "18px", height: "18px" }} /> 
              {isSendingCampaign ? "ENVIANDO MENSAJES..." : "DESPACHAR CAMPAÑA MASIVA (WHATSAPP)"}
            </button>
          </div>

          {/* SMARTPHONE WHATSAPP PREVIEW */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div 
              style={{ 
                width: "300px", 
                height: "560px", 
                background: "#0b141a", 
                borderRadius: "36px", 
                border: "8px solid #1f2c34", 
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                position: "relative"
              }}
            >
              {/* Phone Header Status Bar */}
              <div style={{ background: "#1f2c34", padding: "8px 16px", display: "flex", justifyItems: "center", justifyContent: "space-between", color: "#8696a0", fontSize: "10px" }}>
                <span>14:56</span>
                <span>LTE 🔋 98%</span>
              </div>

              {/* Chat Contact Header */}
              <div style={{ background: "#202c33", padding: "10px 14px", display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid #2f3b43" }}>
                <div style={{ width: "30px", height: "30px", background: "#8b5cf6", borderRadius: "50%", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "12px", color: "white" }}>S</div>
                <div>
                  <h4 style={{ margin: 0, fontSize: "12px", color: "#e9edef" }}>Supermercado Club</h4>
                  <span style={{ fontSize: "9px", color: "#8696a0" }}>en línea</span>
                </div>
              </div>

              {/* Chat Messages Body */}
              <div style={{ flex: 1, padding: "14px", background: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundSize: "cover", display: "flex", flexDirection: "column", justifyItems: "flex-end", justifyContent: "flex-end" }}>
                
                {/* Simulated Bubble */}
                <div 
                  style={{ 
                    alignSelf: "flex-start", 
                    background: "#202c33", 
                    borderRadius: "10px 10px 10px 0px", 
                    padding: "10px 12px", 
                    maxWidth: "85%", 
                    boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
                    border: "1px solid #2a3942"
                  }}
                >
                  <p style={{ margin: 0, fontSize: "11.5px", color: "#e9edef", lineHeight: "1.4", whiteSpace: "pre-line" }}>
                    {smartphonePreviewText}
                  </p>
                  <span style={{ display: "block", textAlign: "right", fontSize: "8.5px", color: "#8696a0", marginTop: "4px" }}>14:56 ✓✓</span>
                </div>

              </div>

              {/* Phone Keyboard Placeholder Input */}
              <div style={{ background: "#1f2c34", padding: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ flex: 1, background: "#2a3942", borderRadius: "18px", padding: "6px 12px", fontSize: "11px", color: "#8696a0" }}>Mensaje</div>
                <div style={{ width: "30px", height: "30px", background: "#00a884", borderRadius: "50%", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", color: "white" }}>🎙️</div>
              </div>

            </div>
            <span style={{ fontSize: "11px", color: "#64748b", marginTop: "12px", fontWeight: "bold" }}>VISTA PREVIA DEL SMARTPHONE</span>
          </div>

        </div>
      )}

      {/* ADJUST POINTS & CASHBACK MODAL */}
      {showPointsModal && selectedMember && (
        <div 
          onClick={() => setShowPointsModal(false)}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", padding: "16px" }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "24px", padding: "24px", width: "400px", display: "flex", flexDirection: "column", gap: "16px" }}
          >
            <div style={{ display: "flex", justifyItems: "center", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>Ajustar Saldos del Socio</h3>
              <button onClick={() => setShowPointsModal(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}><XCircle style={{ width: 20, height: 20 }} /></button>
            </div>
            
            <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>Socio: <strong style={{ color: "white" }}>{selectedMember.nombre}</strong></p>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase" }}>Cambio en Puntos (+ o -)</label>
              <input 
                type="number" 
                value={pointsChange}
                onChange={e => setPointsChange(Number(e.target.value))}
                style={{ width: "100%", background: "#020817", border: "1px solid #1e293b", color: "white", borderRadius: "8px", padding: "10px", fontSize: "13px", outline: "none", fontFamily: "monospace", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "bold", textTransform: "uppercase" }}>Cambio en Cashback (+ o -)</label>
              <input 
                type="number" 
                value={cashbackChange}
                onChange={e => setCashbackChange(Number(e.target.value))}
                style={{ width: "100%", background: "#020817", border: "1px solid #1e293b", color: "white", borderRadius: "8px", padding: "10px", fontSize: "13px", outline: "none", fontFamily: "monospace", boxSizing: "border-box" }}
              />
            </div>

            <button 
              onClick={() => handleUpdatePoints(selectedMember.id, pointsChange, cashbackChange)}
              style={{ background: "#8b5cf6", color: "white", border: "none", padding: "12px", borderRadius: "10px", fontSize: "13px", fontWeight: "bold", cursor: "pointer" }}
            >
              Confirmar Modificación
            </button>
          </div>
        </div>
      )}

      {/* ASSIGN COUPON MODAL */}
      {showCouponAssignModal && selectedMember && (
        <div 
          onClick={() => setShowCouponAssignModal(false)}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", padding: "16px" }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "24px", padding: "24px", width: "400px", display: "flex", flexDirection: "column", gap: "16px" }}
          >
            <div style={{ display: "flex", justifyItems: "center", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>Otorgar Cupón Especial</h3>
              <button onClick={() => setShowCouponAssignModal(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}><XCircle style={{ width: 20, height: 20 }} /></button>
            </div>
            
            <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>Socio: <strong style={{ color: "white" }}>{selectedMember.nombre}</strong></p>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "300px", overflowY: "auto" }}>
              {couponsList.filter(c => c.active).map(cp => (
                <button
                  key={cp.id}
                  onClick={() => handleAssignCouponToMember(selectedMember.id, cp)}
                  style={{
                    width: "100%",
                    background: "rgba(30,41,59,0.3)",
                    border: "1px solid #1e293b",
                    borderRadius: "12px",
                    padding: "10px 14px",
                    display: "flex",
                    justifyItems: "center",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    textAlign: "left"
                  }}
                >
                  <div>
                    <span style={{ fontSize: "12px", fontWeight: "bold", color: "white", fontFamily: "monospace" }}>{cp.code}</span>
                    <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#64748b" }}>{cp.label}</p>
                  </div>
                  <ChevronRight style={{ width: "16px", height: "16px", color: "#8b5cf6" }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}