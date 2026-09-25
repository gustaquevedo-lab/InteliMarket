import React, { useState, useEffect, useMemo, useRef } from "react"
import {
  X, Plus, Trash2, Building, Receipt, FileText, Banknote, Landmark,
  ShieldCheck, AlertCircle, CheckCircle2, ChevronDown, User, DollarSign,
  Search, Loader2, Sparkles, Check
} from "lucide-react"
import { api, type Customer, type Sale } from "../../api"
import { useToast } from "../../context/ToastContext"
import { useAuth } from "../../context/AuthContext"
import CurrencyInput from "../../components/CurrencyInput"
import { formatPYG } from "../../utils/format"

interface FacturaItemRow {
  id: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  iva_tasa: 0 | 5 | 10
}

interface EmitirFacturaAdminModalProps {
  onClose: () => void
  onSuccess: (newSale: Sale, customerData?: Customer | null) => void
}

export default function EmitirFacturaAdminModal({ onClose, onSuccess }: EmitirFacturaAdminModalProps) {
  const { user } = useAuth()
  const toast = useToast()

  // ── ESTADO DEL CLIENTE (ASUME SIEMPRE LO CARGADO) ──
  const [customerSearch, setCustomerSearch] = useState("")
  const [searchingCustomers, setSearchingCustomers] = useState(false)
  const [searchResults, setSearchResults] = useState<Customer[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)

  // Campos reales editables que SIEMPRE se emiten
  const [ruc, setRuc] = useState("")
  const [razonSocial, setRazonSocial] = useState("")
  const [direccion, setDireccion] = useState("")
  const [telefono, setTelefono] = useState("")
  const [lookingUpRuc, setLookingUpRuc] = useState(false)

  // Cabecera Factura
  const [condicion, setCondicion] = useState<"contado" | "credito">("contado")
  const [observaciones, setObservaciones] = useState("")

  // Ítems de la factura (Texto libre)
  const [items, setItems] = useState<FacturaItemRow[]>([
    {
      id: "item-1",
      descripcion: "",
      cantidad: 1,
      precio_unitario: 0,
      iva_tasa: 0, // Exentas por defecto para convenios / educación, o 10%
    }
  ])

  // Forma de Pago y Destino de los fondos
  const [formaPago, setFormaPago] = useState<string>("EFECTIVO")
  const [destinoPago, setDestinoPago] = useState<"boveda" | "deposito" | "transferencia" | "otro">("boveda")
  const [destinoReferencia, setDestinoReferencia] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  // Cierre de dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // ── BÚSQUEDA EN VIVO CONTRA LA BASE DE DATOS DE CLIENTES ──
  useEffect(() => {
    if (!customerSearch.trim() || customerSearch.length < 2) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }

    const timer = setTimeout(async () => {
      setSearchingCustomers(true)
      try {
        const results = await api.customers.list({ search: customerSearch.trim(), limit: 15 })
        if (Array.isArray(results)) {
          setSearchResults(results)
          setShowDropdown(results.length > 0)
        }
      } catch (err) {
        console.warn("Error en búsqueda en vivo de clientes:", err)
      } finally {
        setSearchingCustomers(false)
      }
    }, 280)

    return () => clearTimeout(timer)
  }, [customerSearch])

  // Seleccionar un cliente de la lista de base de datos
  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomerId(c.id)
    setRuc(c.ruc || c.ci || "")
    setRazonSocial(c.razon_social || c.nombre || "")
    setDireccion(c.direccion || "")
    setTelefono(c.telefono || "")
    setShowDropdown(false)
    setCustomerSearch("")
    toast.info("Cliente Seleccionado", `${c.razon_social || c.nombre} (RUC: ${c.ruc})`)
  }

  // Consulta automática en padrón DNIT / Base Interna por RUC
  const handleLookupRuc = async () => {
    const doc = ruc.trim()
    if (!doc) {
      toast.warning("RUC requerido", "Ingresá un RUC o CI para buscar en el padrón oficial.")
      return
    }

    setLookingUpRuc(true)
    try {
      const res = await api.customers.lookupRuc(doc)
      if (res) {
        if (res.ruc) setRuc(res.ruc)
        if (res.razon_social || res.nombre) setRazonSocial(res.razon_social || res.nombre)
        if (res.telefono) setTelefono(res.telefono)
        toast.success(
          res.encontrado_en_db ? "Cliente en Base Interna" : "Padrón DNIT Identificado",
          `${res.razon_social || res.nombre} (DV: ${res.dv || ""})`
        )
      }
    } catch (err: any) {
      console.warn("No se pudo resolver RUC:", err)
      toast.warning("Búsqueda RUC", "No se encontró coincidencia automática. Podés cargar la razón social manualmente.")
    } finally {
      setLookingUpRuc(false)
    }
  }

  // Handlers para ítems
  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        descripcion: "",
        cantidad: 1,
        precio_unitario: 0,
        iva_tasa: 0,
      }
    ])
  }

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.warning("Atención", "La factura debe contener al menos un ítem.")
      return
    }
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpdateItem = (index: number, field: keyof FacturaItemRow, value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value }
      }
      return item
    }))
  }

  // Cálculos de liquidación oficial paraguaya (IVA incluido en el precio)
  const calculation = useMemo(() => {
    let totalExenta = 0
    let total5 = 0
    let total10 = 0
    let totalFactura = 0

    items.forEach(it => {
      const cant = Number(it.cantidad || 0)
      const pu = Number(it.precio_unitario || 0)
      const subtotalLinea = Math.round(cant * pu)
      totalFactura += subtotalLinea

      if (it.iva_tasa === 0) {
        totalExenta += subtotalLinea
      } else if (it.iva_tasa === 5) {
        total5 += subtotalLinea
      } else if (it.iva_tasa === 10) {
        total10 += subtotalLinea
      }
    })

    const iva5 = Math.round(total5 / 21)
    const iva10 = Math.round(total10 / 11)
    const ivaTotal = iva5 + iva10

    return {
      totalExenta,
      total5,
      total10,
      iva5,
      iva10,
      ivaTotal,
      totalFactura,
    }
  }, [items])

  // ── EMISIÓN DE FACTURA Y PERSISTENCIA ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const rucFinal = ruc.trim()
    const razonSocialFinal = razonSocial.trim()

    if (!rucFinal || !razonSocialFinal) {
      toast.error("Datos de Cliente Incompletos", "Por favor ingresá el RUC y la Razón Social del cliente o institución receptora.")
      return
    }

    // Validar items
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (!it.descripcion.trim()) {
        toast.error("Descripción requerida", `El ítem #${i + 1} no tiene descripción cargada.`)
        return
      }
      if (it.cantidad <= 0) {
        toast.error("Cantidad inválida", `El ítem #${i + 1} debe tener una cantidad mayor a 0.`)
        return
      }
      if (it.precio_unitario <= 0) {
        toast.error("Precio inválido", `El ítem #${i + 1} debe tener un precio unitario mayor a 0 Gs.`)
        return
      }
    }

    if (calculation.totalFactura <= 0) {
      toast.error("Total inválido", "El monto total de la factura no puede ser 0 Gs.")
      return
    }

    setSubmitting(true)
    try {
      // 1. Resolver ID del cliente en base de datos o crearlo
      let resolvedCustomerId = selectedCustomerId

      // Si no tenemos ID seleccionado, buscar por RUC exacto en la BD
      if (!resolvedCustomerId) {
        try {
          const foundList = await api.customers.list({ search: rucFinal, limit: 5 })
          const exactMatch = foundList?.find(c =>
            (c.ruc || "").trim() === rucFinal ||
            (c.ruc || "").replace(/[^0-9]/g, "") === rucFinal.replace(/[^0-9]/g, "")
          )
          if (exactMatch) {
            resolvedCustomerId = exactMatch.id
          }
        } catch (findErr) {
          console.warn("No se pudo buscar cliente por RUC:", findErr)
        }
      }

      // Si aún no tiene ID, crearlo en la tabla customers
      if (!resolvedCustomerId) {
        try {
          const createdCust = await api.customers.create({
            ruc: rucFinal,
            razon_social: razonSocialFinal,
            direccion: direccion.trim() || "Pedro Juan Caballero",
            telefono: telefono.trim() || undefined,
          })
          if (createdCust && createdCust.id) {
            resolvedCustomerId = createdCust.id
          }
        } catch (cErr) {
          console.warn("Aviso al crear cliente (se resolverá en backend con RUC/Razón Social):", cErr)
        }
      }

      // 2. Armar payload de la factura administrativa
      const companyId = "00000000-0000-0000-0000-000000000010"
      const payload: any = {
        company_id: companyId,
        customer_id: resolvedCustomerId || undefined,
        customer_doc: rucFinal,
        customer_nombre: razonSocialFinal,
        customer_direccion: direccion.trim() || undefined,
        customer_telefono: telefono.trim() || undefined,
        punto_emision: "001-011",
        tipo_comprobante: "factura",
        condicion: condicion,
        moneda: "PYG",
        tipo_cambio: 1,
        es_administrativa: true,
        destino_pago: destinoPago,
        destino_referencia: destinoReferencia.trim() || undefined,
        observaciones: `Facturación Administrativa / Convenios. ${observaciones.trim()}`.trim(),
        user_id: user?.id,
        items: items.map(it => ({
          descripcion: it.descripcion.trim(),
          cantidad: it.cantidad,
          precio_unitario: it.precio_unitario,
          iva_tasa: it.iva_tasa,
          descuento_pct: 0,
        })),
        payments: condicion === "contado" ? [
          {
            forma_pago: formaPago,
            monto: calculation.totalFactura,
            moneda: "PYG",
          }
        ] : [],
      }

      const resSale = await api.sales.create(payload)

      // Objeto de cliente completo para alimentar inmediatamente la Factura A4
      const customerDataToPass: Customer = {
        id: resolvedCustomerId || resSale.customer_id || "cust-temp",
        ruc: rucFinal,
        razon_social: razonSocialFinal,
        nombre: razonSocialFinal,
        direccion: direccion.trim() || "Pedro Juan Caballero, Amambay",
        telefono: telefono.trim() || "—",
      } as any

      toast.success(
        "Factura Oficial Emitida",
        `Factura Nº ${resSale.numero || "001-011-..."} a nombre de "${razonSocialFinal}".${
          destinoPago === "boveda" ? " Fondos acreditados en Bóveda Central." : ""
        }`
      )

      onSuccess(resSale, customerDataToPass)
      onClose()
    } catch (err: any) {
      console.error("Error al emitir factura administrativa:", err)
      toast.error("Error al emitir factura", err.message || "Verificá la configuración del punto de emisión 001-011.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* ── HEADER MODAL ── */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-5 border-b border-blue-500/20">
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30 text-white shrink-0">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-md">
                    USO EXCLUSIVO ADMINISTRACIÓN
                  </span>
                  <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Punto 001-011 · Timbrado Nº 18545636
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-white mt-0.5">
                  Emitir Factura Administrativa (Convenios y Acuerdos)
                </h2>
                <p className="text-xs text-slate-300">
                  Emisión oficial A4 con texto libre, habilitada para conceptos Exentas y recaudación directa en Bóveda
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={submitting}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── BODY FORMULARIO ── */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 dark:text-slate-100">

          {/* 1. SECCIÓN CLIENTE / INSTITUCIÓN */}
          <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <User className="w-4 h-4 text-blue-500" />
                1. Datos del Cliente / Convenio (Conectado a Base de Datos)
              </span>
              {selectedCustomerId && (
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                  <Check className="w-3.5 h-3.5" /> Vinculado a Cliente en BD
                </span>
              )}
            </div>

            {/* BUSCADOR REACTIVO EN VIVO */}
            <div className="relative" ref={dropdownRef}>
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 block">
                Buscar en Base de Clientes (Escribí para buscar por Razón Social o RUC)
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  onFocus={() => {
                    if (searchResults.length > 0) setShowDropdown(true)
                  }}
                  placeholder="Ej: Universidad, Pacifico, Cooperativa, RUC..."
                  className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
                {searchingCustomers && (
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin absolute right-3 top-3" />
                )}
              </div>

              {/* LISTA DESPLEGABLE EN VIVO */}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-30 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {searchResults.map(c => (
                    <div
                      key={c.id}
                      onClick={() => handleSelectCustomer(c)}
                      className="p-3 hover:bg-blue-50/80 dark:hover:bg-blue-950/50 cursor-pointer flex items-center justify-between transition"
                    >
                      <div>
                        <div className="font-bold text-xs text-slate-900 dark:text-white">
                          {c.razon_social || c.nombre}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{c.direccion || "Sin dirección"}</span>
                          {c.telefono && <span>• Tel: {c.telefono}</span>}
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800">
                        {c.ruc}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CAMPOS REALES EDITABLES (ASUME LO CARGADO) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 flex items-center justify-between">
                  <span>RUC / C.I. del Cliente *</span>
                  <button
                    type="button"
                    onClick={handleLookupRuc}
                    disabled={lookingUpRuc || !ruc.trim()}
                    className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    {lookingUpRuc ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Verificar en SET / DNIT
                  </button>
                </label>
                <input
                  type="text"
                  required
                  value={ruc}
                  onChange={(e) => {
                    setRuc(e.target.value)
                    setSelectedCustomerId(null) // Si edita a mano, desvincula para re-verificar
                  }}
                  placeholder="Ej: 80012345-6 o 44444401-7"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                  Razón Social / Nombre Oficial *
                </label>
                <input
                  type="text"
                  required
                  value={razonSocial}
                  onChange={(e) => {
                    setRazonSocial(e.target.value)
                    setSelectedCustomerId(null)
                  }}
                  placeholder="Ej: UNIVERSIDAD DEL PACÍFICO"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                  Dirección
                </label>
                <input
                  type="text"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Ej: San Martín casi España, Asunción"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                  Teléfono / Contacto
                </label>
                <input
                  type="text"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="Ej: 0983 555 123"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
              </div>
            </div>

            {/* Condición de Venta */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center gap-4 text-xs font-bold">
              <span className="text-slate-500">Condición de Venta:</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="condicion"
                  value="contado"
                  checked={condicion === "contado"}
                  onChange={() => setCondicion("contado")}
                  className="text-blue-600 focus:ring-blue-500"
                />
                Contado
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="condicion"
                  value="credito"
                  checked={condicion === "credito"}
                  onChange={() => setCondicion("credito")}
                  className="text-blue-600 focus:ring-blue-500"
                />
                Crédito
              </label>
            </div>
          </div>

          {/* 2. SECCIÓN ÍTEMS DE TEXTO LIBRE & EXENTAS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-500" />
                2. Detalle de Ítems (Texto Libre y Tasa de IVA)
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Fila
              </button>
            </div>

            <div className="space-y-2.5">
              {items.map((it, idx) => {
                const subtotal = Math.round(Number(it.cantidad || 0) * Number(it.precio_unitario || 0))
                return (
                  <div
                    key={it.id}
                    className="p-3 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center gap-3"
                  >
                    {/* Número */}
                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 text-[11px] font-bold flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-400">
                      {idx + 1}
                    </div>

                    {/* Descripción libre */}
                    <div className="flex-1">
                      <input
                        type="text"
                        required
                        value={it.descripcion}
                        onChange={(e) => handleUpdateItem(idx, "descripcion", e.target.value)}
                        placeholder="Descripción libre del servicio o convenio (ej: Cuota Septiembre Convenio Educativo...)"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                      />
                    </div>

                    {/* Cantidad */}
                    <div className="w-20 shrink-0">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={it.cantidad}
                        onChange={(e) => handleUpdateItem(idx, "cantidad", Math.max(1, Number(e.target.value)))}
                        className="w-full px-2.5 py-2 text-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                        title="Cantidad"
                      />
                    </div>

                    {/* Precio Unitario */}
                    <div className="w-36 shrink-0">
                      <CurrencyInput
                        value={it.precio_unitario}
                        onChangeValue={(numVal: number) => handleUpdateItem(idx, "precio_unitario", numVal)}
                        placeholder="0"
                        className="w-full px-3 py-2 text-right rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold font-mono text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                      />
                    </div>

                    {/* Tasa IVA */}
                    <div className="w-32 shrink-0">
                      <select
                        value={it.iva_tasa}
                        onChange={(e) => handleUpdateItem(idx, "iva_tasa", Number(e.target.value) as 0 | 5 | 10)}
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm"
                      >
                        <option value={0}>Exenta (0%)</option>
                        <option value={5}>IVA 5%</option>
                        <option value={10}>IVA 10%</option>
                      </select>
                    </div>

                    {/* Subtotal Línea */}
                    <div className="w-32 text-right shrink-0">
                      <span className="text-xs font-black font-mono text-slate-900 dark:text-white">
                        {formatPYG(subtotal)}
                      </span>
                    </div>

                    {/* Botón Eliminar */}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 transition rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 shrink-0 cursor-pointer"
                      title="Eliminar fila"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 3. RESUMEN DE LIQUIDACIÓN TRIBUTARIA */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Ventas Exentas</span>
                <span className="font-mono font-bold text-amber-400">{formatPYG(calculation.totalExenta)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Gravadas 5% (Liq: {formatPYG(calculation.iva5)})</span>
                <span className="font-mono font-bold text-slate-200">{formatPYG(calculation.total5)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Gravadas 10% (Liq: {formatPYG(calculation.iva10)})</span>
                <span className="font-mono font-bold text-slate-200">{formatPYG(calculation.total10)}</span>
              </div>
              <div className="text-right sm:border-l sm:border-slate-800 sm:pl-3">
                <span className="text-blue-400 block text-[10px] uppercase font-black">TOTAL FACTURA (PYG)</span>
                <span className="font-mono font-black text-xl text-emerald-400">{formatPYG(calculation.totalFactura)}</span>
              </div>
            </div>
          </div>

          {/* 4. SECCIÓN FORMA DE PAGO Y DESTINO DE LOS FONDOS */}
          <div className="bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-200/60 dark:border-blue-800/40 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
              <Landmark className="w-4 h-4 text-blue-600" />
              3. Cobro y Destino de los Fondos (Tesorería / Bóveda)
            </span>

            {condicion === "contado" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Medio de Pago */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                    Forma de Pago
                  </label>
                  <select
                    value={formaPago}
                    onChange={(e) => setFormaPago(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm"
                  >
                    <option value="EFECTIVO">🇵🇾 Efectivo (Guaraníes)</option>
                    <option value="TRANF. BANCARIA">🏦 Transferencia Bancaria</option>
                    <option value="CHEQUES">🧾 Cheque</option>
                    <option value="OTRO">📝 Otro medio</option>
                  </select>
                </div>

                {/* Destino del Pago */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                    ¿Dónde destina este pago?
                  </label>
                  <select
                    value={destinoPago}
                    onChange={(e) => setDestinoPago(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm"
                  >
                    <option value="boveda">🏦 Bóveda Central (Ingreso directo a Tesorería)</option>
                    <option value="deposito">🏛️ Depósito Bancario</option>
                    <option value="transferencia">💳 Transferencia a Cuenta Bancaria</option>
                    <option value="otro">📝 Otro medio a especificar</option>
                  </select>
                </div>

                {/* Detalle explicativo según destino */}
                <div className="sm:col-span-2">
                  {destinoPago === "boveda" ? (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs">
                      <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600" />
                      <span>
                        <strong>Entrada Directa a Bóveda:</strong> La recaudación de esta factura ({formatPYG(calculation.totalFactura)}) sumará inmediatamente al saldo disponible de la Bóveda Central de la empresa, sin pasar por cajas de salón.
                      </span>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                        Detalle / Banco / N° de Boleta o Comprobante
                      </label>
                      <input
                        type="text"
                        value={destinoReferencia}
                        onChange={(e) => setDestinoReferencia(e.target.value)}
                        placeholder="Ej: Banco Continental Cta Cte Nº 123456 - Boleta Nº 987654"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
                <span>
                  <strong>Factura a Crédito:</strong> Se emitirá como cuenta por cobrar del convenio. Cuando se reciba el pago, se registrará el ingreso correspondiente en Bóveda o Bancos.
                </span>
              </div>
            )}

            {/* Observaciones generales */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                Observaciones del Convenio / Auditoría Interna
              </label>
              <input
                type="text"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Ej: Convenio Marco Cuota Septiembre / Respaldo Acta Nº 14/2026..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              />
            </div>
          </div>

          {/* ── BOTONES DE ACCIÓN ── */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-extrabold shadow-lg shadow-blue-500/25 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Emitiendo Factura...
                </>
              ) : (
                <>
                  <Receipt className="w-4 h-4" />
                  Emitir Factura Oficial (001-011)
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
