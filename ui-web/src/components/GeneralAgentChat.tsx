import { useState, useRef, useEffect } from "react"
import { Bot, Send, Loader2, Sparkles } from "lucide-react"
import { api } from "../api"

interface ChatMsg {
  role: "user" | "assistant"
  content: string
}

const SUGERENCIAS = [
  "¿Cómo van las ventas de hoy?",
  "¿Cuáles son los productos que más se venden?",
  "¿Cómo está la situación financiera?",
  "¿Hay algo que debería preocuparme?",
]

export function GeneralAgentChat() {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, sending])

  const send = async (text?: string) => {
    const message = (text ?? input).trim()
    if (!message || sending) return
    setError(null)
    setInput("")
    const history = messages
    setMessages(prev => [...prev, { role: "user", content: message }])
    setSending(true)
    try {
      const res = await api.generalAgent.chat(message, history)
      setMessages(prev => [...prev, { role: "assistant", content: res.reply }])
    } catch (e: any) {
      setError(e.message || "El Gerente General IA no pudo responder")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="card p-5 lg:col-span-4 flex flex-col" style={{ minHeight: 380 }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center text-white flex-shrink-0">
          <Bot size={20} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Gerente General IA</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Preguntale sobre ventas, finanzas o stock — responde con datos reales</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1" style={{ maxHeight: 260 }}>
        {messages.length === 0 ? (
          <div className="flex flex-wrap gap-2 pt-2">
            {SUGERENCIAS.map(s => (
              <button
                key={s}
                onClick={() => send(s)}
                className="text-xs px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-1"
              >
                <Sparkles size={11} /> {s}
              </button>
            ))}
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-primary text-white rounded-br-sm"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-2.5">
              <Loader2 size={16} className="animate-spin text-gray-400" />
            </div>
          </div>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700/50">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send() }}
          placeholder="Preguntale algo al Gerente General IA..."
          className="input-field flex-1 text-sm"
          disabled={sending}
        />
        <button
          onClick={() => send()}
          disabled={sending || !input.trim()}
          className="btn-primary !px-3 !py-2 flex-shrink-0"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  )
}
