import { useState, useEffect, useMemo } from "react"
import {
  Search, Plus, Users, Edit, Loader2, Upload, Download, X,
  Building2, UserCheck, CreditCard, ChevronLeft, ChevronRight,
  Phone, Mail, MapPin, RefreshCw, Eye, Trash2, CheckCircle2, ShieldCheck,
  Award, Sparkles, Filter, Briefcase, FileText, Check, AlertCircle, Hash
} from "lucide-react"
import { api, type Customer } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useConfirm } from "../../components/ConfirmDialog"
import { formatPYG, formatDate } from "../../utils/format"

const getCreditoLimite = (c: Customer | null | undefined): number => {
  if (!c) return 0
  const val = c.credito_limite ?? (c as any).limite_credito ?? 0
  const num = typeof val === "number" ? val : Number(val)
  return isNaN(num) ? 0 : num
}

// Lista curada de convenios activos de Extra Supermercado (fallback si el endpoint no tiene datos aún)
const CONVENIOS_PREDEFINIDOS = [
  { empresa_nombre: "CASA GONZALITO S.R.L.", empresa_ruc: "80005427" },
  { empresa_nombre: "PREFORMAX PARAGUAY SOCIEDAD ANONIMA", empresa_ruc: "80079528-8" },
  { empresa_nombre: "PAPA IVAR COMPANY SRL", empresa_ruc: "80020131-0" },
  { empresa_nombre: "GRUPO SANTA TERESA E.A.S.", empresa_ruc: "80150377-9" },
  { empresa_nombre: "SUPER MIX S.A.", empresa_ruc: "80035754-0" },
  { empresa_nombre: "EXTRA S.A", empresa_ruc: "80087538-9" },
  { empresa_nombre: "DISTRIBUIDORA SANTA MARIA E.A.S.", empresa_ruc: "80156059-4" },
  { empresa_nombre: "SERVICIOS DE INTERNET FTTH EAS 595", empresa_ruc: "80146080-8" },
  { empresa_nombre: "COMERCIAL MANDUVI SOCIEDAD ANONIMA", empresa_ruc: "80068688-8" },
  { empresa_nombre: "GOSI SAICI", empresa_ruc: "80007412-2" },
  { empresa_nombre: "CLIENTE INDEPENDIENTE", empresa_ruc: "18888888" },
]

