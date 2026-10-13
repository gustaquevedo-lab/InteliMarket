import { useState, useEffect, useMemo } from "react"
import { api, type BankAccount } from "../../api"
import { formatPYG, getTodayAsuncion } from "../../utils/format"
import CurrencyInput from "../../components/CurrencyInput"
import SupplierSearchInput from "../../components/SupplierSearchInput"
import { useToast } from "../../context/ToastContext"

import {
  Plus, Loader2, Landmark, CheckCircle, XCircle, Upload, Wand2, AlertTriangle,
  Settings2, ShieldCheck, ShieldAlert, FileDown, Search, ArrowUpRight,
  ArrowDownRight, FileSpreadsheet, Receipt, RefreshCw, Calendar, Clock,
  DollarSign, Check, X, FileText, Filter, Eye, ChevronRight, Pencil, Trash2,
  ArrowLeftRight, ArrowRight, Building2
} from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import { useAuth } from "../../context/AuthContext"

type AutoCandidate = { txId: string; descripcion: string; monto: number; fecha?: string; suggestion: any; selected: boolean }

type TabType = "posicion" | "movimientos" | "conciliacion" | "cheques" | "auditoria"

const BANK_CATEGORIA_LABELS: Record<string, { label: string; className: string }> = {
  comision_bancaria: { label: "Comisión bancaria", className: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800" },
  gasto_bancario: { label: "Gasto / Impuesto bancario", className: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800" },
  transferencia_enviada: { label: "Transferencia enviada", className: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border border-violet-200 dark:border-violet-800" },
  pago_proveedor: { label: "Pago a proveedor", className: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-200 dark:border-orange-800" },
  pago_servicio: { label: "Pago de servicios", className: "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800" },
  pago_prestamo: { label: "Pago de préstamo", className: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300 border border-fuchsia-200 dark:border-fuchsia-800" },
  pago_cheque: { label: "Pago con cheque", className: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800" },
  retiro: { label: "Retiro", className: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800" },
  transferencia_recibida: { label: "Transferencia recibida", className: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800" },
  deposito_caja: { label: "Depósito de caja", className: "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 border border-teal-200 dark:border-teal-800" },
  deposito_efectivo: { label: "Depósito efectivo", className: "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 border border-teal-200 dark:border-teal-800" },
  liquidacion_tarjeta: { label: "Liquidación tarjeta", className: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800" },
  interes_ganado: { label: "Interés ganado", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" },
  transferencia_interna: { label: "Transferencia interna", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700" },
  ingreso_caja: { label: "Ingreso de caja", className: "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 border border-teal-200 dark:border-teal-800" },
  otros: { label: "Otros", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700" },
}

const CHEQUE_ESTADO_BADGES: Record<string, { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200" },
  entregado: { label: "Entregado", className: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200" },
  cobrado: { label: "Cobrado / Compensado", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200" },
  rechazado: { label: "Rechazado", className: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200" },
  anulado: { label: "Anulado", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200" },
}

export default function BancosPage() {
  const [activeTab, setActiveTab] = useState<TabType>("posicion")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [banks, setBanks] = useState<BankAccount[]>([])
  const [bankDashboard, setBankDashboard] = useState<any>(null)
  const [cashPosition, setCashPosition] = useState<any>(null)
  const [outstandingItems, setOutstandingItems] = useState<any>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [selectedBank, setSelectedBank] = useState<string>("")
  const [bankTxns, setBankTxns] = useState<any[]>([])
  const [txnsLoading, setTxnsLoading] = useState(false)

  // Filtros de Movimientos
  const [txSearch, setTxSearch] = useState("")
  const [txFilterTipo, setTxFilterTipo] = useState<string>("todos")
  const [txFilterCategoria, setTxFilterCategoria] = useState<string>("todas")
  const [txFilterConciliado, setTxFilterConciliado] = useState<string>("todos")

  // Cartera de Cheques
  const [cheques, setCheques] = useState<any[]>([])
  const [chequesDashboard, setChequesDashboard] = useState<any>(null)
  const [chequesLoading, setChequesLoading] = useState(false)
  const [chequeFilterEstado, setChequeFilterEstado] = useState("")
  const [chequeFilterBank, setChequeFilterBank] = useState("")
  const [chequeFilterFechaDesde, setChequeFilterFechaDesde] = useState("")
  const [chequeFilterFechaHasta, setChequeFilterFechaHasta] = useState("")
  const [chequeSearch, setChequeSearch] = useState("")
  const [showChequeModal, setShowChequeModal] = useState(false)
  const [chequeHistorial, setChequeHistorial] = useState<{ cheque: any; items: any[] } | null>(null)
  const [chequeForm, setChequeForm] = useState({
    numero: "",
    bank_account_id: "",
    banco_emisor: "",
    beneficiario: "",
    supplier_id: "",
    monto: "",
    moneda: "PYG",
    fecha_emision: getTodayAsuncion(),
    fecha_entrega: "",
    fecha_pago: getTodayAsuncion(),
    diferido: false,
    cruzado: true,
    no_a_la_orden: false,
    concepto: "",
  })
  const [submittingCheque, setSubmittingCheque] = useState(false)

  // Modales y formularios
  const [showBankForm, setShowBankForm] = useState(false)
  const [bankForm, setBankForm] = useState({ banco: "", alias: "", tipo: "corriente", numero_cuenta: "", moneda: "PYG", saldo_inicial: "", titular: "" })
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null)
  const [editBankForm, setEditBankForm] = useState({ banco: "", alias: "", tipo: "corriente", numero_cuenta: "", moneda: "PYG", titular: "", saldo_minimo_alerta: "", activo: true })
  const [showImportBank, setShowImportBank] = useState(false)
  const now = new Date()
  const [importForm, setImportForm] = useState<{ mes: number; anio: number; file: File | null }>({ mes: now.getMonth() + 1, anio: now.getFullYear(), file: null })
  const [importPreview, setImportPreview] = useState<any>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [reconcileModal, setReconcileModal] = useState<{ txId: string; suggestions: any[]; loading: boolean } | null>(null)
  const [autoModal, setAutoModal] = useState<{ loading: boolean; candidates: AutoCandidate[] } | null>(null)
  const [umbralModal, setUmbralModal] = useState<{ id: string; valor: string } | null>(null)
  const [corrections, setCorrections] = useState<any[]>([])
  const [correctionModal, setCorrectionModal] = useState<{ id: string; saldo_propuesto: string; motivo: string } | null>(null)

  // Modal de Movimientos Bancarios (Directo y Transferencia)
  const [showTxModal, setShowTxModal] = useState(false)
  const [txMode, setTxMode] = useState<"directo" | "transferencia">("directo")
  const [submittingTx, setSubmittingTx] = useState(false)
  const [txForm, setTxForm] = useState({
    bank_account_id: "",
    tipo: "debito" as "debito" | "credito",
    categoria: "comision_bancaria",
    monto: "",
    fecha: getTodayAsuncion(),
    referencia: "",
    contraparte: "",
    descripcion: "",
    tiene_comision: false,
    comision_adicional: "5500",
  })
  const [transferForm, setTransferForm] = useState({
    origen_account_id: "",
    destino_account_id: "",
    monto: "",
    fecha: getTodayAsuncion(),
    referencia: "",
    descripcion: "",
    comision: "",
  })

  // Modal de Depósito Bancario
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [depositMode, setDepositMode] = useState<"boveda" | "externo">("boveda")
  const [depositVaultBalance, setDepositVaultBalance] = useState<number | null>(null)
  const [submittingDeposit, setSubmittingDeposit] = useState(false)
  const [depositForm, setDepositForm] = useState({
    bank_account_id: "",
    monto: "",
    numero_boleta: "",
    transportadora: "Prosegur",
    fecha_deposito: getTodayAsuncion(),
    observaciones: "",
    // externo
    categoria_ext: "deposito_efectivo",
    referencia_ext: "",
    contraparte_ext: "",
    descripcion_ext: "",
  })

  const toast = useToast()
  const { user } = useAuth()

  const formatGs = (n?: number | string | null) => n != null ? formatPYG(Number(n)) : "-"
  const formatBankLabel = (b: BankAccount) => b.alias ? `[${b.alias}] ${b.banco} — ${b.numero_cuenta} (${b.moneda})` : `${b.banco} — ${b.numero_cuenta} (${b.moneda})`

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [b, d, cp, oi, recs, corr] = await Promise.allSettled([
        api.financial.banks.list(),
        api.financial.banksDashboard(),
        api.financial.cashPosition(),
        api.financial.outstandingItems(),
        api.financeAgent.recommendations("pending").catch(() => []),
        api.financial.balanceCorrections.list("pendiente").catch(() => []),
      ])

      const rawBanks = b.status === "fulfilled" && Array.isArray(b.value) ? b.value : []
      // Directiva inmutable Extra Supermercado: Purgar y eliminar cualquier cuenta en BRL
      const brlAccounts = rawBanks.filter((acc: BankAccount) => acc.moneda === "BRL")
      if (brlAccounts.length > 0) {
        for (const brlAcc of brlAccounts) {
          try {
            await api.financial.banks.delete(brlAcc.id)
          } catch (purgeErr) {
            console.error("Error al purgar cuenta BRL:", purgeErr)
          }
        }
      }
      const validBanks = rawBanks.filter((acc: BankAccount) => acc.moneda !== "BRL")
      setBanks(validBanks)

      if (d.status === "fulfilled") setBankDashboard(d.value)
      if (cp.status === "fulfilled") setCashPosition(cp.value)
      if (oi.status === "fulfilled") setOutstandingItems(oi.value)
      if (recs.status === "fulfilled" && Array.isArray(recs.value)) {
        setAlerts(recs.value.filter((r: any) => r.tipo === "saldo_bajo" || r.tipo === "divergencia_saldo"))
      }
      if (corr.status === "fulfilled") setCorrections(corr.value || [])

      if (validBanks.length > 0 && !selectedBank) {
        setSelectedBank(validBanks[0].id)
        loadBankTxns(validBanks[0].id)
      }
    } catch (e: any) {
      if (e.status !== 401 && e.response?.status !== 401) toast.error("Error", e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const loadBankTxns = async (bankId: string) => {
    setTxnsLoading(true)
    try {
      const t = await api.financial.banks.transactions(bankId)
      setBankTxns(t)
      setSelectedBank(bankId)
    } catch (e: any) {
      toast.error("Error", e.message)
    } finally {
      setTxnsLoading(false)
    }
  }

  const fetchCheques = async () => {
    setChequesLoading(true)
    try {
      const [dash, list] = await Promise.all([
        api.cheques.dashboard(),
        api.cheques.list({
          estado: chequeFilterEstado || undefined,
          bank_account_id: chequeFilterBank || undefined,
          fecha_desde: chequeFilterFechaDesde || undefined,
          fecha_hasta: chequeFilterFechaHasta || undefined,
          search: chequeSearch || undefined,
        } as any),
      ])
      setChequesDashboard(dash)
      setCheques(Array.isArray(list) ? [...list].sort((a: any, b: any) => new Date(b.fecha_emision || b.fecha_pago || b.created_at || 0).getTime() - new Date(a.fecha_emision || a.fecha_pago || a.created_at || 0).getTime()) : [])
    } catch (e: any) {
      toast.error("Error", "No se pudo cargar la cartera de cheques")
    } finally {
      setChequesLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === "cheques") {
      fetchCheques()
    }
  }, [activeTab, chequeFilterEstado, chequeFilterBank, chequeFilterFechaDesde, chequeFilterFechaHasta, chequeSearch])

  const handleCreateBank = async () => {
    try {
      await api.financial.banks.create({ ...bankForm, saldo_inicial: Number(bankForm.saldo_inicial) })
      toast.success("Cuenta creada", "Cuenta bancaria registrada exitosamente")
      setShowBankForm(false)
      setBankForm({ banco: "", alias: "", tipo: "corriente", numero_cuenta: "", moneda: "PYG", saldo_inicial: "", titular: "" })
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleOpenEditBank = (b: BankAccount) => {
    setEditingBank(b)
    setEditBankForm({
      banco: b.banco || "",
      alias: b.alias || "",
      tipo: b.tipo || "corriente",
      numero_cuenta: b.numero_cuenta || "",
      moneda: b.moneda || "PYG",
      titular: b.titular || "",
      saldo_minimo_alerta: b.saldo_minimo_alerta != null ? String(b.saldo_minimo_alerta) : "",
      activo: b.activo !== false,
    })
  }

  const handleUpdateBank = async () => {
    if (!editingBank) return
    try {
      await api.financial.banks.update(editingBank.id, {
        banco: editBankForm.banco.trim(),
        alias: editBankForm.alias.trim() || null,
        tipo: editBankForm.tipo,
        numero_cuenta: editBankForm.numero_cuenta.trim(),
        titular: editBankForm.titular.trim() || null,
        saldo_minimo_alerta: editBankForm.saldo_minimo_alerta ? Number(editBankForm.saldo_minimo_alerta) : null,
        activo: editBankForm.activo,
      })
      toast.success("Cuenta actualizada", `Cuenta ${editBankForm.alias ? `[${editBankForm.alias}] ` : ""}${editBankForm.banco} modificada exitosamente.`)
      setEditingBank(null)
      fetchAll()
    } catch (e: any) {
      toast.error("Error al actualizar cuenta", e.message)
    }
  }

  const handleDeleteBank = async (b: BankAccount) => {
    const label = b.alias ? `[${b.alias}] ${b.banco}` : `${b.banco} (${b.numero_cuenta})`
    if (!window.confirm(`¿Está seguro de que desea eliminar la cuenta bancaria ${label}? Esta acción no se puede deshacer.`)) {
      return
    }
    try {
      await api.financial.banks.delete(b.id)
      toast.success("Cuenta eliminada", `La cuenta ${label} ha sido eliminada.`)
      if (selectedBank === b.id) {
        setSelectedBank("")
      }
      fetchAll()
    } catch (e: any) {
      toast.error("Error al eliminar cuenta", e.message || "No se pudo eliminar la cuenta.")
    }
  }

  const handleSaveUmbral = async () => {
    if (!umbralModal) return
    try {
      await api.financial.banks.update(umbralModal.id, { saldo_minimo_alerta: umbralModal.valor ? Number(umbralModal.valor) : null })
      toast.success("Umbral de alerta guardado")
      setUmbralModal(null)
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleDecideAlert = async (id: string, approve: boolean) => {
    try {
      const fn = approve ? api.financeAgent.approve : api.financeAgent.reject
      await fn(id, user?.id || user?.nombre || "sistema")
      toast.success(approve ? "Alerta reconocida" : "Alerta descartada")
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleVerifyBalance = async (accountId: string) => {
    try {
      await api.financial.banks.verifyBalance(accountId)
      toast.success("Saldo marcado como verificado")
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleRequestCorrection = async () => {
    if (!correctionModal) return
    try {
      await api.financial.banks.requestCorrection(correctionModal.id, {
        saldo_propuesto: Number(correctionModal.saldo_propuesto), motivo: correctionModal.motivo,
      })
      toast.success("Corrección solicitada", "Requiere aprobación de Supervisor y Gerente")
      setCorrectionModal(null)
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handleDecideCorrection = async (id: string, approve: boolean) => {
    try {
      if (approve) {
        const r = await api.financial.balanceCorrections.approve(id)
        toast.success(r.completo ? "Corrección aplicada" : "Aprobación registrada", r.completo ? "El saldo fue corregido" : "Falta la segunda aprobación (Supervisor o Gerente)")
      } else {
        await api.financial.balanceCorrections.reject(id)
        toast.success("Corrección rechazada")
      }
      fetchAll()
    } catch (e: any) { toast.error("Error", e.message) }
  }

  const handlePreviewImport = async () => {
    if (!selectedBank || !importForm.file) return
    setImportLoading(true)
    setImportPreview(null)
    try {
      const preview = await api.financial.banks.previewImportFile(selectedBank, importForm.file, importForm.mes, importForm.anio)
      setImportPreview(preview)
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo leer el archivo")
    } finally { setImportLoading(false) }
  }

  const handleConfirmImport = async () => {
    if (!selectedBank || !importForm.file) return
    setImportLoading(true)
    try {
      const r = await api.financial.banks.importFile(selectedBank, importForm.file, importForm.mes, importForm.anio)
      toast.success("Extracto importado", `${r.nuevas} movimientos nuevos, ${r.duplicadas} ya existían`)
      setShowImportBank(false); setImportForm({ ...importForm, file: null }); setImportPreview(null)
      fetchAll()
      if (selectedBank) loadBankTxns(selectedBank)
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo importar el archivo")
    } finally { setImportLoading(false) }
  }

  const openReconcileModal = async (txId: string) => {
    setReconcileModal({ txId, suggestions: [], loading: true })
    try {
      const suggestions = await api.financial.suggestions(txId)
      setReconcileModal({ txId, suggestions, loading: false })
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudieron cargar las sugerencias")
      setReconcileModal(null)
    }
  }

  const handleReconcile = async (txId: string, matchedType: string, matchedId?: string) => {
    try {
      await api.financial.reconcile(txId, { matched_type: matchedType, matched_id: matchedId })
      toast.success(matchedType === "cheque" ? "Conciliado — el cheque pasó a cobrado" : "Conciliado exitosamente")
      setReconcileModal(null)
      if (selectedBank) loadBankTxns(selectedBank)
      api.financial.banksDashboard().then(setBankDashboard)
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo conciliar")
    }
  }

  const handleUnreconcile = async (txId: string) => {
    try {
      await api.financial.unreconcile(txId)
      toast.success("Conciliación revertida")
      if (selectedBank) loadBankTxns(selectedBank)
      api.financial.banksDashboard().then(setBankDashboard)
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo revertir")
    }
  }

  const openAutoReconcile = async () => {
    if (!selectedBank) return
    setAutoModal({ loading: true, candidates: [] })
    try {
      const pendientes = await api.financial.banks.transactions(selectedBank, { conciliado: false, limit: 50 })
      const results = await Promise.all(
        pendientes.map(async (t: any) => {
          const suggestions = await api.financial.suggestions(t.id)
          const mejor = suggestions.find((s: any) => s.confidence === "alta")
          return mejor ? { txId: t.id, descripcion: t.descripcion || "-", monto: t.monto, fecha: t.fecha, suggestion: mejor, selected: true } as AutoCandidate : null
        })
      )
      setAutoModal({ loading: false, candidates: results.filter((c): c is AutoCandidate => c !== null) })
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo buscar coincidencias")
      setAutoModal(null)
    }
  }

  const toggleAutoCandidate = (txId: string) => {
    if (!autoModal) return
    setAutoModal({ ...autoModal, candidates: autoModal.candidates.map(c => c.txId === txId ? { ...c, selected: !c.selected } : c) })
  }

  const confirmAutoReconcile = async () => {
    if (!autoModal) return
    const seleccionados = autoModal.candidates.filter(c => c.selected)
    if (seleccionados.length === 0) { setAutoModal(null); return }
    try {
      const r = await api.financial.bulkReconcile(
        seleccionados.map(c => ({ transaction_id: c.txId, matched_type: c.suggestion.tipo, matched_id: c.suggestion.id }))
      )
      toast.success("Conciliación automática", `${r.conciliadas} movimientos conciliados`)
      setAutoModal(null)
      if (selectedBank) loadBankTxns(selectedBank)
      api.financial.banksDashboard().then(setBankDashboard)
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo conciliar en lote")
    }
  }

  const handleCreateCheque = async () => {
    if (!chequeForm.numero.trim() || !chequeForm.beneficiario.trim() || !chequeForm.monto || Number(chequeForm.monto) <= 0) {
      toast.error("Datos incompletos", "Completá el número de cheque, beneficiario y un monto válido")
      return
    }
    setSubmittingCheque(true)
    try {
      await api.cheques.create({
        ...chequeForm,
        numero: chequeForm.numero.trim(),
        beneficiario: chequeForm.beneficiario.trim(),
        monto: Number(chequeForm.monto),
        supplier_id: chequeForm.supplier_id || undefined,
        diferido: chequeForm.diferido,
        cruzado: chequeForm.cruzado,
        no_a_la_orden: chequeForm.no_a_la_orden,
        fecha_entrega: chequeForm.fecha_entrega || undefined,
        fecha_pago: chequeForm.diferido ? (chequeForm.fecha_pago || undefined) : chequeForm.fecha_emision,
        bank_account_id: chequeForm.bank_account_id || undefined,
        estado: "entregado",
      })
      toast.success("Cheque emitido", `Cheque N° ${chequeForm.numero} emitido exitosamente`)
      setShowChequeModal(false)
      setChequeForm({
        numero: "", bank_account_id: "", banco_emisor: "", beneficiario: "",
        supplier_id: "", monto: "", moneda: "PYG", fecha_emision: getTodayAsuncion(),
        fecha_entrega: "", fecha_pago: getTodayAsuncion(), diferido: false,
        cruzado: true, no_a_la_orden: false, concepto: "",
      })
      fetchCheques()
      fetchAll()
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo emitir el cheque")
    } finally {
      setSubmittingCheque(false)
    }
  }

  const handleUpdateChequeEstado = async (id: string, nuevoEstado: string) => {
    const notas = window.prompt(`Cambiar estado a "${nuevoEstado}". Ingresá una nota u observación (opcional):`) ?? undefined
    try {
      await api.cheques.updateEstado(id, { estado: nuevoEstado, notas })
      toast.success("Estado actualizado", `Cheque marcado como "${nuevoEstado}"`)
      fetchCheques()
    } catch (e: any) {
      toast.error("Error", e.message || "No se pudo actualizar el cheque")
    }
  }

  const handleViewChequeHistorial = async (cheque: any) => {
    try {
      const items = await api.cheques.historial(cheque.id)
      setChequeHistorial({ cheque, items })
    } catch {
      toast.error("Error", "No se pudo obtener el historial del cheque")
    }
  }

  const openTransactionModal = (defaultBankId?: string) => {
    const targetBank = defaultBankId || selectedBank || (banks.length > 0 ? banks[0].id : "")
    setTxForm({
      bank_account_id: targetBank,
      tipo: "debito",
      categoria: "comision_bancaria",
      monto: "",
      fecha: getTodayAsuncion(),
      referencia: "",
      contraparte: "",
      descripcion: "",
      tiene_comision: false,
      comision_adicional: "5500",
    })
    setTransferForm({
      origen_account_id: targetBank,
      destino_account_id: banks.find(b => b.id !== targetBank)?.id || "",
      monto: "",
      fecha: getTodayAsuncion(),
      referencia: "",
      descripcion: "",
      comision: "",
    })
    setTxMode("directo")
    setShowTxModal(true)
  }

  const handleSaveBankTransaction = async () => {
    if (!txForm.bank_account_id) {
      toast.error("Error", "Debe seleccionar una cuenta bancaria.")
      return
    }
    const montoNum = Number(txForm.monto)
    if (!montoNum || montoNum <= 0) {
      toast.error("Error", "Ingrese un monto válido mayor a 0.")
      return
    }
    const comisionNum = txForm.tiene_comision && Number(txForm.comision_adicional) > 0 ? Number(txForm.comision_adicional) : undefined

    setSubmittingTx(true)
    try {
      await api.financial.banks.createTransaction(txForm.bank_account_id, {
        tipo: txForm.tipo,
        categoria: txForm.categoria,
        monto: montoNum,
        fecha: txForm.fecha || getTodayAsuncion(),
        referencia: txForm.referencia.trim() || undefined,
        contraparte: txForm.contraparte.trim() || undefined,
        descripcion: txForm.descripcion.trim() || undefined,
        comision_adicional: comisionNum,
      })
      toast.success("Movimiento registrado", "Se registró el movimiento correctamente y se actualizó el saldo.")
      setShowTxModal(false)
      fetchAll()
      if (selectedBank) loadBankTxns(selectedBank)
    } catch (e: any) {
      toast.error("Error al registrar movimiento", e.message || "Ocurrió un error al procesar el movimiento.")
    } finally {
      setSubmittingTx(false)
    }
  }

  const handleSaveBankTransfer = async () => {
    if (!transferForm.origen_account_id || !transferForm.destino_account_id) {
      toast.error("Error", "Debe seleccionar cuenta de origen y destino.")
      return
    }
    if (transferForm.origen_account_id === transferForm.destino_account_id) {
      toast.error("Error", "La cuenta de origen y destino no pueden ser la misma.")
      return
    }
    const montoNum = Number(transferForm.monto)
    if (!montoNum || montoNum <= 0) {
      toast.error("Error", "Ingrese un monto de transferencia mayor a 0.")
      return
    }
    const comisionNum = transferForm.comision ? Number(transferForm.comision) : undefined

    setSubmittingTx(true)
    try {
      const res = await api.financial.banks.createTransfer({
        origen_account_id: transferForm.origen_account_id,
        destino_account_id: transferForm.destino_account_id,
        monto: montoNum,
        fecha: transferForm.fecha || getTodayAsuncion(),
        referencia: transferForm.referencia.trim() || undefined,
        descripcion: transferForm.descripcion.trim() || undefined,
        comision: comisionNum,
      })
      toast.success("Transferencia realizada", res.mensaje || "Transferencia interna procesada exitosamente.")
      setShowTxModal(false)
      fetchAll()
      if (selectedBank) loadBankTxns(selectedBank)
    } catch (e: any) {
      toast.error("Error en transferencia", e.message || "No se pudo realizar la transferencia entre cuentas.")
    } finally {
      setSubmittingTx(false)
    }
  }

  const handleDeleteTransaction = async (txId: string, desc: string) => {
    if (!window.confirm(`¿Desea eliminar este movimiento bancario (${desc || "Sin descripción"})?\n\nEl saldo de la cuenta será revertido automáticamente.`)) {
      return
    }
    try {
      const res = await api.financial.banks.deleteTransaction(txId)
      toast.success("Movimiento eliminado", res.mensaje || "El movimiento bancario fue eliminado y el saldo revertido.")
      fetchAll()
      if (selectedBank) loadBankTxns(selectedBank)
    } catch (e: any) {
      toast.error("Error al eliminar movimiento", e.message || "No se pudo eliminar el movimiento.")
    }
  }

  // Filtrado de movimientos
  const filteredBankTxns = bankTxns.filter(t => {
    if (txFilterTipo !== "todos" && t.tipo !== txFilterTipo) return false
    if (txFilterCategoria !== "todas" && t.categoria !== txFilterCategoria) return false
    if (txFilterConciliado === "conciliados" && !t.conciliado) return false
    if (txFilterConciliado === "pendientes" && t.conciliado) return false
    if (txSearch) {
      const q = txSearch.toLowerCase()
      const desc = (t.descripcion || "").toLowerCase()
      const ref = (t.referencia || "").toLowerCase()
      if (!desc.includes(q) && !ref.includes(q)) return false
    }
    return true
  }).sort((a, b) => new Date(b.fecha || b.created_at || 0).getTime() - new Date(a.fecha || a.created_at || 0).getTime())

  const totalLiquidezPyg = useMemo(() => {
    return banks.reduce((acc, b) => acc + (b.moneda === "PYG" ? Number(b.saldo_actual || 0) : Number(b.saldo_actual || 0) * 7550), 0)
  }, [banks])

  return (
    <div className="space-y-6 min-w-0 animate-fade-in-up pb-16">
      {/* 🌟 LUXURY COMMAND DECK HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/90 text-white p-7 border border-blue-500/20 shadow-2xl shadow-blue-950/30">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 border border-blue-400/30 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Landmark className="w-7 h-7" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-blue-400 uppercase bg-blue-500/10 px-2.5 py-0.5 rounded-md border border-blue-500/20">
                    FINANZAS & TESORERÍA · GESTIÓN BANCARIA & CONCILIACIÓN
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    {banks.length} Cuentas Bancarias
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Bancos & Posición Financiera
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Control multimoneda, conciliación inteligente con IA, custodia de cheques y monitoreo de liquidez en tiempo real
                </p>
              </div>
            </div>

            {/* Micro pills de estado */}
            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-slate-300 flex-wrap">
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                🏢 Extra Supermercado (Central)
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-emerald-300">
                💵 {formatPYG(totalLiquidezPyg)} liquidez total
              </span>
              <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-purple-300">
                📝 {chequesDashboard?.cantidad_cartera || 0} cheques en cartera
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={() => { setRefreshing(true); fetchAll(); if (activeTab === "cheques") fetchCheques(); }}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 backdrop-blur-md transition shadow-sm"
              title="Actualizar datos en vivo"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-blue-400" : ""}`} />
            </button>
            <button
              onClick={() => setShowImportBank(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              <Upload className="w-4 h-4 text-sky-400" />
              <span>Importar Extracto</span>
            </button>
            <button
              onClick={() => {
                const defaultBankId = selectedBank || (banks.length > 0 ? banks[0].id : "")
                const acct = banks.find(b => b.id === defaultBankId)
                setChequeForm({
                  numero: "",
                  bank_account_id: defaultBankId,
                  banco_emisor: acct?.banco || "",
                  beneficiario: "",
                  supplier_id: "",
                  monto: "",
                  moneda: acct?.moneda || "PYG",
                  fecha_emision: getTodayAsuncion(),
                  fecha_entrega: "",
                  fecha_pago: getTodayAsuncion(),
                  diferido: false,
                  cruzado: true,
                  no_a_la_orden: false,
                  concepto: "",
                })
                setShowChequeModal(true)
              }}
              className="px-4 py-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              <Receipt className="w-4 h-4 text-purple-400" />
              <span>Emitir Cheque</span>
            </button>
            <button
              onClick={() => { setTxMode("directo"); openTransactionModal(selectedBank) }}
              className="px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              <span>Movimiento Bancario</span>
            </button>
            <button
              onClick={() => { setTxMode("transferencia"); openTransactionModal(selectedBank) }}
              className="px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-white border border-amber-500/30 text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              <ArrowLeftRight className="w-4 h-4 text-amber-400" />
              <span>Transferencia</span>
            </button>
            <button
              onClick={() => {
                setDepositForm({
                  bank_account_id: selectedBank || (banks.length > 0 ? banks[0].id : ""),
                  monto: "",
                  numero_boleta: "",
                  transportadora: "Prosegur",
                  fecha_deposito: getTodayAsuncion(),
                  observaciones: "",
                  categoria_ext: "deposito_efectivo",
                  referencia_ext: "",
                  contraparte_ext: "",
                  descripcion_ext: "",
                })
                setDepositMode("boveda")
                api.vault.dashboard().then((res: any) => {
                  setDepositVaultBalance(Number(res?.saldo_en_boveda_pyg ?? 0))
                }).catch(() => setDepositVaultBalance(null))
                setShowDepositModal(true)
              }}
              className="px-4 py-2.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 hover:text-white border border-sky-500/30 text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              <Building2 className="w-4 h-4 text-sky-400" />
              <span>Depósito Bancario</span>
            </button>
            <button
              onClick={() => setShowBankForm(true)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-extrabold transition flex items-center gap-2 shadow-lg shadow-blue-500/25"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Cuenta</span>
            </button>
          </div>
        </div>

        {/* 📊 BARRA DE KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Liquidez Total</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-emerald-400">
              {formatPYG(totalLiquidezPyg)}
            </p>
            <p className="text-[11px] text-slate-400 font-mono">Consolidado todas las monedas</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cuentas Activas</span>
              <Landmark className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-blue-300">
              {banks.length}
            </p>
            <p className="text-[11px] text-slate-400">Bancos nacionales</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Por Conciliar</span>
              <Wand2 className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-amber-400">
              {bankDashboard?.pendientes || 0}
            </p>
            <p className="text-[11px] text-slate-400">Movimientos pendientes</p>
          </div>

          <div className="space-y-1 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cheques Cartera</span>
              <Receipt className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-black font-mono tracking-tight text-purple-300">
              {chequesDashboard?.cantidad_cartera || 0}
            </p>
            <p className="text-[11px] text-slate-400">Diferidos & al día</p>
          </div>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN GLASSMORPHISM POR PESTAÑAS */}
      <div className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-1.5 shadow-sm">
        {[
          { key: "posicion", label: "Posición & Cuentas", icon: Landmark, count: banks.length },
          { key: "movimientos", label: "Extractos & Movimientos", icon: FileSpreadsheet, count: bankTxns.length },
          { key: "conciliacion", label: "Conciliación Inteligente", icon: Wand2, count: bankDashboard?.pendientes },
          { key: "cheques", label: "Cartera de Cheques", icon: Receipt, count: chequesDashboard?.cantidad_cartera },
          { key: "auditoria", label: "Auditoría & Saldos", icon: ShieldCheck, count: alerts.length + corrections.length },
        ].map((t) => {
          const Icon = t.icon
          const active = activeTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as TabType)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                active
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {t.count !== undefined && t.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  active ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* TAB 1: POSICIÓN & CUENTAS */}
          {activeTab === "posicion" && (
            <div className="space-y-6">
              {/* Alertas Urgentes */}
              {alerts.length > 0 && (
                <div className="space-y-2">
                  {alerts.map(a => (
                    <div key={a.id} className="card p-4 border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                        <div>
                          <div className="font-semibold text-sm text-gray-900 dark:text-white">{a.titulo}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">{a.descripcion}</div>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => handleDecideAlert(a.id, true)} className="btn-outline text-xs">Reconocer</button>
                        <button onClick={() => handleDecideAlert(a.id, false)} className="btn-ghost text-xs">Descartar</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Posición de Caja Consolidada */}
              {cashPosition && (
                <div className="card p-6 min-w-0 overflow-hidden bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-900 border border-gray-100 dark:border-gray-700">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-2">
                    <div>
                      <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wider">Posición de Caja Consolidada</h3>
                      <div className="text-3xl sm:text-4xl font-extrabold mt-1 text-gray-900 dark:text-white font-mono tabular-nums">
                        {formatGs(cashPosition.total_pyg_equivalente)}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-2">
                        {Object.entries(cashPosition.por_moneda || {}).map(([m, v]: [string, any]) => (
                          <span key={m} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-200">
                            <span className="w-2 h-2 rounded-full bg-primary" />
                            {formatPYG(Number(v))} <span className="font-bold">{m}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => api.financial.downloadCashPositionPdf().catch((e: any) => toast.error("Error", e.message))}
                      className="btn-outline text-xs flex items-center gap-2 shrink-0 self-start"
                    >
                      <FileDown className="w-4 h-4 text-red-500" /> Exportar Posición PDF
                    </button>
                  </div>

                  {/* Gráfico de Evolución de Saldo */}
                  {cashPosition.tendencia?.length > 1 && (() => {
                    const saldos = cashPosition.tendencia.map((t: any) => Number(t.saldo))
                    const dataMin = Math.min(...saldos)
                    const dataMax = Math.max(...saldos)
                    const pad = Math.max((dataMax - dataMin) * 0.1, 1)
                    const yDomain: [number, number] = [Math.floor(dataMin - pad), Math.ceil(dataMax + pad)]
                    return (
                      <div className="h-64 w-full min-w-0 mt-6 overflow-hidden">
                        <ResponsiveContainer width="100%" height="100%" debounce={50}>
                          <AreaChart data={cashPosition.tendencia} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                            <defs>
                              <linearGradient id="cashPositionFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.4} />
                                <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-gray-100 dark:text-gray-800" />
                            <XAxis
                              dataKey="fecha" tick={{ fontSize: 11, fill: "currentColor" }} className="text-gray-400"
                              tickFormatter={(v: string) => new Date(v).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit" })}
                              interval="preserveStartEnd" minTickGap={40} axisLine={false} tickLine={false}
                            />
                            <YAxis
                              tick={{ fontSize: 11, fill: "currentColor" }} className="text-gray-400" width={58}
                              tickFormatter={(v: number) => `${(v / 1000000).toFixed(0)}M`} axisLine={false} tickLine={false}
                              domain={yDomain}
                            />
                            <Tooltip
                              formatter={(v: number) => [formatGs(v), "Saldo Bancario"]}
                              labelFormatter={(v: string) => new Date(v).toLocaleDateString("es-PY", { day: "2-digit", month: "long", year: "numeric" })}
                              contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)" }}
                            />
                            <Area type="monotone" dataKey="saldo" stroke="#4f46e5" strokeWidth={3} fill="url(#cashPositionFill)" dot={false} activeDot={{ r: 5 }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Métricas Globales del Dashboard Bancario */}
              {bankDashboard && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="card p-5">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Saldo Total Disponible</div>
                    <div className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate mt-1 text-gray-900 dark:text-white font-mono">{formatGs(bankDashboard.saldo_total)}</div>
                    <div className="text-xs text-gray-400 mt-1">{banks.length} cuentas operativas</div>
                  </div>
                  <div className="card p-5">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Movimientos</div>
                    <div className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate mt-1 text-gray-900 dark:text-white font-mono">{bankDashboard.total_transactions}</div>
                    <div className="text-xs text-gray-400 mt-1">Registrados en el sistema</div>
                  </div>
                  <div className="card p-4 border-emerald-200 dark:border-emerald-900/30">
                    <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Movimientos Conciliados</div>
                    <div className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate mt-1 text-emerald-600 font-mono">
                      {bankDashboard.conciliadas}
                      <span className="text-xs font-normal text-gray-400 ml-2">
                        ({bankDashboard.total_transactions > 0 ? Math.round(bankDashboard.conciliadas / bankDashboard.total_transactions * 100) : 0}%)
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Extractos emparejados</div>
                  </div>
                  <div className="card p-4 border-amber-200 dark:border-amber-900/30">
                    <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Pendientes de Conciliar</div>
                    <div className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate mt-1 text-amber-600 font-mono">{bankDashboard.pendientes}</div>
                    <div className="text-xs text-gray-400 mt-1">Requieren revisión o match</div>
                  </div>
                </div>
              )}

              {/* Tarjetas de Cuentas Bancarias */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Cuentas Bancarias</h3>
                  <span className="text-xs text-gray-500">Hacé clic en una cuenta para filtrar sus movimientos</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {banks.map(b => {
                    const acctStats = bankDashboard?.accounts?.find((a: any) => a.id === b.id)
                    const isSelected = selectedBank === b.id
                    return (
                      <div
                        key={b.id}
                        onClick={() => { setSelectedBank(b.id); loadBankTxns(b.id); }}
                        className={`card p-5 cursor-pointer transition-all border ${
                          isSelected
                            ? "ring-2 ring-primary border-primary shadow-md"
                            : "hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">{b.tipo} · {b.moneda}</span>
                            <div className="mt-1">
                              {b.alias ? (
                                <div>
                                  <span className="inline-block text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                                    {b.alias}
                                  </span>
                                  <h4 className="text-sm font-bold text-gray-900 dark:text-white mt-1">
                                    {b.banco}
                                  </h4>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <h4 className="text-base font-bold text-gray-900 dark:text-white">
                                    {b.banco}
                                  </h4>
                                  <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                    Sin Alias
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 font-mono mt-0.5">{b.numero_cuenta}</div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={e => { e.stopPropagation(); handleOpenEditBank(b); }}
                              className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg text-slate-400 hover:text-indigo-600 transition"
                              title="Editar alias y datos de la cuenta"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); setUmbralModal({ id: b.id, valor: b.saldo_minimo_alerta != null ? String(b.saldo_minimo_alerta) : "" }); }}
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 hover:text-gray-600 transition"
                              title="Configurar umbral de alerta"
                            >
                              <Settings2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); handleDeleteBank(b); }}
                              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg text-slate-400 hover:text-red-500 transition"
                              title="Eliminar cuenta bancaria"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs ml-1">
                              {b.moneda}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                          <div className="text-xs text-gray-400">Saldo Actual</div>
                          <div className="text-xl font-extrabold text-gray-900 dark:text-white font-mono mt-0.5">
                            {formatGs(b.saldo_actual)}
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3 text-xs">
                          {acctStats && acctStats.pendientes > 0 ? (
                            <span className="font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              {acctStats.pendientes} sin conciliar
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-medium flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> 100% al día
                            </span>
                          )}
                          {b.saldo_minimo_alerta != null && (
                            <span className="text-[11px] text-gray-400">Mín: {formatGs(b.saldo_minimo_alerta)}</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs">
                          {b.saldo_verificado_manualmente ? (
                            <span className="text-emerald-600 flex items-center gap-1 font-medium" title={b.saldo_verificado_at ? `Verificado ${new Date(b.saldo_verificado_at).toLocaleString("es-PY")}` : ""}>
                              <ShieldCheck className="w-4 h-4" /> Verificado
                            </span>
                          ) : (
                            <span className="text-gray-400 flex items-center gap-1">
                              <ShieldAlert className="w-4 h-4" /> Autocalculado
                            </span>
                          )}
                          <div className="flex gap-2">
                            {!b.saldo_verificado_manualmente && (
                              <button
                                onClick={e => { e.stopPropagation(); handleVerifyBalance(b.id); }}
                                className="text-primary font-semibold hover:underline"
                              >
                                Verificar
                              </button>
                            )}
                            <button
                              onClick={e => { e.stopPropagation(); setCorrectionModal({ id: b.id, saldo_propuesto: String(b.saldo_actual ?? ""), motivo: "" }); }}
                              className="text-gray-500 hover:underline"
                            >
                              Corregir
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Partidas Pendientes de Conciliar (Cheques y Depósitos de Caja) */}
              {outstandingItems && (outstandingItems.cheques_pendientes?.length > 0 || outstandingItems.depositos_sin_conciliar?.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
                  {outstandingItems.cheques_pendientes?.length > 0 && (
                    <div className="card p-5">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                          <Receipt className="w-4 h-4 text-purple-500" />
                          Cheques Emitidos Pendientes de Cobro
                        </h3>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                          {outstandingItems.cheques_pendientes.length}
                        </span>
                      </div>
                      <div className="text-xl font-extrabold text-amber-600 font-mono mb-3">
                        {formatGs(outstandingItems.total_cheques_pendientes)}
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {outstandingItems.cheques_pendientes.map((c: any) => (
                          <div key={c.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-gray-50 dark:bg-slate-800/50">
                            <div>
                              <div className="font-semibold text-gray-800 dark:text-gray-200">N° {c.numero} — {c.beneficiario}</div>
                              <div className="text-gray-400 text-[11px]">{c.fecha_pago ? `Vence: ${new Date(c.fecha_pago).toLocaleDateString("es-PY")}` : ""}</div>
                            </div>
                            <span className="font-bold text-gray-900 dark:text-white font-mono">{formatGs(c.monto)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {outstandingItems.depositos_sin_conciliar?.length > 0 && (
                    <div className="card p-5">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                          <Landmark className="w-4 h-4 text-teal-500" />
                          Depósitos de Caja en Tránsito
                        </h3>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">
                          {outstandingItems.depositos_sin_conciliar.length}
                        </span>
                      </div>
                      <div className="text-xl font-extrabold text-teal-600 font-mono mb-3">
                        {formatGs(outstandingItems.total_depositos_sin_conciliar)}
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {outstandingItems.depositos_sin_conciliar.slice(0, 20).map((d: any) => (
                          <div key={d.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-gray-50 dark:bg-slate-800/50">
                            <div>
                              <div className="font-semibold text-gray-800 dark:text-gray-200">{d.descripcion}</div>
                              <div className="text-gray-400 text-[11px]">{new Date(d.fecha).toLocaleDateString("es-PY")}</div>
                            </div>
                            <span className="font-bold text-gray-900 dark:text-white font-mono">{formatGs(d.monto)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MOVIMIENTOS & EXTRACTOS */}
          {activeTab === "movimientos" && (
            <div className="space-y-5">
              {/* Barra de Filtros */}
              <div className="card p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Selector de Banco */}
                  <div className="w-full sm:w-64">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Cuenta Bancaria</label>
                    <select
                      className="input-field w-full text-xs"
                      value={selectedBank}
                      onChange={e => { setSelectedBank(e.target.value); loadBankTxns(e.target.value); }}
                    >
                      {banks.map(b => (
                        <option key={b.id} value={b.id}>{formatBankLabel(b)}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filtro por Categoría */}
                  <div className="w-48">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Categoría</label>
                    <select className="input-field w-full text-xs" value={txFilterCategoria} onChange={e => setTxFilterCategoria(e.target.value)}>
                      <option value="todas">Todas las categorías</option>
                      {Object.entries(BANK_CATEGORIA_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filtro por Tipo */}
                  <div className="w-36">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Tipo</label>
                    <select className="input-field w-full text-xs" value={txFilterTipo} onChange={e => setTxFilterTipo(e.target.value)}>
                      <option value="todos">Todos</option>
                      <option value="credito">Ingresos (+)</option>
                      <option value="debito">Egresos (-)</option>
                    </select>
                  </div>

                  {/* Filtro Conciliado */}
                  <div className="w-40">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Estado</label>
                    <select className="input-field w-full text-xs" value={txFilterConciliado} onChange={e => setTxFilterConciliado(e.target.value)}>
                      <option value="todos">Todos los estados</option>
                      <option value="conciliados">Solo Conciliados</option>
                      <option value="pendientes">Solo Pendientes</option>
                    </select>
                  </div>

                  {/* Buscador */}
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Buscar</label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Descripción, concepto o referencia..."
                        className="input-field pl-9 w-full text-xs"
                        value={txSearch}
                        onChange={e => setTxSearch(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabla de Movimientos */}
              <div className="card p-0 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                      Movimientos Bancarios ({filteredBankTxns.length})
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openTransactionModal(selectedBank)}
                      className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-xs flex items-center gap-1.5 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" /> Registrar Movimiento
                    </button>
                    <button
                      onClick={() => {
                        const hoyStr = getTodayAsuncion()
                        const [year, month] = hoyStr.split("-")
                        const desde = `${year}-${month}-01`
                        api.financial.downloadReconciliationPdf(selectedBank, { desde, hasta: hoyStr }).catch((e: any) => toast.error("Error", e.message))
                      }}
                      className="btn-outline text-xs flex items-center gap-1.5"
                    >
                      <FileDown className="w-3.5 h-3.5 text-red-500" /> PDF Conciliación
                    </button>
                    <button onClick={openAutoReconcile} className="btn-primary text-xs flex items-center gap-1.5">
                      <Wand2 className="w-3.5 h-3.5" /> Auto-Conciliar
                    </button>
                  </div>
                </div>

                {txnsLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : filteredBankTxns.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">No se encontraron movimientos con los filtros seleccionados</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-slate-800/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                          <th className="p-3.5">Fecha</th>
                          <th className="p-3.5">Tipo</th>
                          <th className="p-3.5">Categoría</th>
                          <th className="p-3.5">Monto</th>
                          <th className="p-3.5">Descripción</th>
                          <th className="p-3.5">Referencia</th>
                          <th className="p-3.5 text-center">Conciliado</th>
                          <th className="p-3.5 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                        {filteredBankTxns.map(t => (
                          <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="p-3.5 whitespace-nowrap text-xs text-gray-600 dark:text-gray-300 font-mono">
                              {t.fecha ? new Date(t.fecha).toLocaleDateString("es-PY") : "—"}
                            </td>
                            <td className="p-3.5 whitespace-nowrap">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                t.tipo === "credito"
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                  : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                              }`}>
                                {t.tipo === "credito" ? "+ Ingreso" : "- Egreso"}
                              </span>
                            </td>
                            <td className="p-3.5 whitespace-nowrap">
                              {(() => {
                                const cat = BANK_CATEGORIA_LABELS[t.categoria as string] || BANK_CATEGORIA_LABELS.otros
                                return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cat.className}`}>{cat.label}</span>
                              })()}
                            </td>
                            <td className="p-3.5 whitespace-nowrap font-mono font-bold text-gray-900 dark:text-white">
                              {formatGs(t.monto)}
                            </td>
                            <td className="p-3.5 max-w-xs truncate text-xs text-gray-600 dark:text-gray-300" title={t.descripcion}>
                              {t.descripcion || "—"}
                            </td>
                            <td className="p-3.5 whitespace-nowrap font-mono text-xs text-gray-400">
                              {t.referencia || "—"}
                            </td>
                            <td className="p-3.5 text-center">
                              {t.conciliado ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 text-emerald-600" title="Movimiento Conciliado">
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-400" title="Pendiente de Conciliación">
                                  <Clock className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {t.conciliado ? (
                                  <button
                                    onClick={() => handleUnreconcile(t.id)}
                                    className="text-xs text-gray-500 hover:text-red-600 font-medium hover:underline"
                                  >
                                    Desconciliar
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => openReconcileModal(t.id)}
                                      className="btn-primary py-1 px-3 text-xs"
                                    >
                                      Conciliar
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTransaction(t.id, t.descripcion || t.referencia || "")}
                                      className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                                      title="Eliminar movimiento y revertir saldo"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CONCILIACIÓN INTELIGENTE */}
          {activeTab === "conciliacion" && (
            <div className="space-y-6">
              {/* Header de Conciliación con KPIs */}
              <div className="card p-6 bg-gradient-to-br from-indigo-50 to-blue-50/50 dark:from-slate-800/90 dark:to-slate-900 border border-indigo-100 dark:border-indigo-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-wider block">Asistente de Conciliación Bancaria</span>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-1">Emparejamiento Inteligente de Extractos</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xl">
                    El motor busca coincidencias exactas y aproximadas contra órdenes de compra, pagos a proveedores, ventas del POS y transferencias de bóveda.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button onClick={openAutoReconcile} className="btn-primary flex items-center gap-2 text-xs">
                    <Wand2 className="w-4 h-4" /> Conciliación Automática en Lote
                  </button>
                </div>
              </div>

              {/* Movimientos Pendientes de Conciliar */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                    Partidas Pendientes de Conciliación en Cuenta Seleccionada
                  </h4>
                  <select
                    className="input-field text-xs w-60"
                    value={selectedBank}
                    onChange={e => { setSelectedBank(e.target.value); loadBankTxns(e.target.value); }}
                  >
                    {banks.map(b => (
                      <option key={b.id} value={b.id}>{formatBankLabel(b)}</option>
                    ))}
                  </select>
                </div>

                {bankTxns.filter(t => !t.conciliado).length === 0 ? (
                  <div className="text-center py-12 text-emerald-600 space-y-2">
                    <CheckCircle className="w-12 h-12 mx-auto text-emerald-500" />
                    <div className="font-bold text-base">¡Todo al día!</div>
                    <p className="text-xs text-gray-400">No hay movimientos pendientes de conciliar en esta cuenta bancaria.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bankTxns.filter(t => !t.conciliado).sort((a, b) => new Date(b.fecha || b.created_at || 0).getTime() - new Date(a.fecha || a.created_at || 0).getTime()).map(t => (
                      <div key={t.id} className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-slate-800/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              t.tipo === "credito" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                            }`}>
                              {t.tipo === "credito" ? "+ Ingreso" : "- Egreso"}
                            </span>
                            <span className="font-bold text-sm text-gray-900 dark:text-white font-mono">{formatGs(t.monto)}</span>
                            <span className="text-xs text-gray-400">· {t.fecha ? new Date(t.fecha).toLocaleDateString("es-PY") : ""}</span>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-300">{t.descripcion || "Sin descripción"}</div>
                          {t.referencia && <div className="text-[11px] text-gray-400 font-mono">Ref: {t.referencia}</div>}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openReconcileModal(t.id)}
                            className="btn-primary text-xs flex items-center gap-1.5"
                          >
                            <Wand2 className="w-3.5 h-3.5" /> Buscar Coincidencia
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: CARTERA DE CHEQUES */}
          {activeTab === "cheques" && (
            <div className="space-y-6">
              {/* Tarjetas KPI de Cheques */}
              {chequesDashboard && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="card p-4">
                    <div className="text-xs font-semibold text-gray-500 uppercase">Cartera Total</div>
                    <div className="text-lg font-bold mt-1 text-gray-900 dark:text-white font-mono">{formatGs(chequesDashboard.total_cartera)}</div>
                    <div className="text-[11px] text-gray-400">{chequesDashboard.cantidad_cartera} cheques</div>
                  </div>
                  <div className={`card p-4 ${chequesDashboard.cantidad_vencidos > 0 ? "border-red-300 dark:border-red-800 bg-red-50/20" : ""}`}>
                    <div className="text-xs font-semibold text-red-600 uppercase">Vencidos sin Cobrar</div>
                    <div className="text-lg font-bold mt-1 text-red-600 font-mono">{formatGs(chequesDashboard.vencidos_sin_cobrar)}</div>
                    <div className="text-[11px] text-gray-400">{chequesDashboard.cantidad_vencidos} cheques</div>
                  </div>
                  <div className={`card p-4 ${chequesDashboard.cantidad_vence_hoy > 0 ? "border-amber-300 dark:border-amber-800 bg-amber-50/20" : ""}`}>
                    <div className="text-xs font-semibold text-amber-600 uppercase">Vencen Hoy</div>
                    <div className="text-lg font-bold mt-1 text-amber-600 font-mono">{formatGs(chequesDashboard.vence_hoy)}</div>
                    <div className="text-[11px] text-gray-400">{chequesDashboard.cantidad_vence_hoy} cheques</div>
                  </div>
                  <div className="card p-4">
                    <div className="text-xs font-semibold text-amber-500 uppercase">Vencen en 7 días</div>
                    <div className="text-lg font-bold mt-1 text-amber-500 font-mono">{formatGs(chequesDashboard.por_vencer_7d)}</div>
                    <div className="text-[11px] text-gray-400">{chequesDashboard.cantidad_por_vencer_7d} cheques</div>
                  </div>
                  <div className="card p-4">
                    <div className="text-xs font-semibold text-gray-500 uppercase">Vencen en 30 días</div>
                    <div className="text-lg font-bold mt-1 text-gray-900 dark:text-white font-mono">{formatGs(chequesDashboard.por_vencer_30d)}</div>
                    <div className="text-[11px] text-gray-400">{chequesDashboard.cantidad_por_vencer_30d} cheques</div>
                  </div>
                  <div className="card p-4">
                    <div className="text-xs font-semibold text-red-700 uppercase">Rechazados</div>
                    <div className="text-lg font-bold mt-1 text-red-700 font-mono">{formatGs(chequesDashboard.rechazados_monto)}</div>
                    <div className="text-[11px] text-gray-400">{chequesDashboard.cantidad_rechazados} cheques</div>
                  </div>
                </div>
              )}

              {/* Filtros y Acciones de Cheques */}
              <div className="card p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-48">
                    <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Estado</label>
                    <select className="input-field w-full text-xs" value={chequeFilterEstado} onChange={e => setChequeFilterEstado(e.target.value)}>
                      <option value="">Todos los estados</option>
                      <option value="por_cobrar">Por cobrar (Pendiente + Entregado)</option>
                      <option value="pendiente">Pendiente</option>
                      <option value="entregado">Entregado</option>
                      <option value="cobrado">Cobrado / Compensado</option>
                      <option value="rechazado">Rechazado</option>
                      <option value="anulado">Anulado</option>
                    </select>
                  </div>

                  <div className="w-56">
                    <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Cuenta Bancaria</label>
                    <select className="input-field w-full text-xs" value={chequeFilterBank} onChange={e => setChequeFilterBank(e.target.value)}>
                      <option value="">Todas las cuentas</option>
                      {banks.map(b => (
                        <option key={b.id} value={b.id}>{formatBankLabel(b)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="w-40">
                    <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Desde</label>
                    <input className="input-field w-full text-xs" type="date" value={chequeFilterFechaDesde} onChange={e => setChequeFilterFechaDesde(e.target.value)} />
                  </div>

                  <div className="w-40">
                    <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Hasta</label>
                    <input className="input-field w-full text-xs" type="date" value={chequeFilterFechaHasta} onChange={e => setChequeFilterFechaHasta(e.target.value)} />
                  </div>

                  <div className="flex-1 min-w-[200px]">
                    <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Buscar</label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="N° cheque, beneficiario, concepto..."
                        className="input-field pl-9 w-full text-xs"
                        value={chequeSearch}
                        onChange={e => setChequeSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex items-end gap-2 self-end">
                    <button
                      onClick={() => api.cheques.downloadExcel({ estado: chequeFilterEstado || undefined, fecha_desde: chequeFilterFechaDesde || undefined, fecha_hasta: chequeFilterFechaHasta || undefined }).catch((e: any) => toast.error("Error", e.message))}
                      className="btn-outline text-xs flex items-center gap-1.5"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" /> Excel
                    </button>
                    <button
                      onClick={() => api.cheques.downloadPdf({ estado: chequeFilterEstado || undefined, fecha_desde: chequeFilterFechaDesde || undefined, fecha_hasta: chequeFilterFechaHasta || undefined }).catch((e: any) => toast.error("Error", e.message))}
                      className="btn-outline text-xs flex items-center gap-1.5"
                    >
                      <FileDown className="w-3.5 h-3.5 text-red-500" /> PDF
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabla de Cheques */}
              <div className="card p-0 overflow-hidden">
                {chequesLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : cheques.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">No se encontraron cheques registrados</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-slate-800/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                          <th className="p-3.5">N° Cheque</th>
                          <th className="p-3.5">Beneficiario / Proveedor</th>
                          <th className="p-3.5">Banco</th>
                          <th className="p-3.5">Monto</th>
                          <th className="p-3.5">Emisión</th>
                          <th className="p-3.5">Fecha Cobro</th>
                          <th className="p-3.5">Estado</th>
                          <th className="p-3.5 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                        {cheques.map(c => {
                          const badge = CHEQUE_ESTADO_BADGES[c.estado] || CHEQUE_ESTADO_BADGES.pendiente
                          return (
                            <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="p-3.5 whitespace-nowrap font-mono font-bold text-gray-900 dark:text-white">
                                {c.numero}
                                {!c.numero_confiable && (
                                  <span title="Migrado desde el sistema histórico" className="ml-1.5 text-[10px] font-sans font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500">
                                    histórico
                                  </span>
                                )}
                              </td>
                              <td className="p-3.5 max-w-xs truncate font-medium text-gray-900 dark:text-white" title={c.beneficiario}>
                                {c.supplier_nombre || c.beneficiario}
                              </td>
                              <td className="p-3.5 whitespace-nowrap text-xs text-gray-500">
                                {c.banco_emisor || "—"}
                              </td>
                              <td className="p-3.5 whitespace-nowrap font-mono font-bold text-gray-900 dark:text-white">
                                {formatGs(c.monto)}
                              </td>
                              <td className="p-3.5 whitespace-nowrap text-xs text-gray-500 font-mono">
                                {c.fecha_emision ? new Date(c.fecha_emision).toLocaleDateString("es-PY") : "—"}
                              </td>
                              <td className="p-3.5 whitespace-nowrap text-xs font-mono">
                                <div className="text-gray-900 dark:text-white font-medium">
                                  {c.fecha_pago ? new Date(c.fecha_pago).toLocaleDateString("es-PY") : "—"}
                                </div>
                                {c.dias_para_vencer != null && c.estado !== "cobrado" && c.estado !== "anulado" && (
                                  <div className={`text-[10px] font-semibold ${
                                    c.dias_para_vencer < 0 ? "text-red-600" : c.dias_para_vencer === 0 ? "text-amber-600 font-bold" : "text-gray-400"
                                  }`}>
                                    {c.dias_para_vencer < 0 ? `Vencido (${Math.abs(c.dias_para_vencer)}d)` : c.dias_para_vencer === 0 ? "Vence HOY" : `En ${c.dias_para_vencer} días`}
                                  </div>
                                )}
                              </td>
                              <td className="p-3.5 whitespace-nowrap">
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge.className}`}>
                                  {badge.label}
                                </span>
                              </td>
                              <td className="p-3.5 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleViewChequeHistorial(c)}
                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500"
                                    title="Ver historial de estados"
                                  >
                                    <Clock className="w-3.5 h-3.5" />
                                  </button>
                                  {c.estado === "pendiente" && (
                                    <button
                                      onClick={() => handleUpdateChequeEstado(c.id, "entregado")}
                                      className="btn-outline py-1 px-2 text-[11px]"
                                    >
                                      Entregar
                                    </button>
                                  )}
                                  {(c.estado === "pendiente" || c.estado === "entregado") && (
                                    <button
                                      onClick={() => handleUpdateChequeEstado(c.id, "cobrado")}
                                      className="btn-primary py-1 px-2 text-[11px]"
                                    >
                                      Cobrado
                                    </button>
                                  )}
                                  {c.estado !== "anulado" && c.estado !== "cobrado" && (
                                    <button
                                      onClick={() => handleUpdateChequeEstado(c.id, "rechazado")}
                                      className="text-xs text-red-600 hover:underline px-1"
                                    >
                                      Rechazar
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: AUDITORÍA & APROBACIONES */}
          {activeTab === "auditoria" && (
            <div className="space-y-6">
              {/* Solicitudes de Corrección de Saldo Pendientes */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-blue-500" />
                      Solicitudes de Corrección de Saldo Bancario
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Flujo de doble firma: requiere aprobación independiente de Supervisor y Gerente
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
                    {corrections.length} pendientes
                  </span>
                </div>

                {corrections.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm">
                    No hay solicitudes de corrección de saldo pendientes de aprobación.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {corrections.map(c => {
                      const acct = banks.find(b => b.id === c.bank_account_id)
                      const tieneSupervisor = !!c.aprobado_supervisor_id
                      const tieneGerente = !!c.aprobado_gerente_id
                      return (
                        <div key={c.id} className="p-4 rounded-xl border border-blue-200 dark:border-blue-800/40 bg-blue-50/30 dark:bg-blue-900/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="font-bold text-sm text-gray-900 dark:text-white">
                              {acct?.banco || "Cuenta"} — {acct?.numero_cuenta} ({acct?.moneda})
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-300">{c.motivo}</div>
                            <div className="text-xs mt-1">
                              Saldo registrado: <span className="font-mono">{formatGs(c.saldo_actual)}</span> → Saldo propuesto: <span className="font-bold text-primary font-mono">{formatGs(c.saldo_propuesto)}</span>
                            </div>
                            <div className="text-[11px] text-gray-500 font-semibold mt-1">
                              Firmas requeridas: {tieneSupervisor ? "✓ Supervisor registrado" : "· Supervisor pendiente"} · {tieneGerente ? "✓ Gerente registrado" : "· Gerente pendiente"}
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => handleDecideCorrection(c.id, true)} className="btn-primary text-xs">
                              Aprobar Firma
                            </button>
                            <button onClick={() => handleDecideCorrection(c.id, false)} className="btn-ghost text-xs text-red-600">
                              Rechazar
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: Conciliar movimiento */}
      {reconcileModal && (
        <div className="modal-overlay" onClick={() => setReconcileModal(null)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Conciliar Movimiento</h3>
              <p className="text-xs text-gray-500 mt-1">Sugerencias reales por coincidencia de monto, fecha y concepto</p>
            </div>
            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
              {reconcileModal.loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : reconcileModal.suggestions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">Sin sugerencias automáticas. Podés marcarlo como conciliación manual.</p>
              ) : (
                reconcileModal.suggestions.map((s: any) => (
                  <div key={`${s.tipo}-${s.id}`} className="card p-4 flex items-center justify-between border hover:border-primary transition">
                    <div>
                      <div className="font-bold text-sm text-gray-900 dark:text-white">{s.descripcion}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {formatGs(s.monto)} · {s.fecha ? new Date(s.fecha).toLocaleDateString("es-PY") : "—"} · {s.diferencia_dias === 0 ? "mismo día" : `±${s.diferencia_dias} días`}
                      </div>
                    </div>
                    <button onClick={() => handleReconcile(reconcileModal.txId, s.tipo, s.id)} className="btn-primary text-xs">
                      Conciliar
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="p-6 border-t flex items-center justify-between">
              <button onClick={() => handleReconcile(reconcileModal.txId, "manual")} className="btn-ghost text-xs text-gray-500">
                Marcar Manual (Sin contraparte)
              </button>
              <button onClick={() => setReconcileModal(null)} className="btn-outline text-xs">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Auto-Conciliar en lote */}
      {autoModal && (
        <div className="modal-overlay" onClick={() => setAutoModal(null)}>
          <div className="modal-content max-w-xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Conciliación Automática en Lote</h3>
              <p className="text-xs text-gray-500 mt-1">Coincidencias de alta confianza (monto exacto y fecha cercana)</p>
            </div>
            <div className="p-6 space-y-2 max-h-[60vh] overflow-y-auto">
              {autoModal.loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : autoModal.candidates.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">No se encontraron coincidencias de alta confianza entre los movimientos pendientes.</p>
              ) : (
                autoModal.candidates.map(c => (
                  <label key={c.txId} className="card p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800">
                    <input type="checkbox" checked={c.selected} onChange={() => toggleAutoCandidate(c.txId)} className="rounded text-primary" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">{c.descripcion}</div>
                      <div className="text-xs text-gray-500">{formatGs(c.monto)} · {c.fecha ? new Date(c.fecha).toLocaleDateString("es-PY") : ""} → {c.suggestion.descripcion}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setAutoModal(null)} className="btn-ghost text-xs">Cancelar</button>
              <button onClick={confirmAutoReconcile} disabled={autoModal.loading || autoModal.candidates.every(c => !c.selected)} className="btn-primary text-xs disabled:opacity-50">
                Conciliar {autoModal.candidates.filter(c => c.selected).length} movimientos seleccionados
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Umbral de Alerta */}
      {umbralModal && (
        <div className="modal-overlay" onClick={() => setUmbralModal(null)}>
          <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Umbral de Saldo Mínimo</h3>
              <p className="text-xs text-gray-500 mt-1">Se generará una alerta si el saldo baja de este monto.</p>
            </div>
            <div className="p-6 space-y-3">
              <div>
                <label className="label-field">Monto Mínimo de Alerta (Gs.)</label>
                <CurrencyInput
                  currency="PYG"
                  className="input-field font-mono text-right"
                  value={umbralModal.valor}
                  onChangeValue={(num, formatted) => setUmbralModal({ ...umbralModal, valor: String(num) })}
                  placeholder="Ej: 50.000.000"
                />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setUmbralModal(null)} className="btn-ghost text-xs">Cancelar</button>
              <button onClick={handleSaveUmbral} className="btn-primary text-xs">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Corregir Saldo */}
      {correctionModal && (
        <div className="modal-overlay" onClick={() => setCorrectionModal(null)}>
          <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Corregir Saldo Bancario</h3>
              <p className="text-xs text-gray-500 mt-1">Requiere aprobación de Supervisor y Gerente antes de aplicarse.</p>
            </div>
            <div className="p-6 space-y-3">
              <div>
                <label className="label-field">Saldo Correcto (según extracto)</label>
                <CurrencyInput
                  currency="PYG"
                  className="input-field font-mono text-right"
                  value={correctionModal.saldo_propuesto}
                  onChangeValue={(num, formatted) => setCorrectionModal({ ...correctionModal, saldo_propuesto: String(num) })}
                />
              </div>
              <div>
                <label className="label-field">Motivo de la corrección</label>
                <textarea className="input-field text-xs" rows={3} value={correctionModal.motivo} onChange={e => setCorrectionModal({ ...correctionModal, motivo: e.target.value })} placeholder="Ej: Ajuste por comisiones bancarias del extracto oficial" />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setCorrectionModal(null)} className="btn-ghost text-xs">Cancelar</button>
              <button onClick={handleRequestCorrection} disabled={!correctionModal.saldo_propuesto || !correctionModal.motivo.trim()} className="btn-primary text-xs disabled:opacity-50">
                Solicitar Corrección
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Nueva Cuenta Bancaria */}
      {showBankForm && (
        <div className="modal-overlay" onClick={() => setShowBankForm(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nueva Cuenta Bancaria</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="label-field">Nombre del Banco *</label><input className="input-field" placeholder="Ej: Banco Itaú" value={bankForm.banco} onChange={e => setBankForm({ ...bankForm, banco: e.target.value })} /></div>
                <div><label className="label-field">Alias / Nickname (Opcional)</label><input className="input-field" placeholder="Ej: Itaú Recaudación, Sudameris Proveedores" value={bankForm.alias} onChange={e => setBankForm({ ...bankForm, alias: e.target.value })} /></div>
              </div>
              <div><label className="label-field">N° de Cuenta *</label><input className="input-field font-mono" placeholder="Ej: 123456789" value={bankForm.numero_cuenta} onChange={e => setBankForm({ ...bankForm, numero_cuenta: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label-field">Tipo de Cuenta</label><select className="input-field" value={bankForm.tipo} onChange={e => setBankForm({ ...bankForm, tipo: e.target.value })}><option value="corriente">Cuenta Corriente</option><option value="ahorro">Caja de Ahorro</option></select></div>
                <div><label className="label-field">Moneda</label><select className="input-field" value={bankForm.moneda} onChange={e => setBankForm({ ...bankForm, moneda: e.target.value })}><option value="PYG">PYG (Guaraní)</option><option value="USD">USD (Dólar)</option></select></div>
              </div>
              <div><label className="label-field">Saldo Inicial</label><CurrencyInput currency={bankForm.moneda === "USD" ? "USD" : "PYG"} className="input-field font-mono text-right" value={bankForm.saldo_inicial} onChangeValue={(num, formatted) => setBankForm({ ...bankForm, saldo_inicial: String(num) })} /></div>
              <div><label className="label-field">Titular de la Cuenta</label><input className="input-field" placeholder="Ej: Extra Supermercado S.A." value={bankForm.titular} onChange={e => setBankForm({ ...bankForm, titular: e.target.value })} /></div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setShowBankForm(false)} className="btn-ghost text-xs">Cancelar</button>
              <button onClick={handleCreateBank} disabled={!bankForm.banco || !bankForm.numero_cuenta} className="btn-primary text-xs disabled:opacity-50">
                Guardar Cuenta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Editar Cuenta Bancaria */}
      {editingBank && (
        <div className="modal-overlay" onClick={() => setEditingBank(null)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Editar Cuenta Bancaria</h3>
                <p className="text-xs text-slate-500">Modificar nickname / alias y datos de la cuenta</p>
              </div>
              <button onClick={() => setEditingBank(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label-field font-bold text-indigo-600 dark:text-indigo-400">Alias / Nickname de la Cuenta</label>
                <input
                  className="input-field font-semibold text-sm border-indigo-300 dark:border-indigo-700"
                  placeholder="Ej: Cta. Recaudación Central, Cta. Proveedores Itaú"
                  value={editBankForm.alias}
                  onChange={e => setEditBankForm({ ...editBankForm, alias: e.target.value })}
                />
                <p className="text-[11px] text-slate-400 mt-1">Este alias aparecerá en Bóveda, Gastos, Cheques y Conciliaciones.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label-field">Nombre del Banco *</label>
                  <input className="input-field" placeholder="Ej: Banco Continental" value={editBankForm.banco} onChange={e => setEditBankForm({ ...editBankForm, banco: e.target.value })} />
                </div>
                <div>
                  <label className="label-field">N° de Cuenta *</label>
                  <input className="input-field font-mono" placeholder="Ej: 123456789" value={editBankForm.numero_cuenta} onChange={e => setEditBankForm({ ...editBankForm, numero_cuenta: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-field">Tipo de Cuenta</label>
                  <select className="input-field" value={editBankForm.tipo} onChange={e => setEditBankForm({ ...editBankForm, tipo: e.target.value })}>
                    <option value="corriente">Cuenta Corriente</option>
                    <option value="ahorro">Caja de Ahorro</option>
                  </select>
                </div>
                <div>
                  <label className="label-field">Moneda</label>
                  <input className="input-field bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold font-mono cursor-not-allowed" value={editBankForm.moneda} disabled />
                </div>
              </div>
              <div>
                <label className="label-field">Titular de la Cuenta</label>
                <input className="input-field" placeholder="Ej: Extra Supermercado S.A." value={editBankForm.titular} onChange={e => setEditBankForm({ ...editBankForm, titular: e.target.value })} />
              </div>
              <div>
                <label className="label-field">Umbral de Saldo Mínimo (Alerta)</label>
                <CurrencyInput currency="PYG" className="input-field font-mono text-right" placeholder="Ej: 10.000.000" value={editBankForm.saldo_minimo_alerta} onChangeValue={(num, formatted) => setEditBankForm({ ...editBankForm, saldo_minimo_alerta: String(num) })} />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="bank_activo_edit"
                  checked={editBankForm.activo}
                  onChange={e => setEditBankForm({ ...editBankForm, activo: e.target.checked })}
                  className="rounded text-indigo-600"
                />
                <label htmlFor="bank_activo_edit" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Cuenta Activa para Operaciones
                </label>
              </div>
            </div>
            <div className="p-6 border-t flex justify-between items-center">
              <button
                type="button"
                onClick={() => { const b = editingBank; setEditingBank(null); handleDeleteBank(b); }}
                className="btn-ghost text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditingBank(null)} className="btn-ghost text-xs">Cancelar</button>
                <button
                  type="button"
                  onClick={handleUpdateBank}
                  disabled={!editBankForm.banco || !editBankForm.numero_cuenta}
                  className="btn-primary text-xs disabled:opacity-50"
                >
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Importar Extracto Bancario */}
      {showImportBank && (
        <div className="modal-overlay" onClick={() => { setShowImportBank(false); setImportPreview(null); }}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" />
                Importar Extracto Bancario
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Subí el archivo Excel (.xlsx / .xls) o extracto bancario. Los movimientos duplicados se detectan automáticamente.
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label-field">Cuenta Bancaria Destino *</label>
                <select className="input-field" value={selectedBank} onChange={e => { setSelectedBank(e.target.value); setImportPreview(null); }}>
                  <option value="">Seleccionar cuenta...</option>
                  {banks.map(b => <option key={b.id} value={b.id}>{formatBankLabel(b)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-field">Mes del Extracto</label>
                  <select className="input-field" value={importForm.mes} onChange={e => { setImportForm({ ...importForm, mes: Number(e.target.value) }); setImportPreview(null); }}>
                    {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-field">Año</label>
                  <input className="input-field" type="number" value={importForm.anio} onChange={e => { setImportForm({ ...importForm, anio: Number(e.target.value) }); setImportPreview(null); }} />
                </div>
              </div>
              <div>
                <label className="label-field">Archivo del Extracto (.xlsx, .xls)</label>
                <input className="input-field" type="file" accept=".xlsx,.xls" onChange={e => { setImportForm({ ...importForm, file: e.target.files?.[0] || null }); setImportPreview(null); }} />
              </div>

              {!importPreview && (
                <button onClick={handlePreviewImport} disabled={!selectedBank || !importForm.file || importLoading} className="btn-outline w-full disabled:opacity-50 flex items-center justify-center gap-2 text-xs">
                  {importLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Vista Previa del Archivo
                </button>
              )}

              {importPreview && (
                <div className="card p-4 bg-gray-50 dark:bg-slate-800 space-y-1.5 border">
                  <div className="text-xs font-bold text-gray-500 uppercase">Resumen de Análisis</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">Hoja detectada: {importPreview.sheet_matched}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-300">{importPreview.total_detectadas} movimientos encontrados</div>
                  <div className="text-xs text-emerald-600 font-bold">{importPreview.nuevas} movimientos nuevos para importar</div>
                  {importPreview.duplicadas > 0 && <div className="text-xs text-gray-400">{importPreview.duplicadas} movimientos ya existían (se omitirán)</div>}
                  {importPreview.closing_from_totals != null && (
                    <div className="text-xs text-primary font-semibold mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      Saldo de cierre según extracto: {formatGs(importPreview.closing_from_totals)}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => { setShowImportBank(false); setImportPreview(null); }} className="btn-ghost text-xs">Cancelar</button>
              <button onClick={handleConfirmImport} disabled={!importPreview || importLoading} className="btn-primary text-xs disabled:opacity-50 flex items-center gap-2">
                {importLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {importPreview ? `Importar ${importPreview.nuevas} Movimientos` : "Importar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Emitir Cheque */}
      {showChequeModal && (() => {
        const issuingAccount = banks.find(b => b.id === chequeForm.bank_account_id)
        const currentSaldo = issuingAccount ? Number(issuingAccount.saldo_actual || 0) : 0
        const montoNum = Number(chequeForm.monto) || 0
        const saldoProyectado = currentSaldo - montoNum
        const currency = issuingAccount?.moneda === "USD" ? "USD" : "PYG"
        const prefix = issuingAccount?.moneda === "USD" ? "US$" : "₲"

        return (
          <div className="modal-overlay" onClick={() => setShowChequeModal(false)}>
            <div className="modal-content max-w-2xl p-0 overflow-hidden shadow-2xl rounded-2xl border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-transparent dark:from-purple-950/40 dark:via-purple-950/20">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">Emitir Nuevo Cheque</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
                        Extra Supermercado
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      Chequera corporativa propia para pago a proveedores y acreedores
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowChequeModal(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto max-h-[72vh]">
                {/* BLOQUE 1: CUENTA BANCARIA Y NÚMERO DE CHEQUE */}
                <div className="bg-slate-50/60 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    1. Cuenta Bancaria Emisora y Comprobante
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
                    <div className="sm:col-span-7">
                      <label className="label-field mb-1">Cuenta Bancaria Emisora *</label>
                      <select
                        className="input-field text-xs font-medium"
                        value={chequeForm.bank_account_id}
                        onChange={e => {
                          const acct = banks.find(b => b.id === e.target.value)
                          setChequeForm(f => ({
                            ...f,
                            bank_account_id: e.target.value,
                            banco_emisor: acct?.banco || "",
                            moneda: acct?.moneda || "PYG",
                          }))
                        }}
                      >
                        <option value="">— Seleccionar cuenta corriente —</option>
                        {banks.map(b => (
                          <option key={b.id} value={b.id}>
                            {formatBankLabel(b)} · Saldo: Gs. {Number(b.saldo_actual || 0).toLocaleString("es-PY")}
                          </option>
                        ))}
                      </select>
                      {issuingAccount && (
                        <div className="mt-1.5 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 px-1">
                          <span>Banco: <strong>{issuingAccount.banco}</strong></span>
                          <span className="font-mono">Saldo actual: <strong className="text-gray-800 dark:text-gray-200">Gs. {Number(issuingAccount.saldo_actual || 0).toLocaleString("es-PY")}</strong></span>
                        </div>
                      )}
                    </div>

                    <div className="sm:col-span-5">
                      <label className="label-field mb-1">Número de Cheque *</label>
                      <input
                        type="text"
                        className="input-field font-mono text-xs font-bold"
                        placeholder="Ej: 0048192"
                        value={chequeForm.numero}
                        onChange={e => setChequeForm(f => ({ ...f, numero: e.target.value }))}
                      />
                      <p className="text-[10px] text-gray-400 mt-1">Número preimpreso en la chequera</p>
                    </div>
                  </div>
                </div>

                {/* BLOQUE 2: BENEFICIARIO / PROVEEDOR Y MONTO */}
                <div className="bg-slate-50/60 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    2. Beneficiario y Monto del Cheque
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                    {/* Buscador de Proveedor */}
                    <div className="md:col-span-7">
                      <SupplierSearchInput
                        label="Beneficiario / Proveedor"
                        required
                        value={chequeForm.beneficiario}
                        supplierId={chequeForm.supplier_id}
                        onSelectSupplier={({ id, name }) => setChequeForm(f => ({ ...f, beneficiario: name, supplier_id: id || "" }))}
                        onClear={() => setChequeForm(f => ({ ...f, beneficiario: "", supplier_id: "" }))}
                        placeholder="Buscar por Razón Social o RUC..."
                      />
                    </div>

                    {/* Monto con CurrencyInput canónico */}
                    <div className="md:col-span-5">
                      <label className="label-field mb-1">Monto del Cheque ({currency}) *</label>
                      <CurrencyInput
                        currency={currency}
                        prefix={prefix}
                        placeholder={currency === "USD" ? "0.00" : "0"}
                        value={chequeForm.monto}
                        onChangeValue={(num) => setChequeForm(f => ({ ...f, monto: String(num) }))}
                        className="input-field font-mono text-base font-black text-right shadow-xs focus:ring-2 focus:ring-purple-500/20"
                      />
                      {montoNum > 0 && (
                        <p className="text-[11px] font-mono text-right text-purple-600 dark:text-purple-400 font-bold mt-1">
                          {currency === "USD" ? `US$ ${montoNum.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : `Gs. ${montoNum.toLocaleString("es-PY")}`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* BLOQUE 3: FECHAS Y MODALIDAD DE PAGO */}
                <div className="bg-slate-50/60 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      3. Fechas y Modalidad de Pago
                    </span>

                    {/* Selector Al Día vs Diferido */}
                    <div className="flex p-0.5 bg-slate-200/70 dark:bg-slate-700 rounded-lg text-[11px]">
                      <button
                        type="button"
                        onClick={() => setChequeForm(f => ({ ...f, diferido: false, fecha_pago: f.fecha_emision }))}
                        className={`px-2.5 py-1 rounded-md font-bold transition ${
                          !chequeForm.diferido
                            ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-xs"
                            : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                        }`}
                      >
                        Al Día (A la vista)
                      </button>
                      <button
                        type="button"
                        onClick={() => setChequeForm(f => ({ ...f, diferido: true }))}
                        className={`px-2.5 py-1 rounded-md font-bold transition ${
                          chequeForm.diferido
                            ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-xs"
                            : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                        }`}
                      >
                        Pago Diferido
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label-field mb-1">Fecha de Emisión *</label>
                      <input
                        type="date"
                        className="input-field text-xs font-mono"
                        value={chequeForm.fecha_emision}
                        onChange={e => {
                          const val = e.target.value
                          setChequeForm(f => ({ ...f, fecha_emision: val, ...(!f.diferido ? { fecha_pago: val } : {}) }))
                        }}
                      />
                      <p className="text-[10px] text-gray-400 mt-1">Fecha de libramiento</p>
                    </div>

                    <div>
                      <label className="label-field mb-1">
                        {chequeForm.diferido ? "Fecha de Cobro / Vencimiento *" : "Fecha de Cobro (Al Día)"}
                      </label>
                      <input
                        type="date"
                        disabled={!chequeForm.diferido}
                        className={`input-field text-xs font-mono ${!chequeForm.diferido ? "opacity-60 bg-gray-100 dark:bg-slate-800 cursor-not-allowed" : ""}`}
                        value={chequeForm.fecha_pago}
                        onChange={e => setChequeForm(f => ({ ...f, fecha_pago: e.target.value }))}
                      />
                      <p className="text-[10px] text-gray-400 mt-1">
                        {chequeForm.diferido ? "Habilitado para depósito o cobro a partir de esta fecha" : "Efectivizable inmediatamente"}
                      </p>
                    </div>
                  </div>

                  {/* Cláusulas de Seguridad y Concepto */}
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-3">
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={chequeForm.cruzado}
                          onChange={e => setChequeForm(f => ({ ...f, cruzado: e.target.checked }))}
                          className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                        />
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                          Cheque Cruzado (Solo para depósito en cuenta)
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={chequeForm.no_a_la_orden}
                          onChange={e => setChequeForm(f => ({ ...f, no_a_la_orden: e.target.checked }))}
                          className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
                        />
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                          No a la Orden (Intransferible por endoso)
                        </span>
                      </label>
                    </div>

                    <div>
                      <label className="label-field mb-1">Concepto / Factura / Observaciones (Opcional)</label>
                      <input
                        type="text"
                        className="input-field text-xs"
                        placeholder="Ej: Pago Factura Contado 001-002-123456 / Mercaderías Lácteos"
                        value={chequeForm.concepto}
                        onChange={e => setChequeForm(f => ({ ...f, concepto: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* BLOQUE 4: IMPACTO FINANCIERO EN TIEMPO REAL */}
                {issuingAccount && montoNum > 0 && (
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent dark:from-purple-950/40 dark:via-purple-950/20 border border-purple-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wide flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-purple-600" />
                        Impacto Financiero Proyectado
                      </span>
                      <span className="text-[10px] font-mono text-purple-700 dark:text-purple-400 bg-purple-100/80 dark:bg-purple-900/60 px-2 py-0.5 rounded-full font-bold">
                        {issuingAccount.banco} ({currency})
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-purple-200/60 dark:border-purple-800/40 text-center">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold block">Saldo Actual Cuenta</span>
                        <span className="text-xs font-bold font-mono text-gray-800 dark:text-gray-200">
                          Gs. {currentSaldo.toLocaleString("es-PY")}
                        </span>
                      </div>
                      <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-rose-300/80 dark:border-rose-700/60 text-center ring-1 ring-rose-500/20">
                        <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold block">- Importe del Cheque</span>
                        <span className="text-xs font-black font-mono text-rose-600 dark:text-rose-400">
                          - Gs. {montoNum.toLocaleString("es-PY")}
                        </span>
                      </div>
                      <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-purple-400/80 dark:border-purple-600/60 text-center shadow-xs">
                        <span className="text-[10px] text-purple-800 dark:text-purple-300 font-extrabold block">= Saldo Proyectado</span>
                        <span className={`text-xs font-black font-mono ${saldoProyectado < 0 ? "text-rose-600 dark:text-rose-400" : "text-purple-700 dark:text-purple-300"}`}>
                          Gs. {saldoProyectado.toLocaleString("es-PY")}
                        </span>
                      </div>
                    </div>

                    {saldoProyectado < 0 && (
                      <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                        <span>
                          <strong>Advertencia:</strong> El importe del cheque excede el saldo actual disponible en cuenta. Asegurar fondos suficientes antes de la fecha de compensación ({chequeForm.fecha_pago || chequeForm.fecha_emision}).
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/70 dark:bg-slate-900/50">
                <button
                  type="button"
                  onClick={() => setShowChequeModal(false)}
                  disabled={submittingCheque}
                  className="btn-outline text-xs px-4 py-2"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateCheque}
                  disabled={submittingCheque || !chequeForm.numero.trim() || !chequeForm.beneficiario.trim() || montoNum <= 0 || !chequeForm.bank_account_id}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
                >
                  {submittingCheque ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Emitiendo...</span>
                    </>
                  ) : (
                    <>
                      <Receipt className="w-4 h-4" />
                      <span>Emitir Cheque {montoNum > 0 ? `(Gs. ${montoNum.toLocaleString("es-PY")})` : ""}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* MODAL: REGISTRO DE MOVIMIENTOS BANCARIOS (DIRECTOS Y TRANSFERENCIAS) */}
      {showTxModal && (() => {
        const selectedAccount = banks.find(b => b.id === txForm.bank_account_id)
        const currentSaldo = selectedAccount ? Number(selectedAccount.saldo_actual || 0) : 0
        const montoOperacion = Number(txForm.monto) || 0
        const comisionOperacion = (txForm.tipo === "debito" && txForm.tiene_comision && Number(txForm.comision_adicional) > 0) ? Number(txForm.comision_adicional) : 0
        const delta = txForm.tipo === "credito" ? montoOperacion : -(montoOperacion + comisionOperacion)
        const saldoProyectado = currentSaldo + delta

        const origenAccount = banks.find(b => b.id === transferForm.origen_account_id)
        const destinoAccount = banks.find(b => b.id === transferForm.destino_account_id)
        const montoTrf = Number(transferForm.monto) || 0
        const comisionTrf = Number(transferForm.comision) || 0
        const origenSaldoActual = origenAccount ? Number(origenAccount.saldo_actual || 0) : 0
        const destinoSaldoActual = destinoAccount ? Number(destinoAccount.saldo_actual || 0) : 0
        const origenSaldoProyectado = origenSaldoActual - (montoTrf + comisionTrf)
        const destinoSaldoProyectado = destinoSaldoActual + montoTrf
        const cuentasIguales = transferForm.origen_account_id && transferForm.destino_account_id && transferForm.origen_account_id === transferForm.destino_account_id

        return (
          <div className="modal-overlay" onClick={() => setShowTxModal(false)}>
            <div className="modal-content max-w-xl p-0 overflow-hidden shadow-2xl rounded-2xl" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/70 dark:bg-slate-800/70">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      Registro de Movimiento Bancario
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      Extra Supermercado — Transferencias, comisiones, impuestos o traspasos entre cuentas
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTxModal(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Selector de Modo (Tabs) */}
              <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50/40 dark:bg-slate-900/30 px-6 pt-2.5 gap-2">
                <button
                  type="button"
                  onClick={() => setTxMode("directo")}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                    txMode === "directo"
                      ? "border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-800 rounded-t-lg shadow-sm"
                      : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" /> Movimiento en Cuenta
                </button>
                <button
                  type="button"
                  onClick={() => setTxMode("transferencia")}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                    txMode === "transferencia"
                      ? "border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-800 rounded-t-lg shadow-sm"
                      : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" /> Traspaso entre Cuentas Propias
                </button>
              </div>

              {/* Formulario Modo Directo */}
              {txMode === "directo" ? (
                <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                  {/* Selector de Cuenta */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="label-field mb-0">Cuenta Bancaria *</label>
                      {selectedAccount && (
                        <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                          Saldo actual: <strong className="text-gray-900 dark:text-white">{formatGs(currentSaldo)}</strong>
                        </span>
                      )}
                    </div>
                    <select
                      className="input-field text-xs"
                      value={txForm.bank_account_id}
                      onChange={e => setTxForm({ ...txForm, bank_account_id: e.target.value })}
                    >
                      <option value="">Seleccionar cuenta...</option>
                      {banks.map(b => (
                        <option key={b.id} value={b.id}>{formatBankLabel(b)}</option>
                      ))}
                    </select>
                  </div>

                  {/* Tipo de Operación: Botones Interactivos */}
                  <div>
                    <label className="label-field mb-1.5">Tipo de Operación *</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const newCat = ["transferencia_recibida", "deposito_caja", "deposito_efectivo", "liquidacion_tarjeta", "interes_ganado"].includes(txForm.categoria)
                            ? "comision_bancaria"
                            : txForm.categoria
                          setTxForm({ ...txForm, tipo: "debito", categoria: newCat })
                        }}
                        className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                          txForm.tipo === "debito"
                            ? "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 shadow-sm ring-1 ring-rose-500"
                            : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        <ArrowDownRight className="w-4 h-4 text-rose-600" />
                        - Egreso / Débito (Salida)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const newCat = ["comision_bancaria", "gasto_bancario", "transferencia_enviada", "pago_proveedor", "pago_servicio", "pago_prestamo", "pago_cheque", "retiro"].includes(txForm.categoria)
                            ? "transferencia_recibida"
                            : txForm.categoria
                          setTxForm({ ...txForm, tipo: "credito", categoria: newCat, tiene_comision: false })
                        }}
                        className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                          txForm.tipo === "credito"
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 shadow-sm ring-1 ring-emerald-500"
                            : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                        + Ingreso / Crédito (Entrada)
                      </button>
                    </div>
                  </div>

                  {/* Categoría Bancaria según Tipo */}
                  <div>
                    <label className="label-field mb-1">Categoría del Movimiento *</label>
                    <select
                      className="input-field text-xs"
                      value={txForm.categoria}
                      onChange={e => setTxForm({ ...txForm, categoria: e.target.value })}
                    >
                      {txForm.tipo === "debito" ? (
                        <>
                          <option value="comision_bancaria">Comisión bancaria (SIPAP, mantenimiento, chequeras)</option>
                          <option value="gasto_bancario">Gastos / Impuestos bancarios (IVA bancario, sellados)</option>
                          <option value="transferencia_enviada">Transferencia enviada (SIPAP a proveedores / terceros)</option>
                          <option value="pago_proveedor">Pago a proveedor directo</option>
                          <option value="pago_servicio">Pago de servicios (ANDE, Essap, Telefonía, Internet)</option>
                          <option value="pago_prestamo">Pago de cuota / amortización de préstamo</option>
                          <option value="retiro">Retiro en efectivo / caja de ventanilla</option>
                          <option value="otros">Otros egresos bancarios</option>
                        </>
                      ) : (
                        <>
                          <option value="transferencia_recibida">Transferencia recibida (SIPAP / clientes)</option>
                          <option value="deposito_caja">Depósito de recaudación de caja</option>
                          <option value="deposito_efectivo">Depósito en efectivo en ventanilla / buzón</option>
                          <option value="liquidacion_tarjeta">Liquidación POS / Tarjetas (Bancard, Dinelco, QR, PIX)</option>
                          <option value="interes_ganado">Intereses ganados / Rendimientos CDA</option>
                          <option value="otros">Otros créditos / ingresos</option>
                        </>
                      )}
                    </select>
                  </div>

                  {/* Monto y Fecha */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label-field mb-1">Monto de la Operación ({selectedAccount?.moneda || "Gs."}) *</label>
                      <CurrencyInput
                        currency={selectedAccount?.moneda === "USD" ? "USD" : "PYG"}
                        prefix={selectedAccount?.moneda === "USD" ? "US$" : "₲"}
                        placeholder={selectedAccount?.moneda === "USD" ? "0.00" : "0"}
                        className="input-field font-mono text-sm font-semibold text-right"
                        value={txForm.monto}
                        onChangeValue={(num) => setTxForm({ ...txForm, monto: String(num) })}
                      />
                      {montoOperacion > 0 && (
                        <p className="text-[11px] text-gray-500 font-mono mt-1 text-right">
                          {formatGs(montoOperacion)}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="label-field mb-1">Fecha de Operación *</label>
                      <input
                        type="date"
                        className="input-field text-xs"
                        value={txForm.fecha}
                        onChange={e => setTxForm({ ...txForm, fecha: e.target.value })}
                      />
                      <p className="text-[10px] text-gray-400 mt-1">Hora local de Asunción</p>
                    </div>
                  </div>

                  {/* Referencia y Contraparte */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label-field mb-1">N° Comprobante / Referencia</label>
                      <input
                        type="text"
                        placeholder="Ej: SIPAP-849201, TRF-0912"
                        className="input-field font-mono text-xs"
                        value={txForm.referencia}
                        onChange={e => setTxForm({ ...txForm, referencia: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="label-field mb-1">Contraparte / Beneficiario / Ordenante</label>
                      <input
                        type="text"
                        placeholder="Ej: Banco Itaú, Bancard, Proveedor SRL"
                        className="input-field text-xs"
                        value={txForm.contraparte}
                        onChange={e => setTxForm({ ...txForm, contraparte: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Concepto / Detalle */}
                  <div>
                    <label className="label-field mb-1">Concepto / Detalle del Movimiento</label>
                    <input
                      type="text"
                      placeholder="Ej: Pago de comisiones bancarias por transferencias interbancarias"
                      className="input-field text-xs"
                      value={txForm.descripcion}
                      onChange={e => setTxForm({ ...txForm, descripcion: e.target.value })}
                    />
                  </div>

                  {/* Opción Comisión Bancaria Asociada (Solo para Débitos) */}
                  {txForm.tipo === "debito" && (
                    <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-rose-900 dark:text-rose-200">
                        <input
                          type="checkbox"
                          checked={txForm.tiene_comision}
                          onChange={e => setTxForm({ ...txForm, tiene_comision: e.target.checked })}
                          className="rounded text-rose-600 focus:ring-rose-500"
                        />
                        <span>¿Registrar también comisión bancaria asociada? (ej: SIPAP 5.500 Gs.)</span>
                      </label>
                      {txForm.tiene_comision && (
                        <div className="pt-2 pl-6 flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="w-48">
                            <label className="text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider block mb-1">Monto Comisión (Gs.)</label>
                            <CurrencyInput
                              currency="PYG"
                              prefix="₲"
                              className="input-field text-xs font-mono font-bold text-right"
                              placeholder="5.500"
                              value={txForm.comision_adicional}
                              onChangeValue={(num) => setTxForm({ ...txForm, comision_adicional: String(num) })}
                            />
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 sm:mt-4">
                            Se creará automáticamente un segundo débito por comisión con la misma fecha y referencia.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Previsualización en Tiempo Real del Saldo */}
                  {selectedAccount && montoOperacion > 0 && (
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 dark:text-gray-400">Saldo actual:</span>
                        <strong className="text-gray-900 dark:text-white font-mono">{formatGs(currentSaldo)}</strong>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className={txForm.tipo === "credito" ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                          {txForm.tipo === "credito" ? `+ ${formatGs(montoOperacion)}` : `- ${formatGs(montoOperacion + comisionOperacion)}`}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-gray-500 dark:text-gray-400">Saldo resultante:</span>
                        <strong className={`font-bold ${saldoProyectado >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                          {formatGs(saldoProyectado)}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Formulario Modo Transferencia entre Cuentas Propias */
                <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                  {/* Selector Origen y Destino */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Origen */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="label-field mb-0 text-rose-700 dark:text-rose-400">Cuenta Origen (Débito -) *</label>
                      </div>
                      <select
                        className="input-field text-xs"
                        value={transferForm.origen_account_id}
                        onChange={e => setTransferForm({ ...transferForm, origen_account_id: e.target.value })}
                      >
                        <option value="">Seleccionar cuenta de débito...</option>
                        {banks.map(b => (
                          <option key={b.id} value={b.id}>{formatBankLabel(b)}</option>
                        ))}
                      </select>
                      {origenAccount && (
                        <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400 mt-1">
                          Saldo disp: <strong className="text-gray-900 dark:text-white">{formatGs(origenSaldoActual)}</strong>
                        </p>
                      )}
                    </div>

                    {/* Destino */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="label-field mb-0 text-emerald-700 dark:text-emerald-400">Cuenta Destino (Crédito +) *</label>
                      </div>
                      <select
                        className="input-field text-xs"
                        value={transferForm.destino_account_id}
                        onChange={e => setTransferForm({ ...transferForm, destino_account_id: e.target.value })}
                      >
                        <option value="">Seleccionar cuenta de crédito...</option>
                        {banks.map(b => (
                          <option key={b.id} value={b.id}>{formatBankLabel(b)}</option>
                        ))}
                      </select>
                      {destinoAccount && (
                        <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400 mt-1">
                          Saldo actual: <strong className="text-gray-900 dark:text-white">{formatGs(destinoSaldoActual)}</strong>
                        </p>
                      )}
                    </div>
                  </div>

                  {cuentasIguales && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>La cuenta de origen y la cuenta de destino no pueden ser la misma cuenta.</span>
                    </div>
                  )}

                  {/* Monto y Fecha */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label-field mb-1">Monto a Transferir ({origenAccount?.moneda || "Gs."}) *</label>
                      <CurrencyInput
                        currency={origenAccount?.moneda === "USD" ? "USD" : "PYG"}
                        prefix={origenAccount?.moneda === "USD" ? "US$" : "₲"}
                        placeholder={origenAccount?.moneda === "USD" ? "0.00" : "0"}
                        className="input-field font-mono text-sm font-semibold text-right"
                        value={transferForm.monto}
                        onChangeValue={(num) => setTransferForm({ ...transferForm, monto: String(num) })}
                      />
                      {montoTrf > 0 && (
                        <p className="text-[11px] text-gray-500 font-mono mt-1 text-right">
                          {formatGs(montoTrf)}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="label-field mb-1">Fecha de la Transferencia *</label>
                      <input
                        type="date"
                        className="input-field text-xs"
                        value={transferForm.fecha}
                        onChange={e => setTransferForm({ ...transferForm, fecha: e.target.value })}
                      />
                      <p className="text-[10px] text-gray-400 mt-1">Hora local de Asunción</p>
                    </div>
                  </div>

                  {/* Comisión y Referencia */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label-field mb-1">Comisión Bancaria al Origen (Gs.) [Opcional]</label>
                      <CurrencyInput
                        currency="PYG"
                        prefix="₲"
                        placeholder="Ej: 5.500"
                        className="input-field font-mono text-xs text-right"
                        value={transferForm.comision}
                        onChangeValue={(num) => setTransferForm({ ...transferForm, comision: String(num) })}
                      />
                      <p className="text-[10px] text-gray-400 mt-1">Se debita del saldo de la cuenta origen</p>
                    </div>

                    <div>
                      <label className="label-field mb-1">N° Comprobante / Referencia SIPAP</label>
                      <input
                        type="text"
                        placeholder="Ej: TRF-INT-004812"
                        className="input-field font-mono text-xs"
                        value={transferForm.referencia}
                        onChange={e => setTransferForm({ ...transferForm, referencia: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Concepto / Motivo */}
                  <div>
                    <label className="label-field mb-1">Motivo / Descripción de la Transferencia</label>
                    <input
                      type="text"
                      placeholder="Ej: Cobertura de cuenta corriente para pago de cheques a proveedores"
                      className="input-field text-xs"
                      value={transferForm.descripcion}
                      onChange={e => setTransferForm({ ...transferForm, descripcion: e.target.value })}
                    />
                  </div>

                  {/* Previsualización de Ambos Saldos */}
                  {origenAccount && destinoAccount && montoTrf > 0 && !cuentasIguales && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                      <div className="font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-[10px]">
                        Impacto Contable Simulado:
                      </div>
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-gray-600 dark:text-gray-300">
                          {origenAccount.banco} ({origenAccount.numero_cuenta}):
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-rose-600 font-bold">- {formatGs(montoTrf + comisionTrf)}</span>
                          <ArrowRight className="w-3 h-3 text-gray-400" />
                          <strong className={origenSaldoProyectado >= 0 ? "text-gray-900 dark:text-white" : "text-rose-600"}>
                            {formatGs(origenSaldoProyectado)}
                          </strong>
                        </div>
                      </div>
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-gray-600 dark:text-gray-300">
                          {destinoAccount.banco} ({destinoAccount.numero_cuenta}):
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-600 font-bold">+ {formatGs(montoTrf)}</span>
                          <ArrowRight className="w-3 h-3 text-gray-400" />
                          <strong className="text-emerald-600">
                            {formatGs(destinoSaldoProyectado)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Footer de Acciones */}
              <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-3 bg-gray-50/50 dark:bg-slate-850">
                <button
                  type="button"
                  onClick={() => setShowTxModal(false)}
                  className="btn-ghost text-xs"
                >
                  Cancelar
                </button>
                {txMode === "directo" ? (
                  <button
                    type="button"
                    onClick={handleSaveBankTransaction}
                    disabled={submittingTx || !txForm.bank_account_id || !txForm.monto || Number(txForm.monto) <= 0}
                    className="btn-primary text-xs flex items-center gap-2 disabled:opacity-50"
                  >
                    {submittingTx ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Confirmar Movimiento
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveBankTransfer}
                    disabled={
                      submittingTx ||
                      !transferForm.origen_account_id ||
                      !transferForm.destino_account_id ||
                      cuentasIguales ||
                      !transferForm.monto ||
                      Number(transferForm.monto) <= 0
                    }
                    className="btn-primary text-xs flex items-center gap-2 disabled:opacity-50"
                  >
                    {submittingTx ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
                    Confirmar Transferencia
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* MODAL: Historial del Cheque */}
      {chequeHistorial && (
        <div className="modal-overlay" onClick={() => setChequeHistorial(null)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Trazabilidad del Cheque</h3>
              <p className="text-xs text-gray-500 mt-0.5">N° {chequeHistorial.cheque.numero} — {chequeHistorial.cheque.beneficiario}</p>
            </div>
            <div className="p-6 space-y-3 max-h-80 overflow-y-auto">
              {chequeHistorial.items.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">Sin movimientos registrados</p>
              ) : (
                chequeHistorial.items.map((h: any, idx: number) => (
                  <div key={h.id || idx} className="p-3 rounded-lg border bg-gray-50 dark:bg-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-gray-900 dark:text-white capitalize">
                        {h.estado_anterior ? `${h.estado_anterior} → ${h.estado_nuevo}` : h.estado_nuevo}
                      </span>
                      <span className="text-gray-400 text-[11px]">
                        {h.created_at ? new Date(h.created_at).toLocaleString("es-PY") : ""}
                      </span>
                    </div>
                    {h.user_nombre && <div className="text-[11px] text-primary">Por: {h.user_nombre}</div>}
                    {h.notas && <div className="text-xs text-gray-600 dark:text-gray-300">{h.notas}</div>}
                  </div>
                ))
              )}
            </div>
            <div className="p-6 border-t flex justify-end">
              <button onClick={() => setChequeHistorial(null)} className="btn-outline text-xs">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Depósito Bancario */}
      {showDepositModal && (() => {
        const destAccount = banks.find(b => b.id === depositForm.bank_account_id)
        const montoNum = Number(depositForm.monto) || 0

        const handleDeposit = async () => {
          if (!depositForm.bank_account_id || !depositForm.monto || montoNum <= 0) {
            toast.error("Campos requeridos", "Seleccioná una cuenta e ingresá un monto válido")
            return
          }
          if (depositMode === "boveda" && !depositForm.numero_boleta.trim()) {
            toast.error("N° de boleta requerido", "Ingresá el número de boleta del depósito bancario")
            return
          }
          setSubmittingDeposit(true)
          try {
            if (depositMode === "boveda") {
              await api.vault.depositAmountToBank({
                monto_pyg: montoNum,
                bank_account_id: depositForm.bank_account_id,
                numero_boleta: depositForm.numero_boleta.trim(),
                transportadora: depositForm.transportadora || undefined,
                fecha_deposito: depositForm.fecha_deposito || undefined,
                observaciones: depositForm.observaciones?.trim() || undefined,
              })
              toast.success("Depósito registrado", `Gs. ${montoNum.toLocaleString("es-PY")} depositados desde Bóveda`)
            } else {
              await api.financial.banks.createTransaction(depositForm.bank_account_id, {
                tipo: "credito",
                categoria: depositForm.categoria_ext,
                monto: montoNum,
                fecha: depositForm.fecha_deposito,
                referencia: depositForm.referencia_ext?.trim() || undefined,
                contraparte: depositForm.contraparte_ext?.trim() || undefined,
                descripcion: depositForm.descripcion_ext?.trim() || undefined,
              })
              toast.success("Depósito externo registrado", `Gs. ${montoNum.toLocaleString("es-PY")} acreditados en ${destAccount?.banco || "cuenta"}`)
            }
            setShowDepositModal(false)
            fetchAll()
          } catch (err: any) {
            toast.error("Error", err?.response?.data?.detail || err?.message || "No se pudo registrar el depósito")
          } finally {
            setSubmittingDeposit(false)
          }
        }

        return (
          <div className="modal-overlay" onClick={() => setShowDepositModal(false)}>
            <div className="modal-content max-w-2xl p-0 overflow-hidden shadow-2xl rounded-2xl border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-sky-500/10 via-sky-500/5 to-transparent dark:from-sky-950/40 dark:via-sky-950/20">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">Depósito Bancario</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300">
                        Extra Supermercado
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      Registro oficial de acreditaciones y remesas a cuentas comerciales
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Selector de Modo (Tabs modernas) */}
              <div className="grid grid-cols-2 p-1.5 bg-gray-100/70 dark:bg-slate-800/60 border-b border-gray-200 dark:border-gray-800 gap-1.5">
                <button
                  type="button"
                  onClick={() => setDepositMode("boveda")}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                    depositMode === "boveda"
                      ? "bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-300 shadow-sm border border-sky-200 dark:border-sky-800/80"
                      : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-white/40 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>Remesa desde Bóveda Central</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDepositMode("externo")}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                    depositMode === "externo"
                      ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-sm border border-emerald-200 dark:border-emerald-800/80"
                      : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-white/40 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <ArrowDownRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Depósito Externo / Recibido</span>
                </button>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto max-h-[72vh]">
                {/* Banner Contextual del Modo */}
                {depositMode === "boveda" ? (
                  <div className="p-3.5 rounded-2xl bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-400 mt-0.5">
                        <Landmark className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-sky-900 dark:text-sky-200">Remesa de Efectivo a Banco</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-200/70 dark:bg-sky-900 text-sky-800 dark:text-sky-300 font-semibold">
                            Custodia Bóveda
                          </span>
                        </div>
                        <p className="text-[11px] text-sky-700/80 dark:text-sky-300/80 mt-0.5">
                          El importe se debitará de <strong>Bóveda Central</strong> y se acreditará inmediatamente en la cuenta bancaria.
                        </p>
                      </div>
                    </div>
                    {depositVaultBalance !== null && (
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-sky-200/60 dark:border-sky-800/60 shrink-0">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-sky-700 dark:text-sky-400">Saldo en Bóveda</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black font-mono text-sky-950 dark:text-sky-100">
                            Gs. {depositVaultBalance.toLocaleString("es-PY")}
                          </span>
                          {depositVaultBalance > 0 && (
                            <button
                              type="button"
                              onClick={() => setDepositForm(f => ({ ...f, monto: String(depositVaultBalance) }))}
                              className="px-2 py-0.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px] transition shadow-xs"
                            >
                              Usar todo
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 flex items-start gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 mt-0.5">
                      <ArrowDownRight className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Acreditación Directa en Cuenta</span>
                      <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">
                        Registra fondos acreditados directamente en banco (cobranza, transferencias recibidas SIPAP, liquidaciones POS o depósitos en ventanilla).
                      </p>
                    </div>
                  </div>
                )}

                {/* BLOQUE 1: CUENTA DESTINO Y MONTO (Grid organizado) */}
                <div className="bg-slate-50/60 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                    1. Cuenta Bancaria Receptora y Monto
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                    {/* Cuenta Destino */}
                    <div className="md:col-span-7">
                      <label className="label-field mb-1">Cuenta Destino *</label>
                      <select
                        className="input-field text-xs font-medium"
                        value={depositForm.bank_account_id}
                        onChange={e => setDepositForm(f => ({ ...f, bank_account_id: e.target.value }))}
                      >
                        <option value="">— Seleccionar cuenta bancaria —</option>
                        {banks.map(b => (
                          <option key={b.id} value={b.id}>
                            {formatBankLabel(b)} · Saldo: Gs. {Number(b.saldo_actual || 0).toLocaleString("es-PY")}
                          </option>
                        ))}
                      </select>
                      {destAccount && (
                        <div className="mt-1.5 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 px-1">
                          <span>Titular: <strong>{destAccount.titular || "Extra Supermercado"}</strong></span>
                          <span className="font-mono">Saldo actual: <strong className="text-gray-800 dark:text-gray-200">Gs. {Number(destAccount.saldo_actual || 0).toLocaleString("es-PY")}</strong></span>
                        </div>
                      )}
                    </div>

                    {/* Monto con CurrencyInput canónico */}
                    <div className="md:col-span-5">
                      <label className="label-field mb-1">Monto del Depósito ({destAccount?.moneda || "PYG"}) *</label>
                      <CurrencyInput
                        currency={destAccount?.moneda === "USD" ? "USD" : "PYG"}
                        prefix={destAccount?.moneda === "USD" ? "US$" : "₲"}
                        placeholder={destAccount?.moneda === "USD" ? "0.00" : "0"}
                        value={depositForm.monto}
                        onChangeValue={(num) => setDepositForm(f => ({ ...f, monto: String(num) }))}
                        className="input-field font-mono text-base font-black text-right shadow-xs focus:ring-2 focus:ring-sky-500/20"
                      />
                      {montoNum > 0 && (
                        <p className="text-[11px] font-mono text-right text-sky-600 dark:text-sky-400 font-bold mt-1">
                          {destAccount?.moneda === "USD" ? `US$ ${montoNum.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : `Gs. ${montoNum.toLocaleString("es-PY")}`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Alerta si supera saldo en bóveda */}
                  {depositMode === "boveda" && depositVaultBalance !== null && montoNum > depositVaultBalance && (
                    <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-700 dark:text-rose-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>
                        <strong>Atención:</strong> El monto a depositar (Gs. {montoNum.toLocaleString("es-PY")}) supera el saldo disponible en Bóveda Central (Gs. {depositVaultBalance.toLocaleString("es-PY")}).
                      </span>
                    </div>
                  )}
                </div>

                {/* BLOQUE 2: DATOS DEL COMPROBANTE Y FECHA */}
                <div className="bg-slate-50/60 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    2. Comprobante, Fecha y Logística
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Fecha de Depósito */}
                    <div>
                      <label className="label-field mb-1">Fecha de Depósito *</label>
                      <input
                        type="date"
                        className="input-field text-xs font-mono"
                        value={depositForm.fecha_deposito}
                        onChange={e => setDepositForm(f => ({ ...f, fecha_deposito: e.target.value }))}
                      />
                      <p className="text-[10px] text-gray-400 mt-1">Hora local de Paraguay (Asunción)</p>
                    </div>

                    {/* N° Boleta / Referencia */}
                    <div>
                      <label className="label-field mb-1">
                        {depositMode === "boveda" ? "N° de Boleta de Depósito *" : "N° Boleta / Referencia Bancaria"}
                      </label>
                      <input
                        type="text"
                        className="input-field text-xs font-mono"
                        placeholder={depositMode === "boveda" ? "Ej: 00123456" : "Ej: TRF-091829 / Boleta 5678"}
                        value={depositMode === "boveda" ? depositForm.numero_boleta : depositForm.referencia_ext}
                        onChange={e => {
                          const val = e.target.value
                          setDepositForm(f => depositMode === "boveda" ? { ...f, numero_boleta: val } : { ...f, referencia_ext: val })
                        }}
                      />
                      <p className="text-[10px] text-gray-400 mt-1">
                        {depositMode === "boveda" ? "Número impreso en la boleta bancaria" : "Identificador o comprobante bancario"}
                      </p>
                    </div>

                    {/* Campos específicos según modo */}
                    {depositMode === "boveda" ? (
                      <>
                        <div>
                          <label className="label-field mb-1">Transportadora / Canal *</label>
                          <select
                            className="input-field text-xs"
                            value={depositForm.transportadora}
                            onChange={e => setDepositForm(f => ({ ...f, transportadora: e.target.value }))}
                          >
                            <option value="Prosegur">Prosegur (Camión de caudales)</option>
                            <option value="Yrendagüe">Yrendagüe (Transporte de caudales)</option>
                            <option value="Depósito en Ventanilla">Depósito Directo en Ventanilla / Sucursal</option>
                            <option value="Buzón 24hs">Buzón nocturno 24hs</option>
                            <option value="Otro">Otro canal</option>
                          </select>
                        </div>
                        <div>
                          <label className="label-field mb-1">Responsable / Custodio (Opcional)</label>
                          <input
                            type="text"
                            className="input-field text-xs"
                            placeholder="Ej: Guardián Prosegur / Juan Pérez"
                            value={depositForm.contraparte_ext}
                            onChange={e => setDepositForm(f => ({ ...f, contraparte_ext: e.target.value }))}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="label-field mb-1">Tipo de Ingreso *</label>
                          <select
                            className="input-field text-xs"
                            value={depositForm.categoria_ext}
                            onChange={e => setDepositForm(f => ({ ...f, categoria_ext: e.target.value }))}
                          >
                            <option value="deposito_efectivo">Depósito en efectivo (ventanilla / buzón)</option>
                            <option value="deposito_caja">Depósito de recaudación de caja</option>
                            <option value="transferencia_recibida">Transferencia recibida (SIPAP / Clientes)</option>
                            <option value="liquidacion_tarjeta">Liquidación POS / Tarjetas</option>
                            <option value="interes_ganado">Interés ganado / Rendimiento</option>
                            <option value="otros">Otros ingresos bancarios</option>
                          </select>
                        </div>
                        <div>
                          <label className="label-field mb-1">Origen / Depositante / Contraparte</label>
                          <input
                            type="text"
                            className="input-field text-xs"
                            placeholder="Ej: Cliente Mayorista, Dinelco, Bancard..."
                            value={depositForm.contraparte_ext}
                            onChange={e => setDepositForm(f => ({ ...f, contraparte_ext: e.target.value }))}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Observaciones / Notas */}
                  <div>
                    <label className="label-field mb-1">
                      {depositMode === "boveda" ? "Observaciones (Opcional)" : "Descripción / Detalle (Opcional)"}
                    </label>
                    <textarea
                      className="input-field text-xs h-16 resize-none"
                      placeholder={depositMode === "boveda" ? "Notas adicionales sobre la remesa de caudales..." : "Detalle conceptual del depósito recibido..."}
                      value={depositMode === "boveda" ? depositForm.observaciones : depositForm.descripcion_ext}
                      onChange={e => {
                        const val = e.target.value
                        setDepositForm(f => depositMode === "boveda" ? { ...f, observaciones: val } : { ...f, descripcion_ext: val })
                      }}
                    />
                  </div>
                </div>

                {/* BLOQUE 3: PREVIEW DE IMPACTO FINANCIERO (Fintech Style) */}
                {destAccount && montoNum > 0 && (
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-950/40 dark:via-emerald-950/20 border border-emerald-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        Impacto Financiero Proyectado
                      </span>
                      <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full font-bold">
                        {destAccount.banco} ({destAccount.moneda})
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40 text-center">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold block">Saldo Actual Cuenta</span>
                        <span className="text-xs font-bold font-mono text-gray-800 dark:text-gray-200">
                          Gs. {Number(destAccount.saldo_actual || 0).toLocaleString("es-PY")}
                        </span>
                      </div>
                      <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-emerald-300/80 dark:border-emerald-700/60 text-center ring-1 ring-emerald-500/20">
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">+ Depósito a Acreditar</span>
                        <span className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400">
                          + Gs. {montoNum.toLocaleString("es-PY")}
                        </span>
                      </div>
                      <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-emerald-400/80 dark:border-emerald-600/60 text-center shadow-xs">
                        <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-extrabold block">= Saldo Proyectado</span>
                        <span className="text-xs font-black font-mono text-emerald-700 dark:text-emerald-300">
                          Gs. {(Number(destAccount.saldo_actual || 0) + montoNum).toLocaleString("es-PY")}
                        </span>
                      </div>
                    </div>

                    {depositMode === "boveda" && depositVaultBalance !== null && (
                      <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300 font-mono">
                        <span>Remanente Bóveda Central:</span>
                        <span className={`font-bold ${depositVaultBalance - montoNum < 0 ? "text-rose-600 dark:text-rose-400" : "text-gray-800 dark:text-gray-200"}`}>
                          Gs. {Math.max(0, depositVaultBalance - montoNum).toLocaleString("es-PY")}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/70 dark:bg-slate-900/50">
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  disabled={submittingDeposit}
                  className="btn-outline text-xs px-4 py-2"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeposit}
                  disabled={
                    submittingDeposit ||
                    !depositForm.bank_account_id ||
                    montoNum <= 0 ||
                    (depositMode === "boveda" && !depositForm.numero_boleta.trim())
                  }
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
                >
                  {submittingDeposit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Procesando...</span>
                    </>
                  ) : (
                    <>
                      <Building2 className="w-4 h-4" />
                      <span>
                        {depositMode === "boveda"
                          ? `Registrar Depósito desde Bóveda ${montoNum > 0 ? `(Gs. ${montoNum.toLocaleString("es-PY")})` : ""}`
                          : `Registrar Depósito Externo ${montoNum > 0 ? `(Gs. ${montoNum.toLocaleString("es-PY")})` : ""}`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
