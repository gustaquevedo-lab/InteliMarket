import React, { useState, useEffect, useMemo } from "react"
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Building2,
  Layers,
  Split,
  Plus,
  Trash2,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Tag,
  DollarSign
} from "lucide-react"
import CurrencyInput from "../CurrencyInput"
import { formatPYG } from "../../utils/format"
import { api } from "../../api"
import { useToast } from "../../context/ToastContext"

interface ReclassifyExpenseModalProps {
  item: any
  isOpen: boolean
  onClose: () => void
  onSaved: (newNaturaleza: string, expenseId: string) => void
}

interface AllocationRow {
  id?: string
  cost_center_id: string
  category_id: string
  naturaleza_economica: string
  production_area: string
  monto: number
  notas: string
}

const DEFAULT_NATURALEZAS = [
  { id: "OPEX_GASTO_OPERATIVO", label: "Gasto Operativo (OPEX)" },
  { id: "CMV_MATERIA_PRIMA", label: "Materia Prima (CMV Panadería / Rotisería)" },
  { id: "CMV_REVENTA", label: "Compra de Mercadería para Reventa (CMV Salón)" },
  { id: "CAPEX_ACTIVO_FIJO", label: "Inversión / Activo Fijo (CAPEX)" },
  { id: "ANTICIPO_PERSONAL", label: "Anticipo al Personal (Descuento Nómina)" },
  { id: "GASTO_DIFERIDO_CUOTAS", label: "Gasto Diferido en Cuotas (Seguros / Pólizas)" }
]

const DEFAULT_PRODUCTION_AREAS = [
  { id: "panaderia", nombre: "Panadería" },
  { id: "rotiseria", nombre: "Rotisería" },
  { id: "carniceria", nombre: "Carnicería" },
  { id: "verduleria", nombre: "Verdulería" },
  { id: "salon_general", nombre: "Salón / General" }
]

