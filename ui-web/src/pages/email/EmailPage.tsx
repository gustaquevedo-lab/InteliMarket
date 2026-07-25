import { useState, useEffect } from "react"
import { Mail, Settings, Send, Loader2, Save, CheckCircle } from "lucide-react"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"

type Tab = "config" | "test"

export default function EmailPage() {
  const [tab, setTab] = useState<Tab>("config")
  const [config, setConfig] = useState({
    smtp_host: "",
    smtp_port: 587,
    smtp_user: "",
    smtp_password: "",
    from_email: "",
    from_name: "",
    use_tls: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testForm, setTestForm] = useState({ to: "", subject: "", body: "" })
  const [testing, setTesting] = useState(false)
  const toast = useToast()

  const fetchConfig = async () => {
    setLoading(true)
    try {
      const data = await api.email.config()
      if (data) {
        setConfig({
          smtp_host: data.smtp_host || "",
          smtp_port: data.smtp_port || 587,
          smtp_user: data.smtp_user || "",
          smtp_password: data.smtp_password || "",
          from_email: data.from_email || "",
          from_name: data.from_name || "",
          use_tls: data.use_tls ?? true,
        })
      }
    } catch {
      toast.info("Datos demo", "Configurá el servidor SMTP")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchConfig() }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.email.updateConfig(config)
      toast.success("Configuración guardada", "Los cambios se aplicaron correctamente")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error guardando configuración"
      toast.error("Error", msg)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!testForm.to || !testForm.subject || !testForm.body) {
      toast.error("Error", "Completá todos los campos")
      return
    }
    setTesting(true)
    try {
      await api.email.test(testForm)
      toast.success("Email enviado", "Revisá la bandeja de entrada")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error enviando email"
      toast.error("Error", msg)
    } finally {
      setTesting(false)
    }
  }

  const tabs: { key: Tab; label: string; icon: typeof Settings }[] = [
    { key: "config", label: "Configuración", icon: Settings },
    { key: "test", label: "Probar", icon: Send },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Mail className="w-6 h-6 text-primary" />
            Email
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configuración de correo SMTP</p>
        </div>
        {tab === "config" && (
          <button onClick={handleSave} className="btn-primary" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "config" && (
        <div className="card p-6 max-w-2xl">
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Host SMTP</label>
                  <input className="input-field" placeholder="smtp.gmail.com" value={config.smtp_host} onChange={(e) => setConfig({ ...config, smtp_host: e.target.value })} />
                </div>
                <div>
                  <label className="input-label">Puerto</label>
                  <input className="input-field" type="number" placeholder="587" value={config.smtp_port} onChange={(e) => setConfig({ ...config, smtp_port: parseInt(e.target.value) || 587 })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Usuario</label>
                  <input className="input-field" placeholder="tu@email.com" value={config.smtp_user} onChange={(e) => setConfig({ ...config, smtp_user: e.target.value })} />
                </div>
                <div>
                  <label className="input-label">Contraseña</label>
                  <input className="input-field" type="password" placeholder="••••••••" value={config.smtp_password} onChange={(e) => setConfig({ ...config, smtp_password: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Email desde</label>
                  <input className="input-field" placeholder="no-reply@ejemplo.com" value={config.from_email} onChange={(e) => setConfig({ ...config, from_email: e.target.value })} />
                </div>
                <div>
                  <label className="input-label">Nombre desde</label>
                  <input className="input-field" placeholder="InteliMarket" value={config.from_name} onChange={(e) => setConfig({ ...config, from_name: e.target.value })} />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300" checked={config.use_tls} onChange={(e) => setConfig({ ...config, use_tls: e.target.checked })} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Usar TLS</span>
              </label>
              {!loading && config.smtp_host && (
                <div className="flex items-center gap-2 pt-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle className="w-4 h-4" />
                  Configuración cargada
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "test" && (
        <div className="card p-6 max-w-2xl">
          <div className="space-y-4">
            <div>
              <label className="input-label label-required">Para</label>
              <input className="input-field" type="email" placeholder="destino@email.com" value={testForm.to} onChange={(e) => setTestForm({ ...testForm, to: e.target.value })} />
            </div>
            <div>
              <label className="input-label label-required">Asunto</label>
              <input className="input-field" placeholder="Email de prueba" value={testForm.subject} onChange={(e) => setTestForm({ ...testForm, subject: e.target.value })} />
            </div>
            <div>
              <label className="input-label label-required">Cuerpo</label>
              <textarea className="input-field min-h-[120px]" placeholder="Este es un correo de prueba..." value={testForm.body} onChange={(e) => setTestForm({ ...testForm, body: e.target.value })} />
            </div>
            <button className="btn-primary" onClick={handleTest} disabled={testing}>
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar email de prueba
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
