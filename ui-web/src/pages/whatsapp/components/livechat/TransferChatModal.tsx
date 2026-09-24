import React, { useState, useEffect } from "react"
import { X, UserCheck, Users, CornerDownRight, Loader2, Building2, MessageSquareText } from "lucide-react"
import { api } from "../../../../api"

interface Agent {
  id: string
  nombre: string
  email: string
  rol: string
  foto_url?: string
}

interface TransferChatModalProps {
  convId: string
  contactName: string
  currentDepartment?: string
  currentAgentId?: string | null
  onClose: () => void
  onSuccess: (assignedName?: string, department?: string) => void
}

const DEPARTMENTS = [
  { id: "ventas", label: "Ventas & Carnicería / Mayorista", icon: "🥩" },
  { id: "envios", label: "Envíos & Delivery a Domicilio", icon: "🛵" },
  { id: "cajas", label: "Cajas & Pagos / Cobranzas", icon: "💵" },
  { id: "atencion", label: "Atención al Cliente & Reclamos", icon: "🤝" },
  { id: "general", label: "Cola General / Recepción", icon: "🏢" },
]

export const TransferChatModal: React.FC<TransferChatModalProps> = ({
  convId,
  contactName,
  currentDepartment = "general",
  currentAgentId,
  onClose,
  onSuccess,
}) => {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [selectedAgentId, setSelectedAgentId] = useState<string>(currentAgentId || "")
  const [selectedDept, setSelectedDept] = useState<string>(currentDepartment || "general")
  const [internalNote, setInternalNote] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const fetchAgents = async () => {
      setLoadingAgents(true)
      try {
        const list = await api.whatsapp.listAgents()
        setAgents(list || [])
      } catch (e) {
        console.error("Error al cargar agentes:", e)
      } finally {
        setLoadingAgents(false)
      }
    }
    fetchAgents()
  }, [])

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await api.whatsapp.assignConversation(convId, {
        assigned_user_id: selectedAgentId ? selectedAgentId : null,
        department: selectedDept,
        internal_note: internalNote.trim() || undefined,
      })
      onSuccess(res.assigned_user_name, res.department)
      onClose()
    } catch (err: any) {
      alert("Error al transferir: " + (err?.response?.data?.detail || err?.message || "No se pudo transferir"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <CornerDownRight className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Derivar / Transferir Conversación</h3>
              <p className="text-[11px] text-slate-500">Cliente: <span className="font-semibold text-slate-700 dark:text-slate-300">{contactName}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleTransfer} className="p-5 space-y-4">
          {/* Selector de Departamento */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-500" /> Departamento / Área de Destino
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEPARTMENTS.map((dept) => {
                const isSelected = selectedDept === dept.id
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => setSelectedDept(dept.id)}
                    className={`p-2.5 rounded-2xl border text-left text-xs transition-all flex items-center gap-2 ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold shadow-sm"
                        : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <span className="text-base shrink-0">{dept.icon}</span>
                    <span className="truncate">{dept.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selector de Operador / Agente Específico */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-500" /> Asignar a un Operador Específico (Opcional)
            </label>
            {loadingAgents ? (
              <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> Cargando lista de colaboradores...
              </div>
            ) : (
              <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 p-1">
                <button
                  type="button"
                  onClick={() => setSelectedAgentId("")}
                  className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                    !selectedAgentId
                      ? "bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-300">
                      👥
                    </span>
                    <span>Cualquier operador del departamento (Sin asignar específico)</span>
                  </span>
                  {!selectedAgentId && <UserCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                </button>

                {agents.map((ag) => {
                  const isSelected = selectedAgentId === ag.id
                  return (
                    <button
                      key={ag.id}
                      type="button"
                      onClick={() => setSelectedAgentId(ag.id)}
                      className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                        isSelected
                          ? "bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {ag.nombre.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate">{ag.nombre}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 shrink-0 capitalize">
                          {ag.rol}
                        </span>
                      </span>
                      {isSelected && <UserCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Nota Interna de Traspaso (Whisper) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <MessageSquareText className="w-3.5 h-3.5 text-amber-500" /> Nota Interna de Traspaso (Privada para el equipo)
            </label>
            <textarea
              rows={3}
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              placeholder="Ej: El cliente solicita presupuesto mayorista de 50 kg de carne para retiro el sábado por la mañana..."
              className="w-full text-xs p-3 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/20 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <p className="text-[10px] text-amber-700/80 dark:text-amber-400/70 mt-1">
              🔒 Esta nota quedará fijada en el historial y NO se envía al WhatsApp del cliente.
            </p>
          </div>

          {/* Botones de Acción */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950/20 transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Derivando...
                </>
              ) : (
                <>
                  <CornerDownRight className="w-4 h-4" /> Confirmar Derivación
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