export function ReclassifyExpenseModal({
  item,
  isOpen,
  onClose,
  onSaved
}: ReclassifyExpenseModalProps) {
  const toast = useToast()

  const [catalogs, setCatalogs] = useState<{
    naturalezas: Array<{ id: string; label: string }>
    cost_centers: Array<{ id: string; nombre: string; tipo: string }>
    expense_categories: Array<{ id: string; nombre: string }>
    production_areas: Array<{ id: string; nombre: string }>
  }>({
    naturalezas: DEFAULT_NATURALEZAS,
    cost_centers: [],
    expense_categories: [],
    production_areas: DEFAULT_PRODUCTION_AREAS
  })

  const [loadingCatalogs, setLoadingCatalogs] = useState(false)
  const [saving, setSaving] = useState(false)

  // Modo: Destino único vs Split por sector
  const [isSplit, setIsSplit] = useState(false)

  // Estado para Destino Único
  const [naturaleza, setNaturaleza] = useState("OPEX_GASTO_OPERATIVO")
  const [costCenterId, setCostCenterId] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [categorySearch, setCategorySearch] = useState("")
  const [productionArea, setProductionArea] = useState("")
  const [esInversion, setEsInversion] = useState(false)
  const [categoriaActivo, setCategoriaActivo] = useState("")

  // Estado para Split
  const [allocations, setAllocations] = useState<AllocationRow[]>([])

  // Carga reactiva de catálogos cuando el modal se abre
  useEffect(() => {
    let isCancelled = false
    async function loadCatalogs() {
      setLoadingCatalogs(true)
      try {
        const res = await api.financial.closing.getClassificationCatalogs()
        if (!isCancelled && res) {
          setCatalogs({
            naturalezas: res.naturalezas && res.naturalezas.length > 0 ? res.naturalezas : DEFAULT_NATURALEZAS,
            cost_centers: res.cost_centers || [],
            expense_categories: res.expense_categories || [],
            production_areas: res.production_areas && res.production_areas.length > 0 ? res.production_areas : DEFAULT_PRODUCTION_AREAS
          })
        }
      } catch (err) {
        console.warn("Error cargando catálogos de clasificación:", err)
      } finally {
        if (!isCancelled) setLoadingCatalogs(false)
      }
    }

    if (isOpen) {
      loadCatalogs()
    }
    return () => {
      isCancelled = true
    }
  }, [isOpen])

  // Inicializar formulario con los datos del comprobante al abrirse
  useEffect(() => {
    if (!item) return

    const itemHasSplit = Boolean(item.has_split && item.allocations && item.allocations.length > 0)
    setIsSplit(itemHasSplit)

    setNaturaleza(item.naturaleza_economica || "OPEX_GASTO_OPERATIVO")
    setCostCenterId(item.cost_center_id || "")
    setCategoryId(item.category_id || "")
    setProductionArea(item.production_area || "")
    setEsInversion(Boolean(item.es_inversion) || item.naturaleza_economica === "CAPEX_ACTIVO_FIJO")
    setCategoriaActivo(item.categoria_activo || "")

    if (itemHasSplit) {
      setAllocations(
        item.allocations.map((a: any) => ({
          id: a.id,
          cost_center_id: a.cost_center_id || "",
          category_id: a.category_id || "",
          naturaleza_economica: a.naturaleza_economica || "OPEX_GASTO_OPERATIVO",
          production_area: a.production_area || "",
          monto: Number(a.monto) || 0,
          notas: a.notas || ""
        }))
      )
    } else {
      // Si no tenía split, preparar 2 líneas iniciales equilibradas para cuando el usuario active split
      const mitad = Math.floor(Number(item.monto || 0) / 2)
      const resto = Number(item.monto || 0) - mitad
      setAllocations([
        {
          cost_center_id: item.cost_center_id || "",
          category_id: item.category_id || "",
          naturaleza_economica: item.naturaleza_economica || "OPEX_GASTO_OPERATIVO",
          production_area: item.production_area || "",
          monto: mitad,
          notas: ""
        },
        {
          cost_center_id: "",
          category_id: item.category_id || "",
          naturaleza_economica: item.naturaleza_economica || "OPEX_GASTO_OPERATIVO",
          production_area: "",
          monto: resto,
          notas: ""
        }
      ])
    }
  }, [item])

  const totalComprobante = Number(item?.monto || 0)

  // Cálculo del total asignado en modo Split y diferencia
  const totalAsignadoSplit = useMemo(() => {
    return allocations.reduce((acc, row) => acc + (Number(row.monto) || 0), 0)
  }, [allocations])

  const diferenciaSplit = Math.round(totalComprobante - totalAsignadoSplit)
  const isSplitCuadrado = Math.abs(diferenciaSplit) <= 1

  // Filtro reactivo para las 75 categorías de gastos
  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return catalogs.expense_categories
    const s = categorySearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return catalogs.expense_categories.filter((c) => {
      const name = c.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      return name.includes(s)
    })
  }, [catalogs.expense_categories, categorySearch])

  const handleAddAllocationRow = () => {
    const pendiente = Math.max(0, diferenciaSplit)
    setAllocations((prev) => [
      ...prev,
      {
        cost_center_id: "",
        category_id: categoryId || (catalogs.expense_categories[0]?.id || ""),
        naturaleza_economica: naturaleza || "OPEX_GASTO_OPERATIVO",
        production_area: "",
        monto: pendiente,
        notas: ""
      }
    ])
  }

  const handleRemoveAllocationRow = (index: number) => {
    if (allocations.length <= 1) {
      toast.error("Debe existir al menos una asignación.")
      return
    }
    setAllocations((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpdateAllocationRow = (index: number, field: keyof AllocationRow, value: any) => {
    setAllocations((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const handleSave = async () => {
    if (!item?.id) {
      toast.error("El comprobante seleccionado no cuenta con ID único para ser redestinado en la base de datos.")
      return
    }

    if (isSplit) {
      if (!isSplitCuadrado) {
        toast.error(`La suma de partes debe ser igual al total del comprobante (${formatPYG(totalComprobante)}). Diferencia: ${formatPYG(diferenciaSplit)}`)
        return
      }
      for (let i = 0; i < allocations.length; i++) {
        if (!allocations[i].cost_center_id && !allocations[i].production_area) {
          toast.error(`La asignación #${i + 1} no tiene sector o departamento asignado.`)
          return
        }
      }
    }

    setSaving(true)
    try {
      const payload: any = {
        is_split: isSplit,
        naturaleza_economica: naturaleza,
        cost_center_id: costCenterId || null,
        category_id: categoryId || null,
        production_area: productionArea || null,
        es_inversion: esInversion || naturaleza === "CAPEX_ACTIVO_FIJO",
        categoria_activo: categoriaActivo || null
      }

      if (isSplit) {
        payload.allocations = allocations.map((a) => ({
          cost_center_id: a.cost_center_id || null,
          category_id: a.category_id || null,
          naturaleza_economica: a.naturaleza_economica || "OPEX_GASTO_OPERATIVO",
          production_area: a.production_area || null,
          monto: Number(a.monto),
          notas: a.notas || null
        }))
      }

      const res = await api.financial.closing.reclassifyExpense(item.id, payload)
      if (res && res.status === "success") {
        if (naturaleza === "CMV_MATERIA_PRIMA") {
          toast.success("✅ Comprobante transferido a 3. CMV / Compras (Materia Prima Panadería). Salió de OPEX.")
        } else if (naturaleza === "CMV_REVENTA") {
          toast.success("✅ Comprobante transferido a 3. CMV / Compras (Mercadería Reventa Salón). Salió de OPEX.")
        } else if (naturaleza === "CAPEX_ACTIVO_FIJO" || esInversion) {
          toast.success("✅ Comprobante transferido a 6. Inversiones / Activo Fijo (CAPEX). Ya no reduce EBITDA.")
        } else if (naturaleza === "ANTICIPO_PERSONAL") {
          toast.success("✅ Comprobante transferido a 7. Anticipos y No Operativos (Descuento Nómina).")
        } else {
          toast.success("✅ Clasificación contable y departamento actualizados exitosamente.")
        }
        onSaved(naturaleza, item.id)
        onClose()
      } else {
        throw new Error(res?.message || "Error al redestinar el gasto")
      }
    } catch (err: any) {
      console.error("Error guardando reclasificación:", err)
      toast.error(err?.message || "Error al guardar la redestinación del comprobante.")
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen || !item) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        {/* 🌟 CABECERA FIJA (SHRINK-0) */}
        <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800/60">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold tracking-widest text-indigo-600 dark:text-indigo-400 uppercase bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                  REDESTINACIÓN CONTABLE & P&L
                </span>
                <span className="text-xs font-mono font-bold text-slate-500">
                  {item.comp || "S/N"}
                </span>
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                {item.proveedor || "PROVEEDOR LOCAL"}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 📋 CUERPO CENTRAL CON SCROLL (FLEX-1 OVERFLOW-Y-AUTO) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Tarjeta Resumen del Comprobante */}
          <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Importe Total</span>
              <p className="text-base font-black font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                {formatPYG(totalComprobante)}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fecha de Emisión</span>
              <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 mt-1">
                {item.fecha || "—"}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">RUC Proveedor</span>
              <p className="text-xs font-mono text-slate-600 dark:text-slate-400 mt-1">
                {item.ruc || "Sin RUC"}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Medio / Desembolso</span>
              <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-1" title={item.forma_pago_resumen || item.tipo_pago}>
                {item.forma_pago_resumen || item.tipo_pago || "Efectivo / Fondo"}
              </p>
            </div>

            <div className="col-span-2 sm:col-span-4 pt-2 border-t border-slate-200 dark:border-slate-800/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Descripción / Concepto Original</span>
              <p className="text-xs font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                {item.concepto || "Sin descripción"}
              </p>
            </div>
          </div>

          {/* Switcher: Destino Único vs Split */}
          <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setIsSplit(false)}
              className={`flex-1 py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
                !isSplit
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Building2 className="w-4 h-4" />
              Destino Único (100% Comprobante)
            </button>

            <button
              type="button"
              onClick={() => setIsSplit(true)}
              className={`flex-1 py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
                isSplit
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Split className="w-4 h-4" />
              Dividir por Sector / Split
            </button>
          </div>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* OPCIÓN 1: DESTINO ÚNICO (100%)                             */}
          {/* ══════════════════════════════════════════════════════════ */}
          {!isSplit ? (
            <div className="space-y-4">
              {/* Tarjeta explicativa de impacto financiero */}
              {naturaleza === "CMV_MATERIA_PRIMA" && (
                <div className="bg-amber-50 dark:bg-amber-950/40 p-3.5 rounded-2xl border border-amber-300 dark:border-amber-700/60 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-extrabold">Impacto: Sale de Gastos Operativos y entra al Costo de Ventas (CMV)</p>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                      Este comprobante dejará de listarse en Gastos Operativos (OPEX) y se mostrará en la pestaña <strong>3. CMV / Compras</strong> como Materia Prima de Producción, protegiendo el margen comercial.
                    </p>
                  </div>
                </div>
              )}

              {naturaleza === "CMV_REVENTA" && (
                <div className="bg-blue-50 dark:bg-blue-950/40 p-3.5 rounded-2xl border border-blue-300 dark:border-blue-700/60 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-extrabold">Impacto: Compra de Mercadería para Reventa (CMV Salón)</p>
                    <p className="text-[11px] text-blue-800 dark:text-blue-300 mt-0.5">
                      Saldrá de Gastos Operativos (OPEX) y se computará en el costo de mercaderías vendidas.
                    </p>
                  </div>
                </div>
              )}

              {naturaleza === "CAPEX_ACTIVO_FIJO" && (
                <div className="bg-indigo-50 dark:bg-indigo-950/40 p-3.5 rounded-2xl border border-indigo-300 dark:border-indigo-700/60 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-extrabold">Impacto: Sale de Gastos Operativos y entra a Inversiones (CAPEX)</p>
                    <p className="text-[11px] text-indigo-800 dark:text-indigo-300 mt-0.5">
                      Este comprobante se registrará como Activo Fijo Patrimonial. Saldrá inmediatamente de OPEX y <strong>no deducirá el EBITDA mensual</strong>. Se listará en la pestaña <strong>6. Inversiones / Activo Fijo</strong>.
                    </p>
                  </div>
                </div>
              )}

              {naturaleza === "ANTICIPO_PERSONAL" && (
                <div className="bg-purple-50 dark:bg-purple-950/40 p-3.5 rounded-2xl border border-purple-300 dark:border-purple-700/60 text-xs text-purple-900 dark:text-purple-200 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-extrabold">Impacto: Anticipo al Personal a descontar por Nómina</p>
                    <p className="text-[11px] text-purple-800 dark:text-purple-300 mt-0.5">
                      Saldrá de Gastos Operativos y se mostrará en la pestaña <strong>7. Anticipos y No Operativos</strong>. No afectará el Estado de Resultados.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Naturaleza Económica */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Naturaleza Económica (Impacto P&L / Balance)
                  </label>
                  <select
                    value={naturaleza}
                    onChange={(e) => {
                      const val = e.target.value
                      setNaturaleza(val)
                      if (val === "CAPEX_ACTIVO_FIJO") setEsInversion(true)
                      else if (val === "OPEX_GASTO_OPERATIVO") setEsInversion(false)
                    }}
                    className="w-full text-xs font-medium bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    {catalogs.naturalezas.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Define si se resta de EBITDA (OPEX), del Margen Comercial (CMV) o si es Inversión de Capital (CAPEX).
                  </p>
                </div>

                {/* Sector / Centro de Costo */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Departamento / Centro de Costo Afectado
                  </label>
                  <select
                    value={costCenterId}
                    onChange={(e) => setCostCenterId(e.target.value)}
                    className="w-full text-xs font-medium bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Seleccionar Sector / Centro de Costo --</option>
                    {catalogs.cost_centers.map((cc) => (
                      <option key={cc.id} value={cc.id}>
                        {cc.nombre} ({cc.tipo})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Categoría Contable del Supermercado */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Categoría del Gasto (Plan de Cuentas)
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {loadingCatalogs ? "Cargando rubros..." : `${filteredCategories.length} de ${catalogs.expense_categories.length} rubros`}
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Filtrar categorías (ej: panaderia, luz, software, mant)..."
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    className="w-full mb-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder:text-slate-400"
                  />
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full text-xs font-medium bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">{loadingCatalogs ? "-- Cargando catálogo contable... --" : "-- Seleccionar Rubro Contable --"}</option>
                    {filteredCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Área de Producción (Si es Materia Prima) */}
                {naturaleza === "CMV_MATERIA_PRIMA" && (
                  <div>
                    <label className="text-xs font-bold text-amber-700 dark:text-amber-400 block mb-1">
                      Área de Producción Fabril
                    </label>
                    <select
                      value={productionArea}
                      onChange={(e) => setProductionArea(e.target.value)}
                      className="w-full text-xs font-medium bg-amber-50/50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700 rounded-xl px-3 py-2.5 text-amber-900 dark:text-amber-200 focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="">-- Seleccionar Área --</option>
                      {catalogs.production_areas.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Categoría de Activo Fijo (Si es Inversión/CAPEX) */}
                {(naturaleza === "CAPEX_ACTIVO_FIJO" || esInversion) && (
                  <div>
                    <label className="text-xs font-bold text-purple-700 dark:text-purple-400 block mb-1">
                      Categoría de Activo Fijo
                    </label>
                    <select
                      value={categoriaActivo}
                      onChange={(e) => setCategoriaActivo(e.target.value)}
                      className="w-full text-xs font-medium bg-purple-50/50 dark:bg-purple-950/20 border border-purple-300 dark:border-purple-700 rounded-xl px-3 py-2.5 text-purple-900 dark:text-purple-200 focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">-- Seleccionar Tipo de Activo --</option>
                      <option value="Equipamiento Salón y Cajas">Equipamiento Salón y Cajas</option>
                      <option value="Maquinaria de Producción Panadería/Carnicería">Maquinaria de Producción Panadería/Carnicería</option>
                      <option value="Adecuaciones Edilicias e Infraestructura">Adecuaciones Edilicias e Infraestructura</option>
                      <option value="Informática y Redes">Informática y Redes</option>
                      <option value="Rodados y Logística">Rodados y Logística</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ══════════════════════════════════════════════════════════ */
            /* OPCIÓN 2: SPLIT POR SECTOR                                 */
            /* ══════════════════════════════════════════════════════════ */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                    Asignación Multidepartamental ({allocations.length} sectores)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Divide el costo de este comprobante entre las distintas áreas que hicieron uso del bien o servicio.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddAllocationRow}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 cursor-pointer transition shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar Sector
                </button>
              </div>

              {/* Lista de Filas del Split */}
              <div className="space-y-3">
                {allocations.map((alloc, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                        Línea de Imputación #{idx + 1}
                      </span>

                      {allocations.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAllocationRow(idx)}
                          className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                          title="Eliminar este sector"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                      {/* Sector */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-1">Sector / Centro Costo</label>
                        <select
                          value={alloc.cost_center_id}
                          onChange={(e) => handleUpdateAllocationRow(idx, "cost_center_id", e.target.value)}
                          className="w-full text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-2 text-slate-900 dark:text-white"
                        >
                          <option value="">-- Sector --</option>
                          {catalogs.cost_centers.map((cc) => (
                            <option key={cc.id} value={cc.id}>
                              {cc.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Naturaleza */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-1">Naturaleza</label>
                        <select
                          value={alloc.naturaleza_economica}
                          onChange={(e) => handleUpdateAllocationRow(idx, "naturaleza_economica", e.target.value)}
                          className="w-full text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-2 text-slate-900 dark:text-white"
                        >
                          {catalogs.naturalezas.map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Rubro */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-1">Rubro Específico</label>
                        <select
                          value={alloc.category_id}
                          onChange={(e) => handleUpdateAllocationRow(idx, "category_id", e.target.value)}
                          className="w-full text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-2 text-slate-900 dark:text-white truncate"
                        >
                          <option value="">-- Rubro --</option>
                          {catalogs.expense_categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Monto Imputado con CurrencyInput canónico */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-1">Monto Asignado (₲)</label>
                        <CurrencyInput
                          value={alloc.monto}
                          onChangeValue={(numVal) => handleUpdateAllocationRow(idx, "monto", numVal)}
                          currency="PYG"
                          placeholder="0"
                          className="w-full text-xs font-black font-mono text-right bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-2 text-indigo-600 dark:text-indigo-400"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Barra de Cuadratura en Vivo del Split */}
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs transition-all ${
                  isSplitCuadrado
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                    : "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  {isSplitCuadrado ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  )}
                  <div>
                    <span className="font-extrabold block">
                      {isSplitCuadrado
                        ? "Suma perfectamente cuadrada con el total del comprobante"
                        : "Descuadre en la división de sectores"}
                    </span>
                    <span className="text-[11px] opacity-80">
                      Total comprobante: {formatPYG(totalComprobante)} · Asignado: {formatPYG(totalAsignadoSplit)}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">Diferencia</span>
                  <span className="font-mono font-black text-sm">
                    {diferenciaSplit === 0 ? "₲ 0" : (diferenciaSplit > 0 ? `+${formatPYG(diferenciaSplit)}` : `-${formatPYG(Math.abs(diferenciaSplit))}`)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 🌟 PIE DE ACCIONES FIJO (SHRINK-0) */}
        <div className="shrink-0 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || (isSplit && !isSplitCuadrado)}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold text-white flex items-center gap-2 shadow-lg transition cursor-pointer ${
              saving || (isSplit && !isSplitCuadrado)
                ? "bg-slate-400 cursor-not-allowed opacity-60"
                : "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-indigo-600/30"
            }`}
          >
            {saving ? (
              <>Guardando y recalculando...</>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-white" />
                Guardar y Recalcular Cierre
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