export default function CustomersPage() {
  const toast = useToast()
  const confirm = useConfirm()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState<"todos" | "convenios" | "fisica" | "juridica" | "con_credito" | "inactivos">("todos")

  // Convenios Corporativos cargados del backend
  const [corporateAgreements, setCorporateAgreements] = useState<Array<{ empresa_nombre: string; empresa_ruc: string }>>([])

  // Paginación
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Modales
  const [showForm, setShowForm] = useState(false)
  const [modalTab, setModalTab] = useState<"fiscal" | "convenio" | "credito" | "contacto">("fiscal")
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null)
  const [saving, setSaving] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [selectedConvenioOption, setSelectedConvenioOption] = useState<string>("")

  const [form, setForm] = useState({
    razon_social: "",
    nombre_fantasia: "",
    ruc: "",
    ci: "",
    tipo_persona: "juridica",
    tipo: "cliente",
    condicion_iva: "contribuyente",
    es_convenio: false,
    empresa_vinculada_nombre: "",
    empresa_vinculada_ruc: "",
    extra_club_numero: "",
    credito_limite: 0,
    pago_default: "contado",
    activo: true,
    telefono: "",
    email: "",
    contacto: "",
    direccion: "",
    ciudad: "Pedro Juan Caballero",
    departamento: "Amambay",
  })

  // Importación CSV
  const [showImport, setShowImport] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<{ total_rows: number; success: number; errors: number; details: Array<{ row: number; status: string; message: string }> } | null>(null)
  const [importing, setImporting] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [data, agreements] = await Promise.allSettled([
        api.customers.list(),
        api.accountsReceivable.corporateAgreementsSummary(),
      ])

      if (data.status === "fulfilled") {
        setCustomers(Array.isArray(data.value) ? data.value : [])
      } else {
        toast.error("Error", "No se pudieron cargar los clientes del servidor")
        setCustomers([])
      }

      if (agreements.status === "fulfilled" && Array.isArray(agreements.value) && agreements.value.length > 0) {
        // Unificar con convenios predefinidos sin duplicar
        const map = new Map<string, string>()
        CONVENIOS_PREDEFINIDOS.forEach(c => map.set(c.empresa_nombre.toUpperCase(), c.empresa_ruc))
        agreements.value.forEach((a: any) => {
          if (a.empresa_nombre) {
            map.set(a.empresa_nombre.toUpperCase(), a.empresa_ruc || "")
          }
        })
        const combined = Array.from(map.entries()).map(([nombre, ruc]) => ({ empresa_nombre: nombre, empresa_ruc: ruc }))
        setCorporateAgreements(combined)
      } else {
        setCorporateAgreements(CONVENIOS_PREDEFINIDOS)
      }
    } catch {
      toast.error("Error", "Error al sincronizar con el servidor")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  // Métricas Consolidadas
  const kpis = useMemo(() => {
    const total = customers.length
    const conRuc = customers.filter(c => c.ruc && c.ruc.trim().length > 0).length
    const personasFisicas = customers.filter(c => (c.tipo_persona || "").toLowerCase() === "fisica").length
    const personasJuridicas = customers.filter(c => (c.tipo_persona || "juridica").toLowerCase() === "juridica").length
    const conConvenio = customers.filter(c => c.empresa_vinculada_nombre && c.empresa_vinculada_nombre.trim().length > 0).length
    const sociosExtraClub = customers.filter(c => c.extra_club_numero && c.extra_club_numero.trim().length > 0).length
    const conCredito = customers.filter(c => getCreditoLimite(c) > 0).length
    const totalCreditoOtorgado = customers.reduce((sum, c) => sum + getCreditoLimite(c), 0)
    return { total, conRuc, personasFisicas, personasJuridicas, conConvenio, sociosExtraClub, conCredito, totalCreditoOtorgado }
  }, [customers])

  // Filtrado
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const s = search.toLowerCase().trim()
      const matchSearch = !s ||
        (c.razon_social || "").toLowerCase().includes(s) ||
        (c.nombre_fantasia || "").toLowerCase().includes(s) ||
        (c.ruc || "").toLowerCase().includes(s) ||
        (c.ci || "").toLowerCase().includes(s) ||
        (c.telefono || "").toLowerCase().includes(s) ||
        (c.email || "").toLowerCase().includes(s) ||
        (c.ciudad || "").toLowerCase().includes(s) ||
        (c.empresa_vinculada_nombre || "").toLowerCase().includes(s) ||
        (c.extra_club_numero || "").toLowerCase().includes(s)

      let matchTab = true
      if (tab === "convenios") matchTab = Boolean(c.empresa_vinculada_nombre && c.empresa_vinculada_nombre.trim().length > 0)
      else if (tab === "fisica") matchTab = (c.tipo_persona || "").toLowerCase() === "fisica"
      else if (tab === "juridica") matchTab = (c.tipo_persona || "juridica").toLowerCase() === "juridica"
      else if (tab === "con_credito") matchTab = getCreditoLimite(c) > 0
      else if (tab === "inactivos") matchTab = c.activo === false

      return matchSearch && matchTab
    })
  }, [customers, search, tab])

  useEffect(() => {
    setPage(1)
  }, [search, tab, pageSize])

  const totalPages = Math.ceil(filteredCustomers.length / pageSize) || 1
  const paginatedCustomers = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredCustomers.slice(start, start + pageSize)
  }, [filteredCustomers, page, pageSize])

  const handleOpenCreate = () => {
    setEditingCustomer(null)
    setModalTab("fiscal")
    setSelectedConvenioOption("")
    setForm({
      razon_social: "",
      nombre_fantasia: "",
      ruc: "",
      ci: "",
      tipo_persona: "juridica",
      tipo: "cliente",
      condicion_iva: "contribuyente",
      es_convenio: false,
      empresa_vinculada_nombre: "",
      empresa_vinculada_ruc: "",
      extra_club_numero: "",
      credito_limite: 0,
      pago_default: "contado",
      activo: true,
      telefono: "",
      email: "",
      contacto: "",
      direccion: "",
      ciudad: "Pedro Juan Caballero",
      departamento: "Amambay",
    })
    setShowForm(true)
  }

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c)
    setModalTab("fiscal")
    const tieneConvenio = Boolean(c.empresa_vinculada_nombre && c.empresa_vinculada_nombre.trim().length > 0)
    const empNombre = c.empresa_vinculada_nombre || ""

    // Detectar si está en la lista de convenios conocidos
    const matched = corporateAgreements.find(a => a.empresa_nombre.toUpperCase() === empNombre.toUpperCase())
    if (tieneConvenio) {
      setSelectedConvenioOption(matched ? matched.empresa_nombre : "otra")
    } else {
      setSelectedConvenioOption("")
    }

    setForm({
      razon_social: c.razon_social || "",
      nombre_fantasia: c.nombre_fantasia || "",
      ruc: c.ruc || "",
      ci: c.ci || "",
      tipo_persona: c.tipo_persona || "juridica",
      tipo: c.tipo || (tieneConvenio ? "funcionario" : "cliente"),
      condicion_iva: c.condicion_iva || "contribuyente",
      es_convenio: tieneConvenio,
      empresa_vinculada_nombre: empNombre,
      empresa_vinculada_ruc: c.empresa_vinculada_ruc || (matched ? matched.empresa_ruc : ""),
      extra_club_numero: c.extra_club_numero || "",
      credito_limite: getCreditoLimite(c),
      pago_default: c.pago_default || "contado",
      activo: c.activo !== false,
      telefono: c.telefono || "",
      email: c.email || "",
      contacto: c.contacto || "",
      direccion: c.direccion || "",
      ciudad: c.ciudad || "Pedro Juan Caballero",
      departamento: c.departamento || "Amambay",
    })
    setShowForm(true)
  }

  // Consulta y autocompletado inteligente de RUC/CI
  const handleLookupDoc = async () => {
    const doc = (form.ruc || form.ci || "").trim()
    if (!doc) {
      toast.error("Atención", "Ingrese un número de C.I. o RUC para consultar")
      return
    }
    setLookingUp(true)
    try {
      const res = await api.customers.lookupRuc(doc)
      if (res) {
        setForm(prev => ({
          ...prev,
          ruc: res.ruc || prev.ruc,
          ci: res.ci || prev.ci,
          razon_social: res.razon_social || res.nombre || prev.razon_social,
          telefono: res.telefono || prev.telefono,
          email: res.email || prev.email,
        }))
        if (res.encontrado_en_db) {
          toast.success("Encontrado", `Datos recuperados de ${res.razon_social || res.nombre}`)
        } else {
          toast.info("DV Calculado", `Dígito verificador asignado: ${res.dv}`)
        }
      }
    } catch {
      toast.error("Consulta", "No se pudo autocompletar el documento")
    } finally {
      setLookingUp(false)
    }
  }

  // Generación rápida de número socio ExtraClub
  const handleGenerateExtraClub = () => {
    const rand = Math.floor(100000 + Math.random() * 900000)
    const code = `EC-${rand}`
    setForm(prev => ({ ...prev, extra_club_numero: code }))
    toast.info("Código ExtraClub", `Asignado código provisional: ${code}`)
  }

  // Cambio de selector de convenio
  const handleConvenioSelect = (val: string) => {
    setSelectedConvenioOption(val)
    if (val === "otra") {
      setForm(prev => ({
        ...prev,
        empresa_vinculada_nombre: "",
        empresa_vinculada_ruc: "",
        tipo: "funcionario",
      }))
    } else if (val) {
      const match = corporateAgreements.find(a => a.empresa_nombre === val)
      setForm(prev => ({
        ...prev,
        empresa_vinculada_nombre: val,
        empresa_vinculada_ruc: match ? match.empresa_ruc : prev.empresa_vinculada_ruc,
        tipo: "funcionario",
      }))
    } else {
      setForm(prev => ({
        ...prev,
        empresa_vinculada_nombre: "",
        empresa_vinculada_ruc: "",
      }))
    }
  }

  const handleSave = async () => {
    if (!form.razon_social.trim()) {
      toast.error("Error", "La razón social o nombre completo es obligatorio")
      setModalTab("fiscal")
      return
    }

    if (form.es_convenio && !form.empresa_vinculada_nombre.trim()) {
      toast.error("Convenio Requerido", "Debe especificar el nombre de la empresa vinculada")
      setModalTab("convenio")
      return
    }

    setSaving(true)
    try {
      const limiteNum = Number(form.credito_limite) || 0
      const payload: any = {
        razon_social: form.razon_social.trim(),
        nombre_fantasia: form.nombre_fantasia.trim() || null,
        ruc: form.ruc.trim() || null,
        ci: form.ci.trim() || null,
        tipo_persona: form.tipo_persona,
        tipo: form.es_convenio && form.tipo === "cliente" ? "funcionario" : form.tipo,
        condicion_iva: form.condicion_iva,
        empresa_vinculada_nombre: form.es_convenio ? form.empresa_vinculada_nombre.trim() : null,
        empresa_vinculada_ruc: form.es_convenio ? (form.empresa_vinculada_ruc.trim() || null) : null,
        extra_club_numero: form.extra_club_numero.trim() || null,
        credito_limite: limiteNum,
        limite_credito: limiteNum,
        pago_default: form.pago_default,
        activo: form.activo,
        telefono: form.telefono.trim() || null,
        email: form.email.trim() || null,
        contacto: form.contacto.trim() || null,
        direccion: form.direccion.trim() || null,
        ciudad: form.ciudad.trim() || "Pedro Juan Caballero",
        departamento: form.departamento.trim() || "Amambay",
      }

      if (editingCustomer) {
        await api.customers.update(editingCustomer.id, payload)
        toast.success("Ficha Actualizada", `Se guardaron los cambios de ${form.razon_social}`)
      } else {
        await api.customers.create(payload)
        toast.success("Cliente Creado", `Se registró con éxito a ${form.razon_social}`)
      }
      setShowForm(false)
      fetchData()
    } catch (err: any) {
      toast.error("Error al guardar", err?.message || err?.detail || "Ocurrió un error inesperado al conectar con el servidor")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (c: Customer) => {
    const ok = await confirm({
      title: "Desactivar Cliente",
      message: `¿Estás seguro de que deseas desactivar a ${c.razon_social}?`,
      confirmText: "Desactivar",
      variant: "danger",
    })
    if (!ok) return
    try {
      await api.customers.delete(c.id)
      toast.success("Cliente Desactivado", `${c.razon_social} fue dado de baja`)
      fetchData()
    } catch (err: any) {
      toast.error("Error", err?.message || "No se pudo eliminar el cliente")
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/90 text-white p-7 border border-indigo-500/20 shadow-2xl shadow-indigo-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-500 border border-indigo-400/30 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <Users className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-indigo-400 uppercase bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-500/20">
                    GESTIÓN DE CLIENTES & CONVENIOS CORPORATIVOS
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    Padrón Total: {kpis.total.toLocaleString()} Clientes
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Padrón de Clientes & Cuentas Corrientes
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Registro fiscal DNIT/SET, convenios con empresas, socios ExtraClub y líneas de crédito auditadas
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-purple-300">
                🏢 {kpis.conConvenio} en Convenios Empresas
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-indigo-300">
                ⭐ {kpis.sociosExtraClub} Socios ExtraClub
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-400">
                💳 Línea Otorgada: {formatPYG(kpis.totalCreditoOtorgado)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 backdrop-blur-md transition flex items-center gap-2 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Recargar
            </button>
            <button
              onClick={handleOpenCreate}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-500 hover:from-indigo-500 hover:to-purple-400 transition shadow-lg shadow-indigo-500/25 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nuevo Cliente
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Padrón</span>
              <span className="text-[10px] font-bold text-indigo-400">Total</span>
            </div>
            <p className="text-xl font-black font-mono tracking-tight text-indigo-300">
              {kpis.total.toLocaleString()}
            </p>
            <p className="text-[10px] text-slate-400">{kpis.conRuc} con RUC tributario</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Convenios Empresas</span>
              <span className="text-[10px] font-bold text-purple-400">Planilla</span>
            </div>
            <p className="text-xl font-black font-mono tracking-tight text-purple-300">
              {kpis.conConvenio.toLocaleString()}
            </p>
            <p className="text-[10px] text-slate-400">Funcionarios vinculados</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Socios ExtraClub</span>
              <span className="text-[10px] font-bold text-amber-400">Club</span>
            </div>
            <p className="text-xl font-black font-mono tracking-tight text-amber-300">
              {kpis.sociosExtraClub.toLocaleString()}
            </p>
            <p className="text-[10px] text-slate-400">Con tarjeta / ID activa</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Línea de Crédito</span>
              <span className="text-[10px] font-bold text-emerald-400">Activo</span>
            </div>
            <p className="text-xl font-black font-mono tracking-tight text-emerald-400">
              {kpis.conCredito.toLocaleString()}
            </p>
            <p className="text-[10px] text-slate-400">Clientes autorizados</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80 col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Monto Crédito Total</span>
              <span className="text-[10px] font-mono text-emerald-400">PYG</span>
            </div>
            <p className="text-xl font-black font-mono tracking-tight text-emerald-400 truncate">
              {formatPYG(kpis.totalCreditoOtorgado)}
            </p>
            <p className="text-[10px] text-slate-400">Cupo total asignado</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { id: "todos", label: "Todos los Clientes", count: kpis.total },
          { id: "convenios", label: "🏢 Convenios Corporativos", count: kpis.conConvenio },
          { id: "fisica", label: "Personas Físicas (C.I.)", count: kpis.personasFisicas },
          { id: "juridica", label: "Empresas & RUC", count: kpis.personasJuridicas },
          { id: "con_credito", label: "Con Crédito ExtraClub", count: kpis.conCredito },
          { id: "inactivos", label: "Inactivos", count: customers.filter(c => c.activo === false).length },
        ].map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <span>{t.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                active ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
              }`}>
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* 🔍 BARRA DE HERRAMIENTAS & FILTROS */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 w-4 h-4 text-slate-400 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por Razón Social, RUC, C.I., Empresa Convenio, ExtraClub, Teléfono..."
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
          >
            <option value={25}>25 por página</option>
            <option value={50}>50 por página</option>
            <option value={100}>100 por página</option>
          </select>
        </div>
      </div>

      {/* 📊 TABLA DE CLIENTES */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 uppercase text-[10px] font-black tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4">Cliente / Razón Social</th>
                <th className="p-4">RUC / C.I.</th>
                <th className="p-4">Convenio / ExtraClub</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Contacto</th>
                <th className="p-4">Ubicación</th>
                <th className="p-4 text-right">Límite Crédito</th>
                <th className="p-4 text-center">Estado</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    <span>Cargando padrón de clientes y convenios...</span>
                  </td>
                </tr>
              ) : paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400">
                    No se encontraron clientes coincidentes con la búsqueda.
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-4 font-bold text-slate-900 dark:text-white max-w-[220px]">
                      <div className="truncate font-extrabold">{c.razon_social}</div>
                      {c.nombre_fantasia && (
                        <div className="text-[10px] text-slate-400 font-normal truncate">
                          Fantasía: {c.nombre_fantasia}
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-mono text-slate-600 dark:text-slate-300 text-[11px]">
                      {c.ruc ? (
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{c.ruc}</span>
                      ) : c.ci ? (
                        <span>C.I. {c.ci}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        {c.empresa_vinculada_nombre ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 max-w-[170px] truncate" title={`Convenio: ${c.empresa_vinculada_nombre}`}>
                            <Building2 className="w-3 h-3 flex-shrink-0 text-purple-500" />
                            <span className="truncate">{c.empresa_vinculada_nombre}</span>
                          </span>
                        ) : null}
                        {c.extra_club_numero ? (
                          <div className="flex items-center gap-1 text-[10px] font-mono text-amber-600 dark:text-amber-400">
                            <Award className="w-3 h-3 text-amber-500" />
                            <span>{c.extra_club_numero}</span>
                          </div>
                        ) : null}
                        {!c.empresa_vinculada_nombre && !c.extra_club_numero && (
                          <span className="text-slate-400 text-[10px]">Sin convenio</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        (c.tipo_persona || "").toLowerCase() === "fisica"
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                          : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                      }`}>
                        {c.tipo || c.tipo_persona || "juridica"}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500 text-[11px]">
                      <div className="space-y-0.5">
                        {c.telefono && <p className="font-mono flex items-center gap-1 text-slate-700 dark:text-slate-300"><Phone className="w-3 h-3 text-slate-400" />{c.telefono}</p>}
                        {c.email && <p className="truncate max-w-[140px] text-slate-400">{c.email}</p>}
                      </div>
                    </td>
                    <td className="p-4 text-slate-500 text-[11px]">
                      {c.ciudad || "—"}
                    </td>
                    <td className="p-4 text-right font-mono font-black text-slate-900 dark:text-white">
                      {getCreditoLimite(c) > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400">{formatPYG(getCreditoLimite(c))}</span>
                      ) : (
                        <span className="text-slate-400 font-normal">₲ 0</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        c.activo !== false
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      }`}>
                        {c.activo !== false ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setViewingCustomer(c)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition"
                          title="Ver Ficha Completa"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition"
                          title="Editar Ficha"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {c.activo !== false && (
                          <button
                            onClick={() => handleDelete(c)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition"
                            title="Desactivar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginador */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>Mostrando {paginatedCustomers.length} de {filteredCustomers.length} clientes</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono font-bold">Página {page} de {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL PROFESIONAL: CREAR / EDITAR CLIENTE CON CONVENIOS ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    {editingCustomer ? "Editar Ficha de Cliente" : "Registrar Nuevo Cliente"}
                    {form.es_convenio && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 uppercase">
                        Convenio Empresarial
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400">Padrón fiscal DNIT, convenios corporativos, ExtraClub y crédito</p>
                </div>
              </div>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pestañas internas del Modal */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setModalTab("fiscal")}
                className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                  modalTab === "fiscal"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>1. Fiscal & Identidad</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTab("convenio")}
                className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                  modalTab === "convenio"
                    ? "bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>2. Convenio & ExtraClub</span>
                {form.es_convenio && <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />}
              </button>
              <button
                type="button"
                onClick={() => setModalTab("credito")}
                className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                  modalTab === "credito"
                    ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>3. Crédito</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTab("contacto")}
                className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                  modalTab === "contacto"
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>4. Contacto & Domicilio</span>
              </button>
            </div>

            {/* CONTENIDO PESTAÑA 1: FISCAL & IDENTIDAD */}
            {modalTab === "fiscal" && (
              <div className="space-y-3.5 text-xs">
                {/* Tipo de Persona & Clasificación */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Tipo de Persona *</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, tipo_persona: "fisica", tipo: f.es_convenio ? "funcionario" : "cliente" }))}
                        className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                          form.tipo_persona === "fisica"
                            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                            : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Física (Particular)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, tipo_persona: "juridica", tipo: "contribuyente" }))}
                        className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                          form.tipo_persona === "juridica"
                            ? "border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300"
                            : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Jurídica (Empresa)</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Clasificación de Cuenta</label>
                    <select
                      value={form.tipo}
                      onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
                    >
                      <option value="cliente">Cliente Estándar (Consumidor)</option>
                      <option value="funcionario">Funcionario / Convenio Empresa</option>
                      <option value="mayorista">Cliente Mayorista</option>
                      <option value="distribuidor">Distribuidor Comercial</option>
                      <option value="contribuyente">Empresa Contribuyente SET</option>
                      <option value="diplomatico">Diplomático / Ley Especial</option>
                    </select>
                  </div>
                </div>

                {/* C.I. y RUC con Autocompletado */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">C.I. / Documento de Identidad</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={form.ci}
                        onChange={e => setForm(f => ({ ...f, ci: e.target.value }))}
                        placeholder="Ej: 3889293"
                        className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={handleLookupDoc}
                        disabled={lookingUp}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl font-bold text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1 transition"
                        title="Buscar en Padrón"
                      >
                        {lookingUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                        <span>Buscar</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">RUC con Dígito Verificador (DV)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={form.ruc}
                        onChange={e => setForm(f => ({ ...f, ruc: e.target.value }))}
                        placeholder="Ej: 80150377-9"
                        className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2 text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400"
                      />
                      <button
                        type="button"
                        onClick={handleLookupDoc}
                        disabled={lookingUp}
                        className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 rounded-xl font-bold text-[11px] flex items-center gap-1 transition"
                        title="Calcular Módulo 11 / Consultar"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Calc DV</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Razón Social y Nombre Fantasía */}
                <div>
                  <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">
                    Razón Social / Nombre Completo *
                  </label>
                  <input
                    type="text"
                    value={form.razon_social}
                    onChange={e => setForm(f => ({ ...f, razon_social: e.target.value }))}
                    placeholder="Ej: GRUPO SANTA TERESA E.A.S. o JUAN CARLOS PÉREZ"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Nombre de Fantasía (Comercial)</label>
                    <input
                      type="text"
                      value={form.nombre_fantasia}
                      onChange={e => setForm(f => ({ ...f, nombre_fantasia: e.target.value }))}
                      placeholder="Ej: Extra Supermercado"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Condición Fiscal Tributaria (IVA)</label>
                    <select
                      value={form.condicion_iva}
                      onChange={e => setForm(f => ({ ...f, condicion_iva: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
                    >
                      <option value="contribuyente">Contribuyente Régimen General (IVA 10% / 5%)</option>
                      <option value="resimple">Resimple / Simple</option>
                      <option value="exento">Exento de Impuestos</option>
                      <option value="no_contribuyente">No Contribuyente / Consumidor Final</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* CONTENIDO PESTAÑA 2: CONVENIO CORPORATIVO & EXTRA CLUB */}
            {modalTab === "convenio" && (
              <div className="space-y-4 text-xs">
                {/* Panel Destacado de Convenio */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-slate-900/10 border border-purple-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-300 flex items-center justify-center font-bold">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-900 dark:text-white text-xs">Convenio Empresarial / Descuento Planilla</h4>
                        <p className="text-[11px] text-slate-500">Vincula a este cliente como funcionario de una empresa adherida</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.es_convenio}
                        onChange={e => {
                          const checked = e.target.checked
                          setForm(f => ({
                            ...f,
                            es_convenio: checked,
                            tipo: checked ? "funcionario" : "cliente"
                          }))
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  {form.es_convenio && (
                    <div className="space-y-3 pt-2 border-t border-purple-500/20">
                      <div>
                        <label className="block font-black uppercase text-[10px] text-purple-700 dark:text-purple-300 mb-1">
                          Seleccionar Empresa Adherida al Convenio
                        </label>
                        <select
                          value={selectedConvenioOption}
                          onChange={e => handleConvenioSelect(e.target.value)}
                          className="w-full bg-white dark:bg-slate-950 border border-purple-300 dark:border-purple-800/60 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none"
                        >
                          <option value="">-- Seleccionar Convenio Corporativo --</option>
                          {corporateAgreements.map((ag) => (
                            <option key={ag.empresa_nombre} value={ag.empresa_nombre}>
                              {ag.empresa_nombre} (RUC: {ag.empresa_ruc || "Sin RUC"})
                            </option>
                          ))}
                          <option value="otra">+ Otra Empresa (Ingreso Manual)</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Nombre de la Empresa Vinculada *</label>
                          <input
                            type="text"
                            value={form.empresa_vinculada_nombre}
                            onChange={e => setForm(f => ({ ...f, empresa_vinculada_nombre: e.target.value }))}
                            placeholder="Ej: CASA GONZALITO S.R.L."
                            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">RUC Empresa Vinculada</label>
                          <input
                            type="text"
                            value={form.empresa_vinculada_ruc}
                            onChange={e => setForm(f => ({ ...f, empresa_vinculada_ruc: e.target.value }))}
                            placeholder="80005427-0"
                            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2 text-xs font-mono font-bold text-purple-600 dark:text-purple-300"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-700 dark:text-purple-300">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-purple-500" />
                        <span>
                          Las compras a crédito de este funcionario se consolidarán en la carpeta y remisión mensual de <b>{form.empresa_vinculada_nombre || "la empresa seleccionada"}</b>.
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Panel Destacado de Extra Club */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-slate-900/10 border border-amber-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                        <Award className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-900 dark:text-white text-xs">Fidelización Extra Club</h4>
                        <p className="text-[11px] text-slate-500">Asignación de tarjeta o código de socio para beneficios y crédito POS</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Nº Socio / Código Tarjeta Extra Club</label>
                      <input
                        type="text"
                        value={form.extra_club_numero}
                        onChange={e => setForm(f => ({ ...f, extra_club_numero: e.target.value }))}
                        placeholder="Ej: EC-784001 o Código de Barras de Tarjeta"
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-mono font-bold text-amber-600 dark:text-amber-400"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleGenerateExtraClub}
                        className="w-full py-2.5 px-3 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Generar Código</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CONTENIDO PESTAÑA 3: CRÉDITO & FINANZAS */}
            {modalTab === "credito" && (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-500/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 dark:text-white text-xs">Línea de Crédito Extra Supermercado</h4>
                      <p className="text-[11px] text-slate-500">Cupo máximo autorizado para compras a plazo y Extra Club</p>
                    </div>
                  </div>

                  <div>
                    <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Límite de Crédito Autorizado (₲) *</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 font-bold font-mono text-emerald-600 dark:text-emerald-400">₲</span>
                      <input
                        type="number"
                        value={form.credito_limite}
                        onChange={e => setForm(f => ({ ...f, credito_limite: Number(e.target.value) || 0 }))}
                        placeholder="0"
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-8 pr-4 py-2.5 text-sm font-mono font-black text-emerald-600 dark:text-emerald-400"
                      />
                    </div>
                  </div>

                  {/* Atajos de asignación rápida de cupo */}
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span className="text-[10px] font-bold text-slate-400">Atajos rápidos:</span>
                    {[
                      { label: "₲ 0 (Sin Crédito)", val: 0 },
                      { label: "₲ 500.000", val: 500000 },
                      { label: "₲ 800.000", val: 800000 },
                      { label: "₲ 1.500.000", val: 1500000 },
                      { label: "₲ 2.000.000", val: 2000000 },
                    ].map(p => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, credito_limite: p.val }))}
                        className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 hover:border-emerald-500 transition"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Forma de Pago Predeterminada</label>
                    <select
                      value={form.pago_default}
                      onChange={e => setForm(f => ({ ...f, pago_default: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
                    >
                      <option value="contado">Contado (Efectivo / POS)</option>
                      <option value="credito">Crédito en Cuenta Corriente</option>
                      <option value="extra_club">Extra Club (Descuento Planilla / Pagaré)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Estado de Habilitación</label>
                    <div className="flex items-center gap-3 pt-2">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.activo}
                          onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                      <span className={`text-xs font-bold ${form.activo ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}`}>
                        {form.activo ? "Cliente Activo (Facturación habilitada)" : "Cliente Bloqueado / Inactivo"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CONTENIDO PESTAÑA 4: CONTACTO & DOMICILIO */}
            {modalTab === "contacto" && (
              <div className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Teléfono / WhatsApp Principal</label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type="text"
                        value={form.telefono}
                        onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                        placeholder="0981 123456"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-mono text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Correo Electrónico (Facturación SIFEN)</label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type="email"
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="cliente@dominio.com.py"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Persona de Contacto / Referencia / Cargo</label>
                  <input
                    type="text"
                    value={form.contacto}
                    onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))}
                    placeholder="Ej: Lic. María González (Jefa de RRHH) o Cónyuge"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Dirección Fiscal / Domicilio</label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={form.direccion}
                      onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
                      placeholder="Calle, Número de Casa, Barrio, Esquina"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Ciudad</label>
                    <input
                      type="text"
                      value={form.ciudad}
                      onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))}
                      placeholder="Pedro Juan Caballero"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-black uppercase text-[10px] text-slate-400 mb-1">Departamento</label>
                    <input
                      type="text"
                      value={form.departamento}
                      onChange={e => setForm(f => ({ ...f, departamento: e.target.value }))}
                      placeholder="Amambay"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Pie del Modal con Acciones */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span>Pestaña {modalTab === "fiscal" ? "1 de 4" : modalTab === "convenio" ? "2 de 4" : modalTab === "credito" ? "3 de 4" : "4 de 4"}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-indigo-500/25 transition"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{editingCustomer ? "Guardar Ficha" : "Registrar Cliente"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: VER FICHA 360 COMPLETA ── */}
      {viewingCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-500/20">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">{viewingCustomer.razon_social}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-slate-400 font-mono">
                      RUC/CI: {viewingCustomer.ruc || viewingCustomer.ci || "Sin documento"}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                      (viewingCustomer.tipo_persona || "").toLowerCase() === "fisica"
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                    }`}>
                      {viewingCustomer.tipo_persona || "juridica"}
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={() => setViewingCustomer(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Convenio Corporativo */}
              {viewingCustomer.empresa_vinculada_nombre ? (
                <div className="p-3.5 bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-purple-700 dark:text-purple-300 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-purple-500" />
                      Convenio Empresarial Adherido
                    </span>
                    <span className="text-[10px] font-mono text-purple-500">
                      RUC: {viewingCustomer.empresa_vinculada_ruc || "—"}
                    </span>
                  </div>
                  <p className="text-sm font-extrabold text-purple-900 dark:text-purple-200">
                    {viewingCustomer.empresa_vinculada_nombre}
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Sin Convenio Empresarial vinculado</span>
                  <span className="font-bold text-slate-500">Particular</span>
                </div>
              )}

              {/* Socio ExtraClub */}
              {viewingCustomer.extra_club_numero && (
                <div className="p-3 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-500" />
                    <div>
                      <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase">Socio ExtraClub</span>
                      <p className="font-mono font-black text-amber-900 dark:text-amber-200">{viewingCustomer.extra_club_numero}</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                    Club Fidelidad Activo
                  </span>
                </div>
              )}

              {/* Resumen Comercial y Crédito */}
              <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">Línea de Crédito Otorgada</span>
                  <p className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">{formatPYG(getCreditoLimite(viewingCustomer))}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Saldo Usado: {formatPYG(viewingCustomer.credito_usado || 0)}</p>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                    Pago: {(viewingCustomer.pago_default || "contado").toUpperCase()}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1">Estado: {viewingCustomer.activo !== false ? "Habilitado" : "Bloqueado"}</p>
                </div>
              </div>

              {/* Datos de Contacto y Ubicación */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/70 rounded-2xl space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Teléfono:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{viewingCustomer.telefono || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Email:</span>
                  <span className="text-slate-700 dark:text-slate-300">{viewingCustomer.email || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Contacto / Cargo:</span>
                  <span className="text-slate-700 dark:text-slate-300">{viewingCustomer.contacto || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Dirección:</span>
                  <span className="text-slate-700 dark:text-slate-300">{viewingCustomer.direccion || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Ciudad / Dpto:</span>
                  <span className="text-slate-700 dark:text-slate-300">{viewingCustomer.ciudad || "Pedro Juan Caballero"} ({viewingCustomer.departamento || "Amambay"})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Condición Fiscal:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px]">{viewingCustomer.condicion_iva || "Contribuyente General"}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => {
                  const target = viewingCustomer
                  setViewingCustomer(null)
                  handleOpenEdit(target)
                }}
                className="px-4 py-2 rounded-2xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold text-xs transition flex items-center gap-1.5"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Editar Ficha</span>
              </button>
              <button
                onClick={() => setViewingCustomer(null)}
                className="px-5 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
