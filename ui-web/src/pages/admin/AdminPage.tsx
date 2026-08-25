import { useState, useEffect } from "react"
import { Shield, Users, DollarSign, TrendingUp, Search, Loader2, Edit, Check, X, Database, Download, Trash2, HardDrive, Clock, Calendar, Save, LayoutGrid, Pill, Store, Truck, ShoppingCart, Briefcase, Cog, CreditCard, Wallet, Smartphone, QrCode, Building } from "lucide-react"
import { api, type Tenant, type Backup, type BackupScheduleConfig } from "../../api"
import { useToast } from "../../context/ToastContext"
import { StatusBadge } from "../../components/DataTable"
import { formatPYG } from "../../utils/format"

type BackupSchedule = BackupScheduleConfig

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"tenants" | "backups" | "schedule" | "vertical">("tenants")
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [stats, setStats] = useState<{ total_tenants: number; by_plan: Record<string, number>; by_estado: Record<string, number>; mrr_usd: number } | null>(null)
  const [plans, setPlans] = useState<Array<{ slug: string; nombre: string; precio_mensual_usd: number; features: string[]; limits: Record<string, unknown>; max_sucursales?: number; max_usuarios?: number; max_productos?: number; sifen?: boolean; integraciones?: boolean; soporte?: string }>>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [editingTenant, setEditingTenant] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ plan: "", estado: "" })
  const [saving, setSaving] = useState(false)
  const [backups, setBackups] = useState<Backup[]>([])
  const [backupsLoading, setBackupsLoading] = useState(false)
  const [creatingBackup, setCreatingBackup] = useState(false)
  const [backupForm, setBackupForm] = useState({ schema_name: "", tenant_id: "", tenant_slug: "" })
  const [schedule, setSchedule] = useState<BackupSchedule>({
    enabled: true,
    frequency: "daily",
    hour: 2,
    minute: 0,
    day_of_week: null,
    day_of_month: null,
    retention_days: 30,
    max_backups: null,
  })
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [savingSchedule, setSavingSchedule] = useState(false)

  // Vertical & Features state
  const [verticals, setVerticals] = useState<Array<{ slug: string; nombre: string; descripcion: string; features: string[]; config_defaults: Record<string, unknown>; payment_gateways: string[]; icon: string }>>([])
  const [allFeatures, setAllFeatures] = useState<Array<{ key: string; label: string }>>([])
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null)
  const [tenantConfig, setTenantConfig] = useState<{ tenant_id: string; tenant_nombre: string; plan: string; vertical_slug: string | null; enabled_features: string[]; payment_gateways: string[]; config_defaults: Record<string, unknown>; custom_features: boolean } | null>(null)
  const [configLoading, setConfigLoading] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [configForm, setConfigForm] = useState({ vertical_slug: "custom", enabled_features: [] as string[], payment_gateways: [] as string[], custom_features: false })

  const toast = useToast()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [tenantsData, statsData, plansData, verticalsData, featuresData] = await Promise.allSettled([
        api.admin.tenants(),
        api.admin.tenantStats(),
        api.admin.plans(),
        api.admin.verticals(),
        api.admin.features(),
      ])
      if (tenantsData.status === "fulfilled") setTenants(tenantsData.value)
      if (statsData.status === "fulfilled") setStats(statsData.value)
      if (plansData.status === "fulfilled") setPlans(plansData.value)
      if (verticalsData.status === "fulfilled") setVerticals(verticalsData.value)
      if (featuresData.status === "fulfilled") setAllFeatures(featuresData.value)
      if (tenantsData.status === "rejected") toast.error("Error de conexión", "Conectá el backend para ver datos reales")
    } catch {
      toast.error("Error", "No se pudieron cargar los datos")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    if (selectedTenantId && activeTab === "vertical") {
      loadTenantConfig(selectedTenantId)
    }
  }, [selectedTenantId, activeTab])

  const loadTenantConfig = async (tenantId: string) => {
    setConfigLoading(true)
    try {
      const config = await api.admin.getTenantConfig(tenantId)
      setTenantConfig(config)
      setConfigForm({
        vertical_slug: config.vertical_slug || "custom",
        enabled_features: config.enabled_features,
        payment_gateways: config.payment_gateways,
        custom_features: config.custom_features,
      })
    } catch {
      toast.error("Error", "No se pudo cargar la configuración del tenant")
    } finally {
      setConfigLoading(false)
    }
  }

  const handleSaveConfig = async () => {
    if (!selectedTenantId) return
    setSavingConfig(true)
    try {
      await api.admin.updateTenantConfig(selectedTenantId, configForm)
      toast.success("Configuración guardada", "Los cambios se aplicarán inmediatamente")
      loadTenantConfig(selectedTenantId)
    } catch {
      toast.error("Error", "No se pudo guardar la configuración")
    } finally {
      setSavingConfig(false)
    }
  }

  const handleResetConfig = async () => {
    if (!selectedTenantId) return
    setSavingConfig(true)
    try {
      await api.admin.resetTenantConfig(selectedTenantId)
      toast.success("Configuración restablecida", "Se aplicaron los valores por defecto del plan")
      loadTenantConfig(selectedTenantId)
    } catch {
      toast.error("Error", "No se pudo restablecer la configuración")
    } finally {
      setSavingConfig(false)
    }
  }

  const toggleFeature = (feature: string) => {
    setConfigForm(prev => ({
      ...prev,
      custom_features: true,
      enabled_features: prev.enabled_features.includes(feature)
        ? prev.enabled_features.filter(f => f !== feature)
        : [...prev.enabled_features, feature],
    }))
  }

  const togglePaymentGateway = (gateway: string) => {
    setConfigForm(prev => ({
      ...prev,
      payment_gateways: prev.payment_gateways.includes(gateway)
        ? prev.payment_gateways.filter(g => g !== gateway)
        : [...prev.payment_gateways, gateway],
    }))
  }

  const applyVerticalPreset = (verticalSlug: string) => {
    const vertical = verticals.find(v => v.slug === verticalSlug)
    if (!vertical) return
    setConfigForm({
      vertical_slug: verticalSlug,
      enabled_features: verticalSlug === "custom" ? configForm.enabled_features : vertical.features,
      payment_gateways: verticalSlug === "custom" ? configForm.payment_gateways : vertical.payment_gateways,
      custom_features: verticalSlug === "custom",
    })
  }

  const fetchBackups = async () => {
    setBackupsLoading(true)
    try {
      const data = await api.backups.list()
      setBackups(data)
    } catch {
      toast.error("Error de conexión", "Conectá el backend para ver backups")
    } finally {
      setBackupsLoading(false)
    }
  }

  useEffect(() => { if (activeTab === "backups") fetchBackups() }, [activeTab])
  useEffect(() => { if (activeTab === "schedule") fetchSchedule() }, [activeTab])

  const fetchSchedule = async () => {
    setScheduleLoading(true)
    try {
      const data = await api.backups.getSchedule()
      setSchedule({ ...data, frequency: data.frequency as BackupSchedule["frequency"] })
    } catch {
      toast.error("Error de conexión", "Conectá el backend para ver configuración de backups")
    } finally {
      setScheduleLoading(false)
    }
  }

  const handleSaveSchedule = async () => {
    setSavingSchedule(true)
    try {
      await api.backups.updateSchedule(schedule)
      toast.success("Programación guardada", "Los cambios se aplicarán en el próximo ciclo")
      fetchSchedule()
    } catch {
      toast.error("Error", "No se pudo guardar la programación")
    } finally {
      setSavingSchedule(false)
    }
  }

  const handleCreateBackup = async () => {
    if (!backupForm.schema_name) {
      toast.error("Error", "Ingresá el schema name")
      return
    }
    setCreatingBackup(true)
    try {
      await api.backups.create(backupForm.schema_name, backupForm.tenant_id || undefined, backupForm.tenant_slug || undefined)
      toast.success("Backup creado", "El backup se está procesando")
      setBackupForm({ schema_name: "", tenant_id: "", tenant_slug: "" })
      fetchBackups()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error creando backup"
      toast.error("Error", msg)
    } finally {
      setCreatingBackup(false)
    }
  }

  const handleDeleteBackup = async (id: string) => {
    try {
      await api.backups.delete(id)
      toast.success("Backup eliminado")
      fetchBackups()
    } catch {
      toast.error("Error", "No se pudo eliminar el backup")
    }
  }

  const handleCleanup = async () => {
    try {
      const result = await api.backups.cleanup()
      toast.success("Limpieza completada", `${result.deleted} backups expirados eliminados`)
      fetchBackups()
    } catch {
      toast.error("Error", "No se pudo limpiar backups expirados")
    }
  }

  const handleUpdatePlan = async (tenantId: string) => {
    if (!editForm.plan) return
    setSaving(true)
    try {
      await api.admin.updateTenantPlan(tenantId, editForm.plan)
      if (editForm.estado) await api.admin.updateTenantEstado(tenantId, editForm.estado)
      toast.success("Tenant actualizado")
      setEditingTenant(null)
      fetchData()
    } catch {
      toast.error("Error", "No se pudo actualizar el tenant")
    } finally {
      setSaving(false)
    }
  }

  const filtered = tenants.filter(t =>
    !search ||
    t.nombre.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-accent" />
            Administración SaaS
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestión de tenants, planes y backups</p>
        </div>
        <button onClick={fetchData} className="btn-outline">Actualizar</button>
      </div>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-2"><Users className="w-5 h-5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Tenants</span></div>
            <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">{stats.total_tenants}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-2"><DollarSign className="w-5 h-5 text-green-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">MRR (USD)</span></div>
            <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-green-500">${stats.mrr_usd.toLocaleString()}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-2"><TrendingUp className="w-5 h-5 text-blue-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Activos</span></div>
            <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-blue-500">{stats.by_estado?.activo ?? 0}</p>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-2"><Shield className="w-5 h-5 text-purple-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Plan Pro</span></div>
            <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-purple-500">{stats.by_plan?.pro ?? 0}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        <button onClick={() => setActiveTab("tenants")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "tenants" ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>Tenants</button>
        <button onClick={() => setActiveTab("vertical")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "vertical" ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>Vertical & Features</button>
        <button onClick={() => setActiveTab("backups")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "backups" ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>Backups</button>
        <button onClick={() => setActiveTab("schedule")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "schedule" ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700"}`}>Programación</button>
      </div>

      {activeTab === "tenants" ? (
        <>
          {plans.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <div key={plan.nombre} className="card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">{plan.nombre}</h4>
                    <span className="text-xl font-bold text-primary">${plan.precio_mensual_usd}<span className="text-xs text-gray-400 font-normal">/mes</span></span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">Sucursales</span><span className="font-bold">{plan.max_sucursales === -1 ? "Ilimitadas" : plan.max_sucursales}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Usuarios</span><span className="font-bold">{plan.max_usuarios === -1 ? "Ilimitados" : plan.max_usuarios}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Productos</span><span className="font-bold">{plan.max_productos === -1 ? "Ilimitados" : (plan.max_productos ?? 0).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">SIFEN</span><span className="font-bold">{plan.sifen ? "Sí" : "No"}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Integraciones</span><span className="font-bold">{plan.integraciones ? "Sí" : "No"}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Soporte</span><span className="font-bold capitalize">{plan.soporte}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input-field pl-10" placeholder="Buscar tenant por nombre o slug..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="table-cell">Nombre</th>
                  <th className="table-cell">Slug</th>
                  <th className="table-cell">Plan</th>
                  <th className="table-cell">Estado</th>
                  <th className="table-cell">Inicio</th>
                  <th className="table-cell">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400">No se encontraron tenants</td></tr>
                ) : (
                  filtered.map((t) => (
                    <tr key={t.id} className="table-row">
                      {editingTenant === t.id ? (
                        <>
                          <td className="table-td font-medium">{t.nombre}</td>
                          <td className="table-td font-mono text-xs">{t.slug}</td>
                          <td className="table-td">
                            <select className="input-field text-sm py-1" value={editForm.plan} onChange={(e) => setEditForm({ ...editForm, plan: e.target.value })}>
                              <option value="">Sin cambio</option>
                              {plans.map(p => <option key={p.nombre} value={p.nombre.toLowerCase()}>{p.nombre}</option>)}
                            </select>
                          </td>
                          <td className="table-td">
                            <select className="input-field text-sm py-1" value={editForm.estado} onChange={(e) => setEditForm({ ...editForm, estado: e.target.value })}>
                              <option value="">Sin cambio</option>
                              <option value="activo">Activo</option>
                              <option value="suspendido">Suspendido</option>
                              <option value="cancelado">Cancelado</option>
                            </select>
                          </td>
                          <td className="table-td text-sm text-gray-500">{t.fecha_inicio ? new Date(t.fecha_inicio).toLocaleDateString("es-PY") : "-"}</td>
                          <td className="table-td">
                            <div className="flex items-center gap-1">
                              <button className="btn-ghost text-green-500" onClick={() => handleUpdatePlan(t.id)} disabled={saving}><Check className="w-4 h-4" /></button>
                              <button className="btn-ghost text-red-500" onClick={() => setEditingTenant(null)}><X className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="table-td font-medium">{t.nombre || "-"}</td>
                          <td className="table-td font-mono text-xs">{t.slug || "-"}</td>
                          <td className="table-td"><StatusBadge status={t.plan || "-"} map={{ starter: "badge-info", pro: "badge-accent", enterprise: "badge-warning" }} /></td>
                          <td className="table-td"><StatusBadge status={t.estado || "-"} /></td>
                          <td className="table-td text-sm text-gray-500">{t.fecha_inicio ? new Date(t.fecha_inicio).toLocaleDateString("es-PY") : "-"}</td>
                          <td className="table-td">
                            <button className="btn-ghost" title="Editar" onClick={() => { setEditingTenant(t.id); setEditForm({ plan: "", estado: "" }) }}><Edit className="w-4 h-4" /></button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : activeTab === "vertical" ? (
        <>
          {/* Tenant selector */}
          <div className="card p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-accent" />
              Seleccionar Tenant
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tenants.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTenantId(t.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedTenantId === t.id
                      ? "border-accent bg-accent/5 dark:bg-accent/10"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <div className="font-bold text-gray-900 dark:text-white">{t.nombre || "-"}</div>
                  <div className="text-xs text-gray-500 font-mono">{t.slug || "-"}</div>
                  <div className="flex gap-2 mt-2">
                    <StatusBadge status={t.plan || "-"} map={{ starter: "badge-info", pro: "badge-accent", enterprise: "badge-warning" }} />
                    <StatusBadge status={t.estado || "-"} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedTenantId && tenantConfig && (
            <>
              {/* Vertical preset selector */}
              <div className="card p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Vertical del Tenant</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                  {verticals.map(v => {
                    const iconMap: Record<string, React.ReactNode> = {
                      store: <Store className="w-5 h-5" />,
                      truck: <Truck className="w-5 h-5" />,
                      pill: <Pill className="w-5 h-5" />,
                      "shopping-cart": <ShoppingCart className="w-5 h-5" />,
                      briefcase: <Briefcase className="w-5 h-5" />,
                      cog: <Cog className="w-5 h-5" />,
                    }
                    return (
                      <button
                        key={v.slug}
                        onClick={() => applyVerticalPreset(v.slug)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          configForm.vertical_slug === v.slug
                            ? "border-accent bg-accent/5 dark:bg-accent/10"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-accent">{iconMap[v.icon] || <Cog className="w-5 h-5" />}</span>
                          <span className="font-bold text-gray-900 dark:text-white">{v.nombre}</span>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2">{v.descripcion}</p>
                        <div className="text-xs text-gray-400 mt-2">{v.features.length} módulos · {v.payment_gateways.length} pasarelas</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Feature toggles */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Módulos Habilitados</h3>
                  <span className="text-sm text-gray-500">{configForm.enabled_features.length} / {allFeatures.length}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {allFeatures.map(f => {
                    const enabled = configForm.enabled_features.includes(f.key)
                    return (
                      <label
                        key={f.key}
                        className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                          enabled
                            ? "border-accent bg-accent/5 dark:bg-accent/10"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={() => toggleFeature(f.key)}
                          className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{f.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Payment gateways */}
              <div className="card p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Pasarelas de Pago</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {[
                    { key: "pagopar", label: "Pagopar", icon: <CreditCard className="w-5 h-5" /> },
                    { key: "kuapay", label: "Kuapay", icon: <Wallet className="w-5 h-5" /> },
                    { key: "bancard", label: "Bancard VPOS", icon: <CreditCard className="w-5 h-5" /> },
                    { key: "spi", label: "SPI / QR BCP", icon: <QrCode className="w-5 h-5" /> },
                    { key: "dinelco", label: "Dinelco", icon: <Building className="w-5 h-5" /> },
                  ].map(pg => {
                    const enabled = configForm.payment_gateways.includes(pg.key)
                    return (
                      <button
                        key={pg.key}
                        onClick={() => togglePaymentGateway(pg.key)}
                        className={`p-4 rounded-xl border-2 text-center transition-all ${
                          enabled
                            ? "border-accent bg-accent/5 dark:bg-accent/10"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <span className={enabled ? "text-accent" : "text-gray-400"}>{pg.icon}</span>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{pg.label}</span>
                          <span className={`text-xs ${enabled ? "text-accent" : "text-gray-400"}`}>{enabled ? "Activo" : "Inactivo"}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <button className="btn-outline" onClick={handleResetConfig} disabled={savingConfig}>
                  Restablecer plan
                </button>
                <button className="btn-primary flex items-center gap-2" onClick={handleSaveConfig} disabled={savingConfig}>
                  {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar configuración
                </button>
              </div>
            </>
          )}

          {!selectedTenantId && (
            <div className="card p-12 text-center">
              <LayoutGrid className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Seleccioná un tenant para configurar su vertical y módulos</p>
            </div>
          )}
        </>
      ) : activeTab === "backups" ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2"><Database className="w-5 h-5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Backups</span></div>
              <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">{backups.length}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2"><HardDrive className="w-5 h-5 text-green-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Espacio usado</span></div>
              <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-green-500">{(backups.reduce((a, b) => a + (b.file_size || 0), 0) / 1024 / 1024).toFixed(1)} MB</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2"><Clock className="w-5 h-5 text-amber-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Retención</span></div>
              <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-amber-500">30 días</p>
            </div>
          </div>

          <div className="flex gap-3 items-center">
            <div className="flex-1 grid grid-cols-3 gap-3">
              <input className="input-field" placeholder="Schema name (ej: tenant_abc)" value={backupForm.schema_name} onChange={(e) => setBackupForm({ ...backupForm, schema_name: e.target.value })} />
              <input className="input-field" placeholder="Tenant ID (opcional)" value={backupForm.tenant_id} onChange={(e) => setBackupForm({ ...backupForm, tenant_id: e.target.value })} />
              <input className="input-field" placeholder="Tenant slug (opcional)" value={backupForm.tenant_slug} onChange={(e) => setBackupForm({ ...backupForm, tenant_slug: e.target.value })} />
            </div>
            <button className="btn-primary" onClick={handleCreateBackup} disabled={creatingBackup}>
              {creatingBackup ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear Backup"}
            </button>
            <button className="btn-outline" onClick={handleCleanup}>Limpiar expirados</button>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="table-cell">Schema</th>
                  <th className="table-cell">Tenant</th>
                  <th className="table-cell">Tamaño</th>
                  <th className="table-cell">Tipo</th>
                  <th className="table-cell">Estado</th>
                  <th className="table-cell">Creado</th>
                  <th className="table-cell">Expira</th>
                  <th className="table-cell">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {backupsLoading ? (
                  <tr><td colSpan={8} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
                ) : backups.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">No hay backups</td></tr>
                ) : (
                  backups.map((b) => (
                    <tr key={b.id} className="table-row">
                      <td className="table-td font-mono text-xs">{b.schema_name || "—"}</td>
                      <td className="table-td text-sm">{b.tenant_slug || "—"}</td>
                      <td className="table-td font-mono text-sm">{b.file_size ? (b.file_size / 1024 / 1024).toFixed(1) + " MB" : "—"}</td>
                      <td className="table-td"><StatusBadge status={b.backup_type || "-"} map={{ manual: "badge-info", automatic: "badge-accent" }} /></td>
                      <td className="table-td"><StatusBadge status={b.status || "-"} map={{ completed: "badge-success", pending: "badge-warning", failed: "badge-danger" }} /></td>
                      <td className="table-td text-sm text-gray-500">{b.created_at ? new Date(b.created_at).toLocaleDateString("es-PY") : "—"}</td>
                      <td className="table-td text-sm text-gray-500">{b.expires_at ? new Date(b.expires_at).toLocaleDateString("es-PY") : "—"}</td>
                      <td className="table-td">
                        <div className="flex items-center gap-1">
                          {b.status === "completed" && (
                            <button className="btn-ghost" title="Descargar" onClick={() => {
                              const baseUrl = import.meta.env.VITE_API_URL || ""
                              window.open(`${baseUrl}${api.backups.downloadUrl(b.id)}`, "_blank")
                            }}><Download className="w-4 h-4" /></button>
                          )}
                          <button className="btn-ghost text-red-400 hover:text-red-500" title="Eliminar" onClick={() => handleDeleteBackup(b.id)}><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2"><Calendar className="w-5 h-5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Frecuencia</span></div>
              <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white capitalize">{schedule.frequency}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2"><Clock className="w-5 h-5 text-green-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Horario</span></div>
              <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-green-500">{String(schedule.hour).padStart(2, "0")}:{String(schedule.minute).padStart(2, "0")}</p>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-2"><HardDrive className="w-5 h-5 text-amber-500" /><span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Retención</span></div>
              <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-amber-500">{schedule.retention_days} días</p>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Configuración de Programación</h3>
            {scheduleLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={schedule.enabled}
                      onChange={(e) => setSchedule({ ...schedule, enabled: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Backups automáticos habilitados</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Frecuencia</label>
                    <select
                      className="input-field"
                      value={schedule.frequency}
                      onChange={(e) => setSchedule({ ...schedule, frequency: e.target.value as BackupSchedule["frequency"] })}
                    >
                      <option value="hourly">Cada hora</option>
                      <option value="daily">Diario</option>
                      <option value="weekly">Semanal</option>
                      <option value="monthly">Mensual</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hora</label>
                      <input
                        type="number"
                        min={0}
                        max={23}
                        className="input-field"
                        value={schedule.hour}
                        onChange={(e) => setSchedule({ ...schedule, hour: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Minuto</label>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        className="input-field"
                        value={schedule.minute}
                        onChange={(e) => setSchedule({ ...schedule, minute: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  {schedule.frequency === "weekly" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Día de la semana</label>
                      <select
                        className="input-field"
                        value={schedule.day_of_week ?? 0}
                        onChange={(e) => setSchedule({ ...schedule, day_of_week: parseInt(e.target.value) })}
                      >
                        <option value={0}>Lunes</option>
                        <option value={1}>Martes</option>
                        <option value={2}>Miércoles</option>
                        <option value={3}>Jueves</option>
                        <option value={4}>Viernes</option>
                        <option value={5}>Sábado</option>
                        <option value={6}>Domingo</option>
                      </select>
                    </div>
                  )}

                  {schedule.frequency === "monthly" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Día del mes</label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        className="input-field"
                        value={schedule.day_of_month ?? 1}
                        onChange={(e) => setSchedule({ ...schedule, day_of_month: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Retención (días)</label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      className="input-field"
                      value={schedule.retention_days}
                      onChange={(e) => setSchedule({ ...schedule, retention_days: parseInt(e.target.value) || 30 })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Máx. backups (vacío = ilimitado)</label>
                    <input
                      type="number"
                      min={1}
                      className="input-field"
                      value={schedule.max_backups ?? ""}
                      onChange={(e) => setSchedule({ ...schedule, max_backups: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="Ilimitado"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button className="btn-primary flex items-center gap-2" onClick={handleSaveSchedule} disabled={savingSchedule}>
                    {savingSchedule ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar programación
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
