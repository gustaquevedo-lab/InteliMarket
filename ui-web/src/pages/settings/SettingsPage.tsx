import { useState, useEffect } from "react"
import { Building2, CreditCard, DollarSign, Layers, Plus, Shield, Loader2, X, CheckCircle, AlertCircle } from "lucide-react"
import { api, type Company, type SifenTimbrado, type Currency, type PaymentMethod, type Vertical, type CompanyVerticalConfig } from "../../api"
import { useToast } from "../../context/ToastContext"

const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

const featureLabels: Record<string, string> = {
  inventario: "Inventario",
  ventas: "Ventas",
  compras: "Compras",
  caja: "Caja",
  facturacion_electronica: "Facturación Electrónica",
  clientes: "Clientes",
  proveedores: "Proveedores",
  reportes: "Reportes",
  pagos_electronicos: "Pagos Electrónicos",
  creditos: "Créditos",
  logistica: "Logística",
  multi_moneda: "Multi-Moneda",
  multi_sucursal: "Multi-Sucursal",
}

const ALL_FEATURES = Object.entries(featureLabels).map(([key, label]) => ({ key, label }))

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState("company")
  const [companies, setCompanies] = useState<Company[]>([])
  const [timbrados, setTimbrados] = useState<SifenTimbrado[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [saving, setSaving] = useState(false)

  const [showTimbradoModal, setShowTimbradoModal] = useState(false)
  const [showCurrencyModal, setShowCurrencyModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  const [timbradoForm, setTimbradoForm] = useState({ numero: "", fecha_inicio: "", fecha_fin: "", rango_desde: 0, rango_hasta: 0 })
  const [fiscalStatus, setFiscalStatus] = useState<{
    modo_emision: string
    punto_emision_default: string | null
    puntos_emision: { punto_emision: string; establecimiento: string; tipo_documento: string; numero_actual: number; numero_final: number; disponibles: number; timbrado_numero: string; timbrado_fecha_fin: string; timbrado_vencido: boolean }[]
  } | null>(null)
  const [savingModo, setSavingModo] = useState(false)
  const [currencyForm, setCurrencyForm] = useState({ codigo: "", nombre: "", simbolo: "" })
  const [paymentForm, setPaymentForm] = useState({ nombre: "", tipo: "efectivo" })

  const [companyForm, setCompanyForm] = useState<Partial<Company>>({})

  const [verticals, setVerticals] = useState<Vertical[]>([])
  const [companyVerticalConfig, setCompanyVerticalConfig] = useState<CompanyVerticalConfig | null>(null)
  const [selectedVerticalId, setSelectedVerticalId] = useState("")
  const [customFeatures, setCustomFeatures] = useState<string[]>([])
  const [savingVertical, setSavingVertical] = useState(false)

  const toast = useToast()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [comp, timb, curr, pay, vert, vertConfig, fiscalSt] = await Promise.allSettled([
        api.companies.list(),
        api.sifen.timbrados.list(),
        api.settings.currencies.list(),
        api.paymentMethods.list(),
        api.verticals.list(),
        api.verticals.getCompanyConfig(),
        api.fiscal.status(COMPANY_ID),
      ])
      if (comp.status === "fulfilled" && comp.value.length > 0) {
        setCompanies(comp.value)
        setCompanyForm(comp.value[0])
      }
      if (timb.status === "fulfilled") setTimbrados(timb.value)
      if (curr.status === "fulfilled") setCurrencies(curr.value)
      if (pay.status === "fulfilled") setPaymentMethods(pay.value)
      if (vert.status === "fulfilled") setVerticals(vert.value)
      if (vertConfig.status === "fulfilled") {
        setCompanyVerticalConfig(vertConfig.value)
        setSelectedVerticalId(vertConfig.value.vertical_id || "")
        setCustomFeatures(vertConfig.value.features || [])
      }
      if (fiscalSt.status === "fulfilled") setFiscalStatus(fiscalSt.value)
    } catch {
      toast.error("Error", "No se pudo cargar la configuración")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (companyForm.id) {
        await api.companies.update(companyForm.id, companyForm)
        toast.success("Empresa actualizada", "Datos guardados correctamente")
      }
    } catch {
      toast.error("Error", "No se pudo guardar")
    } finally {
      setSaving(false)
    }
  }

  const handleSaveVertical = async () => {
    setSavingVertical(true)
    try {
      const features = selectedVerticalId && selectedVerticalId !== "personalizado"
        ? verticals.find(v => v.id === selectedVerticalId)?.features || []
        : customFeatures
      await api.verticals.updateCompanyConfig({
        vertical_id: selectedVerticalId === "personalizado" ? undefined : selectedVerticalId || undefined,
        features,
      })
      toast.success("Vertical guardado", "Configuración de vertical actualizada")
      const newConfig = await api.verticals.getCompanyConfig()
      setCompanyVerticalConfig(newConfig)
    } catch {
      toast.error("Error", "No se pudo guardar la configuración")
    } finally {
      setSavingVertical(false)
    }
  }

  const handleChangeModoEmision = async (modo: string) => {
    if (!fiscalStatus) return
    setSavingModo(true)
    try {
      await api.fiscal.config.upsert(COMPANY_ID, {
        company_id: COMPANY_ID,
        modo_emision: modo,
        punto_emision: fiscalStatus.punto_emision_default || "001",
      })
      toast.success("Modo de facturación actualizado", modo === "sifen" ? "Facturación Electrónica activada" : "Autoimpresor activado")
      const st = await api.fiscal.status(COMPANY_ID)
      setFiscalStatus(st)
    } catch {
      toast.error("Error", "No se pudo cambiar el modo de facturación")
    } finally {
      setSavingModo(false)
    }
  }

  const handleCreateTimbrado = async () => {
    if (!timbradoForm.numero || !timbradoForm.fecha_inicio || !timbradoForm.fecha_fin) {
      toast.error("Error", "Completá todos los campos obligatorios")
      return
    }
    try {
      await api.sifen.timbrados.create(timbradoForm)
      toast.success("Timbrado creado", "Timbrado registrado correctamente")
      setShowTimbradoModal(false)
      setTimbradoForm({ numero: "", fecha_inicio: "", fecha_fin: "", rango_desde: 0, rango_hasta: 0 })
      fetchData()
    } catch {
      toast.error("Error", "No se pudo crear el timbrado")
    }
  }

  const handleCreateCurrency = async () => {
    if (!currencyForm.codigo || !currencyForm.nombre) {
      toast.error("Error", "Completá todos los campos obligatorios")
      return
    }
    try {
      await api.settings.currencies.create(currencyForm)
      toast.success("Moneda creada", "Moneda registrada correctamente")
      setShowCurrencyModal(false)
      setCurrencyForm({ codigo: "", nombre: "", simbolo: "" })
      fetchData()
    } catch {
      toast.error("Error", "No se pudo crear la moneda")
    }
  }

  const handleCreatePaymentMethod = async () => {
    if (!paymentForm.nombre) {
      toast.error("Error", "Ingresá un nombre")
      return
    }
    try {
      await api.paymentMethods.create(paymentForm)
      toast.success("Método creado", "Método de pago registrado")
      setShowPaymentModal(false)
      setPaymentForm({ nombre: "", tipo: "efectivo" })
      fetchData()
    } catch {
      toast.error("Error", "No se pudo crear el método de pago")
    }
  }

  const togglePaymentMethod = async (id: string, current: boolean) => {
    try {
      await api.paymentMethods.update(id, { activo: !current })
      toast.success("Estado actualizado", !current ? "Método activado" : "Método desactivado")
      fetchData()
    } catch {
      toast.error("Error", "No se pudo actualizar")
    }
  }

  const sections = [
    { id: "company", label: "Empresa", icon: Building2 },
    { id: "timbrados", label: "Timbrados", icon: Shield },
    { id: "currencies", label: "Monedas", icon: DollarSign },
    { id: "payments", label: "Métodos de pago", icon: CreditCard },
    { id: "verticals", label: "Vertical", icon: Layers },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Configuración</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Ajustes del sistema y datos de la empresa</p>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeSection === s.id ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}
          >
            <s.icon className="w-4 h-4" />
            {s.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {!loading && activeSection === "company" && (
        <div className="card p-6 max-w-2xl">
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">Datos de la empresa</h3>
          <form onSubmit={handleSaveCompany} className="space-y-4">
            <div>
              <label className="input-label label-required">Razón social</label>
              <input className="input-field" value={companyForm.razon_social || ""} onChange={(e) => setCompanyForm({ ...companyForm, razon_social: e.target.value })} placeholder="Distribuidora del Este S.A." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label label-required">RUC</label>
                <input className="input-field" value={companyForm.ruc || ""} onChange={(e) => setCompanyForm({ ...companyForm, ruc: e.target.value })} placeholder="80012345-6" />
              </div>
              <div>
                <label className="input-label">Teléfono</label>
                <input className="input-field" value={companyForm.telefono || ""} onChange={(e) => setCompanyForm({ ...companyForm, telefono: e.target.value })} placeholder="021-456789" />
              </div>
            </div>
            <div>
              <label className="input-label">Email</label>
              <input className="input-field" value={companyForm.email || ""} onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })} placeholder="info@empresa.com.py" />
            </div>
            <div>
              <label className="input-label">Dirección fiscal</label>
              <input className="input-field" value={companyForm.direccion || ""} onChange={(e) => setCompanyForm({ ...companyForm, direccion: e.target.value })} placeholder="Av. Mariscal López 1234, Asunción" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Condición IVA</label>
                <select className="input-field" value={companyForm.iva_condition || ""} onChange={(e) => setCompanyForm({ ...companyForm, iva_condition: e.target.value })}>
                  <option value="">Seleccionar</option>
                  <option value="contribuyente">Contribuyente</option>
                  <option value="contribuyente_especial">Contribuyente especial</option>
                  <option value="exento">Exento</option>
                </select>
              </div>
              <div>
                <label className="input-label">Régimen tributario</label>
                <select className="input-field" value={companyForm.regimen_tributario || ""} onChange={(e) => setCompanyForm({ ...companyForm, regimen_tributario: e.target.value })}>
                  <option value="">Seleccionar</option>
                  <option value="general">Régimen General</option>
                  <option value="simple">Régimen Simple</option>
                  <option value="maquila">Maquila</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {!loading && activeSection === "timbrados" && (
        <div className="space-y-4">
          {fiscalStatus && (
            <div className="card p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">Modo de facturación</h3>
                  <p className="text-sm text-gray-500">
                    {fiscalStatus.modo_emision === "autoimpresor" && "Facturando como Autoimpresor (timbrado propio, impresión local) — no obligado por ley a Facturación Electrónica todavía."}
                    {fiscalStatus.modo_emision === "sifen" && "Facturación Electrónica (SIFEN) activada."}
                    {fiscalStatus.modo_emision === "preimpreso" && "Facturando con talonario preimpreso."}
                    {fiscalStatus.modo_emision === "sin_configurar" && "Sin configurar todavía."}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${fiscalStatus.modo_emision === "autoimpresor" ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-500"}`}
                    disabled={savingModo}
                    onClick={() => handleChangeModoEmision("autoimpresor")}
                  >
                    Autoimpresor
                  </button>
                  <button
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${fiscalStatus.modo_emision === "sifen" ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-500"}`}
                    disabled={savingModo}
                    onClick={() => handleChangeModoEmision("sifen")}
                  >
                    Facturación Electrónica
                  </button>
                </div>
              </div>
              {fiscalStatus.puntos_emision.length > 0 && (
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-gray-500"><th className="p-2">Punto de emisión</th><th className="p-2">Timbrado</th><th className="p-2">Vence</th><th className="p-2">Próximo número</th><th className="p-2 text-right">Disponibles</th></tr></thead>
                    <tbody>
                      {fiscalStatus.puntos_emision.filter(p => p.tipo_documento === "factura").map((p, i) => (
                        <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                          <td className="p-2 font-mono font-bold">{p.establecimiento}-{p.punto_emision}</td>
                          <td className="p-2 font-mono text-xs">{p.timbrado_numero}</td>
                          <td className="p-2 text-xs">
                            <span className={p.timbrado_vencido ? "text-red-500 font-bold" : "text-gray-500"}>
                              {new Date(p.timbrado_fecha_fin).toLocaleDateString("es-PY")}
                            </span>
                          </td>
                          <td className="p-2 font-mono text-xs">{p.establecimiento}-{p.punto_emision}-{String(p.numero_actual).padStart(7, "0")}</td>
                          <td className={`p-2 text-right font-mono font-bold ${p.disponibles < 500 ? "text-amber-500" : "text-gray-700 dark:text-gray-300"}`}>{p.disponibles.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Timbrados registrados</h3>
              <p className="text-sm text-gray-500">{timbrados.length} timbrados</p>
            </div>
            <button className="btn-primary" onClick={() => setShowTimbradoModal(true)}><Plus className="w-4 h-4" />Nuevo timbrado</button>
          </div>
          {timbrados.length === 0 ? (
            <div className="card p-12 flex flex-col items-center text-gray-400">
              <Shield className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-bold">Sin timbrados registrados</p>
              <p className="text-xs mt-1">Agregá tu timbrado de la SET para poder emitir comprobantes</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="table-cell">Número</th>
                    <th className="table-cell">Inicio</th>
                    <th className="table-cell">Fin</th>
                    <th className="table-cell">Vencimiento</th>
                    <th className="table-cell">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {timbrados.map((t) => {
                    const isActive = t.activo && new Date(t.fecha_fin ?? "") > new Date()
                    return (
                      <tr key={t.id} className="table-row">
                        <td className="table-td font-mono text-sm">{t.numero}</td>
                        <td className="table-td font-mono">{(t.rango_desde ?? 0).toLocaleString()}</td>
                        <td className="table-td font-mono">{(t.rango_hasta ?? 0).toLocaleString()}</td>
                        <td className="table-td text-sm">{new Date(t.fecha_fin ?? "").toLocaleDateString("es-PY")}</td>
                        <td className="table-td">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold ${isActive ? "badge-success" : "badge-danger"}`}>
                            {isActive ? <><CheckCircle className="w-3 h-3" /> Activo</> : <><AlertCircle className="w-3 h-3" /> {new Date(t.fecha_fin ?? "") < new Date() ? "Vencido" : "Inactivo"}</>}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && activeSection === "currencies" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Monedas configuradas</h3>
              <p className="text-sm text-gray-500">{currencies.length} monedas</p>
            </div>
            <div className="flex gap-2">
              <button className="btn-outline" onClick={async () => {
                try {
                  await api.settings.exchangeRates.sync()
                  toast.success("Tasas actualizadas", "Sincronizado con BCP")
                  fetchData()
                } catch {
                  toast.error("Error", "No se pudo sincronizar")
                }
              }}>Sincronizar BCP</button>
              <button className="btn-primary" onClick={() => setShowCurrencyModal(true)}><Plus className="w-4 h-4" />Nueva moneda</button>
            </div>
          </div>
          {currencies.length === 0 ? (
            <div className="card p-12 flex flex-col items-center text-gray-400">
              <DollarSign className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-bold">Sin monedas configuradas</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="table-cell">Moneda</th>
                    <th className="table-cell">Símbolo</th>
                    <th className="table-cell">Local</th>
                    <th className="table-cell">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {currencies.map((c) => (
                    <tr key={c.id} className="table-row">
                      <td className="table-td font-medium">{c.nombre} <span className="text-gray-400 font-mono text-sm">({c.codigo})</span></td>
                      <td className="table-td font-mono text-lg">{c.simbolo}</td>
                      <td className="table-td"><span className={`text-xs px-2 py-0.5 rounded-full font-bold ${c.es_moneda_local ? "badge-info" : "badge-accent"}`}>{c.es_moneda_local ? "Local" : "Extranjera"}</span></td>
                      <td className="table-td"><span className={c.activa ? "badge-success" : "badge-danger"}>{c.activa ? "Activa" : "Inactiva"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && activeSection === "payments" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Métodos de pago</h3>
              <p className="text-sm text-gray-500">{paymentMethods.length} métodos</p>
            </div>
            <button className="btn-primary" onClick={() => setShowPaymentModal(true)}><Plus className="w-4 h-4" />Nuevo método</button>
          </div>
          {paymentMethods.length === 0 ? (
            <div className="card p-12 flex flex-col items-center text-gray-400">
              <CreditCard className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-bold">Sin métodos de pago</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="table-cell">Nombre</th>
                    <th className="table-cell">Tipo</th>
                    <th className="table-cell">Moneda</th>
                    <th className="table-cell">Estado</th>
                    <th className="table-cell">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentMethods.map((p) => (
                    <tr key={p.id} className="table-row">
                      <td className="table-td font-medium">{p.nombre}</td>
                      <td className="table-td"><span className="badge-info capitalize">{p.tipo}</span></td>
                      <td className="table-td font-mono text-sm">{p.moneda}</td>
                      <td className="table-td"><span className={p.activo ? "badge-success" : "badge-danger"}>{p.activo ? "Activo" : "Inactivo"}</span></td>
                      <td className="table-td">
                        <button onClick={() => togglePaymentMethod(p.id, p.activo ?? false)} className="btn-ghost text-xs">{(p.activo ?? false) ? "Desactivar" : "Activar"}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && activeSection === "verticals" && (
        <div className="card p-6 max-w-2xl">
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">Vertical de negocio</h3>
          <div className="space-y-4">
            <div>
              <label className="input-label label-required">Seleccionar vertical</label>
              <select
                className="input-field"
                value={selectedVerticalId}
                onChange={(e) => {
                  const id = e.target.value
                  setSelectedVerticalId(id)
                  if (id && id !== "personalizado") {
                    const vertical = verticals.find(v => v.id === id)
                    if (vertical) setCustomFeatures(vertical.features)
                  }
                }}
              >
                <option value="">Seleccionar...</option>
                {verticals.map(v => (
                  <option key={v.id} value={v.id}>{v.nombre}</option>
                ))}
                <option value="personalizado">Personalizado</option>
              </select>
            </div>

            {selectedVerticalId && selectedVerticalId !== "personalizado" && (() => {
              const vertical = verticals.find(v => v.id === selectedVerticalId)
              if (!vertical) return null
              return (
                <>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{vertical.descripcion}</p>
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Funcionalidades incluidas:</p>
                    <div className="flex flex-wrap gap-2">
                      {vertical.features.map(f => (
                        <span key={f} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {featureLabels[f] || f}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )
            })()}

            {selectedVerticalId === "personalizado" && (
              <>
                <p className="text-sm text-gray-500 dark:text-gray-400">Seleccioná las funcionalidades que necesitás para tu negocio.</p>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_FEATURES.map(f => (
                    <label key={f.key} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customFeatures.includes(f.key)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCustomFeatures(prev => [...prev, f.key])
                          } else {
                            setCustomFeatures(prev => prev.filter(k => k !== f.key))
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{f.label}</span>
                    </label>
                  ))}
                </div>
              </>
            )}

            {selectedVerticalId && (
              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-primary" disabled={savingVertical} onClick={handleSaveVertical}>
                  {savingVertical ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar configuración"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timbrado Modal */}
      {showTimbradoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowTimbradoModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nuevo timbrado</h3>
              <button onClick={() => setShowTimbradoModal(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Número de timbrado</label>
                <input className="input-field" placeholder="001-001-0000100" value={timbradoForm.numero} onChange={(e) => setTimbradoForm({ ...timbradoForm, numero: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Fecha inicio</label>
                  <input className="input-field" type="date" value={timbradoForm.fecha_inicio} onChange={(e) => setTimbradoForm({ ...timbradoForm, fecha_inicio: e.target.value })} />
                </div>
                <div>
                  <label className="label">Fecha fin</label>
                  <input className="input-field" type="date" value={timbradoForm.fecha_fin} onChange={(e) => setTimbradoForm({ ...timbradoForm, fecha_fin: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Rango desde</label>
                  <input className="input-field" type="number" placeholder="1" value={timbradoForm.rango_desde || ""} onChange={(e) => setTimbradoForm({ ...timbradoForm, rango_desde: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="label">Rango hasta</label>
                  <input className="input-field" type="number" placeholder="50000" value={timbradoForm.rango_hasta || ""} onChange={(e) => setTimbradoForm({ ...timbradoForm, rango_hasta: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button className="btn-ghost" onClick={() => setShowTimbradoModal(false)}>Cancelar</button>
                <button className="btn-primary" onClick={handleCreateTimbrado}>Crear</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Currency Modal */}
      {showCurrencyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCurrencyModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nueva moneda</h3>
              <button onClick={() => setShowCurrencyModal(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Código ISO</label>
                <input className="input-field" placeholder="USD" value={currencyForm.codigo} onChange={(e) => setCurrencyForm({ ...currencyForm, codigo: e.target.value.toUpperCase() })} maxLength={3} />
              </div>
              <div>
                <label className="label">Nombre</label>
                <input className="input-field" placeholder="Dólar estadounidense" value={currencyForm.nombre} onChange={(e) => setCurrencyForm({ ...currencyForm, nombre: e.target.value })} />
              </div>
              <div>
                <label className="label">Símbolo</label>
                <input className="input-field" placeholder="$" value={currencyForm.simbolo} onChange={(e) => setCurrencyForm({ ...currencyForm, simbolo: e.target.value })} />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button className="btn-ghost" onClick={() => setShowCurrencyModal(false)}>Cancelar</button>
                <button className="btn-primary" onClick={handleCreateCurrency}>Crear</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Method Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowPaymentModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nuevo método de pago</h3>
              <button onClick={() => setShowPaymentModal(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Nombre</label>
                <input className="input-field" placeholder="Efectivo" value={paymentForm.nombre} onChange={(e) => setPaymentForm({ ...paymentForm, nombre: e.target.value })} />
              </div>
              <div>
                <label className="label">Tipo</label>
                <select className="input-field" value={paymentForm.tipo} onChange={(e) => setPaymentForm({ ...paymentForm, tipo: e.target.value })}>
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="billetera">Billetera</option>
                  <option value="cheque">Cheque</option>
                  <option value="credito">Crédito</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button className="btn-ghost" onClick={() => setShowPaymentModal(false)}>Cancelar</button>
                <button className="btn-primary" onClick={handleCreatePaymentMethod}>Crear</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
