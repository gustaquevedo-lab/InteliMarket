import { useState, useEffect, useCallback } from "react"
import { Search, Pill, Thermometer, AlertTriangle, FileText, Beaker, Plus, Minus, Trash2, CreditCard, Banknote, Send, X, Loader2, User, ArrowRightLeft, AlertCircle, CheckCircle2, Building2, Stethoscope, RefreshCw } from "lucide-react"
import { pharmaApi, type PharmaMedication, type PharmaActiveIngredient, type PharmaInsuranceCoverage, type PharmaPrescription } from "../../api/pharma"
import { api, type Customer } from "../../api"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"

interface CartItem {
  medication: PharmaMedication
  quantity: number
  precio: number
  obra_social: string | null
  copago: number | null
  prescription_id: string | null
}

export default function PharmaPOSPage() {
  const [search, setSearch] = useState("")
  const [ingredients, setIngredients] = useState<PharmaActiveIngredient[]>([])
  const [selectedIngredient, setSelectedIngredient] = useState<PharmaActiveIngredient | null>(null)
  const [medications, setMedications] = useState<PharmaMedication[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState("")
  const [showCustomerSelect, setShowCustomerSelect] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState("efectivo")
  const [prescriptions, setPrescriptions] = useState<PharmaPrescription[]>([])
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false)
  const [prescriptionSearch, setPrescriptionSearch] = useState("")
  const [expirationAlerts, setExpirationAlerts] = useState<number>(0)
  const [expirationCriticals, setExpirationCriticals] = useState<number>(0)
  const [stats, setStats] = useState<{ total_medications: number; total_genericos: number; total_controlados: number; total_cadena_frio: number; vencidos_sin_resolver: number; criticos_sin_resolver: number } | null>(null)
  const toast = useToast()

  useEffect(() => {
    pharmaApi.activeIngredients.list().then(setIngredients).catch(() => {})
    api.customers.list({ activo: true }).then(setCustomers).catch(() => {})
    pharmaApi.stats.get().then(setStats).catch(() => {})
    pharmaApi.expirationAlerts.list({ resueltos: false }).then(alerts => {
      setExpirationAlerts(alerts.filter(a => a.alerta_tipo === "proximo").length)
      setExpirationCriticals(alerts.filter(a => a.alerta_tipo === "critico" || a.alerta_tipo === "vencido").length)
    }).catch(() => {})
  }, [])

  const handleSearch = async () => {
    if (!search.trim()) return
    setLoading(true)
    try {
      const found = ingredients.filter(i =>
        i.nombre.toLowerCase().includes(search.toLowerCase()) ||
        (i.nombre_comun || "").toLowerCase().includes(search.toLowerCase()) ||
        (i.categoria || "").toLowerCase().includes(search.toLowerCase())
      )
      if (found.length > 0) {
        setSelectedIngredient(found[0])
        const meds = await pharmaApi.medications.byActiveIngredient(found[0].id)
        setMedications(meds)
      } else {
        const meds = await pharmaApi.medications.list({ search, limit: 50 })
        if (meds.length > 0) {
          setSelectedIngredient(null)
          setMedications(meds)
        } else {
          toast.warning("Sin resultados", "No se encontraron medicamentos")
          setMedications([])
        }
      }
    } catch {
      toast.error("Error", "Error en la búsqueda")
    } finally {
      setLoading(false)
    }
  }

  const selectIngredient = async (ing: PharmaActiveIngredient) => {
    setSelectedIngredient(ing)
    setLoading(true)
    try {
      const meds = await pharmaApi.medications.byActiveIngredient(ing.id)
      setMedications(meds)
    } catch {
      toast.error("Error", "Error al cargar medicamentos")
    } finally {
      setLoading(false)
    }
  }

  const addToCart = async (med: PharmaMedication) => {
    const existing = cart.find(i => i.medication.id === med.id)
    if (existing) {
      setCart(prev => prev.map(i => i.medication.id === med.id ? { ...i, quantity: i.quantity + 1 } : i))
      toast.success(med.marca_comercial || "Medicamento", "Cantidad aumentada")
      return
    }

    const item: CartItem = {
      medication: med,
      quantity: 1,
      precio: 0,
      obra_social: null,
      copago: null,
      prescription_id: null,
    }

    if (med.es_controlado && selectedCustomer) {
      try {
        const rx = await pharmaApi.prescriptions.list({ customer_id: selectedCustomer.id, estado: "pending" })
        if (rx.length > 0) item.prescription_id = rx[0].id
      } catch {}
    }

    setCart(prev => [...prev, item])
    toast.success(med.marca_comercial || "Medicamento", "Agregado al carrito")
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => {
      const item = prev.find(i => i.medication.id === id)
      if (!item) return prev
      const newQty = item.quantity + delta
      if (newQty <= 0) return prev.filter(i => i.medication.id !== id)
      return prev.map(i => i.medication.id === id ? { ...i, quantity: newQty } : i)
    })
  }

  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.medication.id !== id))

  const updatePrice = (id: string, price: number) => {
    setCart(prev => prev.map(i => i.medication.id === id ? { ...i, precio: price } : i))
  }

  const checkInsurance = async (medication_id: string, obra_social: string) => {
    const item = cart.find(i => i.medication.id === medication_id)
    if (!item) return
    try {
      const result = await pharmaApi.insurance.calculatePrice({
        medication_id,
        obra_social,
        precio_base: item.precio,
      })
      setCart(prev => prev.map(i =>
        i.medication.id === medication_id
          ? { ...i, obra_social, copago: result.copago }
          : i
      ))
      toast.success("Cobertura", `Obra social cubre ${result.cobertura_pct}%`)
    } catch {
      toast.error("Error", "No se pudo calcular cobertura")
    }
  }

  const suggestSubstitute = async (med: PharmaMedication) => {
    if (med.es_generico) {
      toast.info("Es genérico", "Este medicamento ya es genérico")
      return
    }
    try {
      const sub = await pharmaApi.medications.genericSubstitute(med.id)
      if (sub) {
        toast.info("Sustituto disponible", `${sub.marca_comercial || "Genérico"} - ${sub.concentracion} (${sub.laboratorio})`)
      } else {
        toast.info("Sin sustituto", "No hay equivalente genérico registrado")
      }
    } catch {
      toast.error("Error", "Error al buscar sustituto")
    }
  }

  const filteredCustomers = customers.filter(c =>
    !customerSearch || (c.razon_social || "").toLowerCase().includes(customerSearch.toLowerCase()) || (c.ruc?.includes(customerSearch) ?? false) || (c.ci?.includes(customerSearch) ?? false)
  )

  const subtotal = cart.reduce((sum, i) => sum + (i.copago ?? i.precio) * i.quantity, 0)
  const total = subtotal

  const handlePay = async () => {
    if (cart.length === 0) { toast.error("Error", "Carrito vacío"); return }
    if (!selectedCustomer) { toast.error("Error", "Seleccioná un cliente"); return }
    setSubmitting(true)
    try {
      const result = await api.sales.create({
        customer_id: selectedCustomer.id,
        condicion: "contado",
        items: cart.map(i => ({
          product_id: i.medication.product_id,
          cantidad: i.quantity,
          precio_unitario: i.copago ?? i.precio,
        })),
      })

      for (const item of cart) {
        if (item.medication.es_controlado) {
          await pharmaApi.controlledLogs.create({
            medication_id: item.medication.id,
            product_id: item.medication.product_id,
            cantidad: item.quantity,
            tipo_movimiento: "salida",
            patient_nombre: selectedCustomer.razon_social,
            patient_ci: selectedCustomer.ci || selectedCustomer.ruc,
            receta_numero: item.prescription_id || undefined,
          }).catch(() => {})
        }
        if (item.prescription_id) {
          await pharmaApi.prescriptions.dispense(item.prescription_id, (result as any).id || "").catch(() => {})
        }
      }

      toast.success("Venta completada", `${formatPYG(total)} - ${paymentMethod}`)
      setCart([])
      setShowPayment(false)
    } catch {
      toast.error("Error", "No se pudo procesar la venta")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] gap-4">
      {/* Expiration alerts banner */}
      {(expirationCriticals > 0 || expirationAlerts > 0) && (
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2 text-amber-700 dark:text-amber-400">
          {expirationCriticals > 0 ? <AlertCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span className="text-sm font-bold">Alertas de vencimiento</span>
          {expirationCriticals > 0 && <span className="text-xs bg-red-100 dark:bg-red-800 px-2 py-0.5 rounded-full">{expirationCriticals} críticas</span>}
          {expirationAlerts > 0 && <span className="text-xs bg-amber-100 dark:bg-amber-800 px-2 py-0.5 rounded-full">{expirationAlerts} próximas</span>}
        </div>
      )}

      <div className="flex gap-4 flex-1">
        {/* Left: Products */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Stats row */}
          {stats && (
            <div className="flex gap-2 text-xs text-gray-500">
              <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{stats.total_medications} medicamentos</span>
              <span className="bg-green-100 dark:bg-green-900/20 text-green-600 px-2 py-1 rounded">{stats.total_genericos} genéricos</span>
              <span className="bg-red-100 dark:bg-red-900/20 text-red-600 px-2 py-1 rounded">{stats.total_controlados} controlados</span>
              <span className="bg-blue-100 dark:bg-blue-900/20 text-blue-600 px-2 py-1 rounded">{stats.total_cadena_frio} cadena frío</span>
            </div>
          )}

          {/* Search */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                className="input-field pl-10"
                placeholder="Buscar por principio activo o medicamento..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
              />
            </div>
            <button onClick={handleSearch} disabled={loading} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
            </button>
            <button onClick={() => setShowCustomerSelect(true)} className="btn-outline flex items-center gap-2 text-sm">
              <User className="w-4 h-4" />
              {selectedCustomer ? selectedCustomer.razon_social : "Cliente"}
            </button>
          </div>

          {/* Ingredient quick pills */}
          {ingredients.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {ingredients.slice(0, 20).map(ing => (
                <button
                  key={ing.id}
                  onClick={() => selectIngredient(ing)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${selectedIngredient?.id === ing.id ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200"}`}
                >
                  <Beaker className="w-3 h-3 inline mr-1" />
                  {ing.nombre}
                </button>
              ))}
            </div>
          )}

          {/* Results grid */}
          <div className="flex-1 overflow-y-auto">
            {selectedIngredient && (
              <div className="card p-3 mb-3">
                <div className="flex items-center gap-2">
                  <Beaker className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-gray-900 dark:text-white">{selectedIngredient.nombre}</span>
                  {selectedIngredient.nombre_comun && <span className="text-xs text-gray-500">DCI: {selectedIngredient.nombre_comun}</span>}
                  {selectedIngredient.categoria && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{selectedIngredient.categoria}</span>}
                  {selectedIngredient.requiere_receta && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1"><FileText className="w-3 h-3" /> Rx</span>}
                </div>
              </div>
            )}
            {medications.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {medications.map(med => (
                  <div key={med.id} className="card p-4 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate">{med.marca_comercial || "Genérico"}</h4>
                        <p className="text-xs text-gray-500">{med.concentracion} • {med.forma_farmaceutica}</p>
                        <p className="text-xs text-gray-400">{med.laboratorio || ""}</p>
                      </div>
                      <div className="flex flex-wrap gap-1 ml-2">
                        {med.es_generico && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Gen</span>}
                        {med.es_controlado && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">Ctrl</span>}
                        {med.requiere_cadena_frio && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium"><Thermometer className="w-2.5 h-2.5 inline" /></span>}
                        {med.necesita_autorizacion_obra_social && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">OS</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <button onClick={() => addToCart(med)} className="flex-1 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
                        <Plus className="w-3.5 h-3.5 inline mr-1" />Agregar
                      </button>
                      {!med.es_generico && (
                        <button onClick={() => suggestSubstitute(med)} className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 hover:text-primary hover:bg-primary/10 transition-colors" title="Ver sustituto genérico">
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              !loading && <div className="flex flex-col items-center justify-center py-20 text-gray-400"><Pill className="w-12 h-12 mb-3" /><p className="text-sm font-bold">Buscar medicamentos</p><p className="text-xs mt-1">Ingresá un principio activo o nombre de medicamento</p></div>
            )}
          </div>
        </div>

        {/* Right: Cart */}
        <div className="w-96 card flex flex-col">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Carrito ({cart.reduce((a, i) => a + i.quantity, 0)})</h2>
              <div className="flex items-center gap-2">
                {selectedCustomer && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-bold truncate max-w-28">{selectedCustomer.razon_social}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Pill className="w-10 h-10 mb-3" />
                <p className="text-sm font-bold">Carrito vacío</p>
                <p className="text-xs mt-1">Agregá medicamentos para comenzar</p>
              </div>
            ) : cart.map(item => (
              <div key={item.medication.id} className="flex flex-col gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{item.medication.marca_comercial || "Genérico"}</p>
                    <p className="text-xs text-gray-500">{item.medication.concentracion} - {item.medication.forma_farmaceutica}</p>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {item.medication.es_controlado && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">Rx retención</span>}
                    {item.copago !== null && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">Copago</span>}
                    <button onClick={() => removeFromCart(item.medication.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQuantity(item.medication.id, -1)} className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300"><Minus className="w-3 h-3" /></button>
                    <span className="w-7 text-center text-sm font-bold font-mono">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.medication.id, 1)} className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300"><Plus className="w-3 h-3" /></button>
                  </div>
                  <input type="number" className="input-field text-sm w-24 text-right font-mono" placeholder="Precio" value={item.precio || ""} onChange={e => updatePrice(item.medication.id, parseFloat(e.target.value) || 0)} />
                  <span className="text-sm font-bold font-mono w-20 text-right">{formatPYG((item.copago ?? item.precio) * item.quantity)}</span>
                </div>
                {item.copago !== null && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-purple-600 font-medium">Copago: {formatPYG(item.copago)}</span>
                    <span className="text-gray-400">|</span>
                    <span className="text-green-600">OS cubre {item.precio > 0 ? Math.round((1 - item.copago / item.precio) * 100) : 0}%</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
            <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white">
              <span>Total</span>
              <span className="font-mono">{formatPYG(total)}</span>
            </div>

            {cart.length > 0 && (
              <div className="flex gap-2">
                <select
                  className="input-field flex-1 text-sm"
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="credito">Crédito</option>
                </select>
                <button onClick={() => setShowPayment(true)} className="btn-primary flex-1 text-sm font-bold">
                  <CreditCard className="w-4 h-4 inline mr-1" />
                  Cobrar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Customer Select Modal */}
      {showCustomerSelect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCustomerSelect(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Seleccionar paciente</h3>
              <button onClick={() => setShowCustomerSelect(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <input className="input-field mb-4" placeholder="Buscar por nombre, RUC o CI..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
            <div className="flex-1 overflow-y-auto space-y-2">
              <button onClick={() => { setSelectedCustomer(null); setShowCustomerSelect(false) }} className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <p className="text-sm font-bold text-gray-500">Cliente genérico</p>
              </button>
              {filteredCustomers.map(c => (
                <button key={c.id} onClick={() => { setSelectedCustomer(c); setShowCustomerSelect(false); }} className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{c.razon_social}</p>
                  <p className="text-xs text-gray-500">{c.ruc || c.ci || "Sin documento"}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowPayment(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Confirmar venta
              </h3>
              <button onClick={() => setShowPayment(false)} className="btn-ghost"><X className="w-4 h-4" /></button>
            </div>
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">Total a cobrar</p>
              <p className="text-lg sm:text-xl xl:text-xl 2xl:text-2xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white mt-1">{formatPYG(total)}</p>
              <p className="text-sm text-primary mt-2 capitalize">Método: {paymentMethod}</p>
              {selectedCustomer && <p className="text-xs text-gray-400 mt-1">Cliente: {selectedCustomer.razon_social}</p>}
            </div>
            {cart.some(i => i.medication.es_controlado) && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs text-red-600 flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4" />
                Medicamento(s) controlado(s) — se registrará en el libro DINALFA
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <button className="btn-outline flex-1" onClick={() => setShowPayment(false)}>Cancelar</button>
              <button className="btn-primary flex-1" onClick={handlePay} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : `Cobrar ${formatPYG(total)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
