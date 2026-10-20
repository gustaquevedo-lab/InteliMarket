import React, { useState, useEffect, useRef } from "react"
import { Box, Package, Barcode, Zap, Plus, Save, Loader2, X } from "lucide-react"
import { api, type Product, type PackBarcode } from "../../api"
import { useToast } from "../../context/ToastContext"
import ProductSearchPicker from "./ProductSearchPicker"

export const PACK_PRESETS = [
  { label: "Pack x6", unidades: 6, tag: "Pack x6" },
  { label: "Pack x12", unidades: 12, tag: "Pack x12" },
  { label: "Fardo x12", unidades: 12, tag: "Fardo x12" },
  { label: "Caja x24", unidades: 24, tag: "Caja x24" },
  { label: "Caja x48", unidades: 48, tag: "Caja x48" },
  { label: "Display x12", unidades: 12, tag: "Display x12" },
  { label: "Six-Pack", unidades: 6, tag: "Six-Pack" },
  { label: "Pack x4", unidades: 4, tag: "Pack x4" },
]

export interface PackBarcodeModalProps {
  open: boolean
  onClose: () => void
  product: Product | null
  editingPackBarcode: PackBarcode | null
  onSaved: () => void
}

/**
 * Modal estándar (Regla 14) para alta y edición de códigos de barra de pack o fardo por cantidad.
 */
export default function PackBarcodeModal({
  open,
  onClose,
  product,
  editingPackBarcode,
  onSaved,
}: PackBarcodeModalProps) {
  const toast = useToast()
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(product)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    codigo_barra: "",
    etiqueta: "Pack x6",
    unidades_por_paquete: 6,
  })

  const packBarcodeInputRef = useRef<HTMLInputElement>(null)
  const packEtiquetaInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSelectedProduct(product)
  }, [product])

  useEffect(() => {
    if (editingPackBarcode) {
      setForm({
        codigo_barra: editingPackBarcode.codigo_barra,
        etiqueta: editingPackBarcode.etiqueta,
        unidades_por_paquete: editingPackBarcode.unidades_por_paquete,
      })
    } else {
      setForm({
        codigo_barra: "",
        etiqueta: "Pack x6",
        unidades_por_paquete: 6,
      })
    }
  }, [editingPackBarcode, open])

  if (!open) return null

  const handleSave = async (e?: React.FormEvent, keepOpen: boolean = false) => {
    if (e) e.preventDefault()
    if (!selectedProduct?.id) {
      toast.error("Seleccione un producto", "Debe elegir el producto base para asociar el código de caja.")
      return
    }
    if (!form.codigo_barra.trim() || !form.etiqueta.trim() || form.unidades_por_paquete < 1) {
      toast.error("Datos incompletos", "El código de barra, etiqueta y unidades contenidas son obligatorios.")
      return
    }

    setSaving(true)
    try {
      if (editingPackBarcode) {
        await api.products.packBarcodes.update(selectedProduct.id, editingPackBarcode.id, {
          codigo_barra: form.codigo_barra.trim(),
          etiqueta: form.etiqueta.trim(),
          unidades_por_paquete: Number(form.unidades_por_paquete),
        })
        toast.success("Código de Pack Actualizado", `Se guardaron los cambios para ${form.etiqueta}`)
      } else {
        await api.products.packBarcodes.create(selectedProduct.id, {
          codigo_barra: form.codigo_barra.trim(),
          etiqueta: form.etiqueta.trim(),
          unidades_por_paquete: Number(form.unidades_por_paquete),
        })
        toast.success("Código de Pack Registrado", `Caja/Pack ${form.etiqueta} guardado exitosamente.`)
      }

      onSaved()

      if (keepOpen) {
        setForm({
          codigo_barra: "",
          etiqueta: "Caja x24",
          unidades_por_paquete: 24,
        })
        setTimeout(() => packBarcodeInputRef.current?.focus(), 80)
      } else {
        onClose()
      }
    } catch (err: any) {
      toast.error("Error al guardar pack", err.message || "No se pudo registrar el código de barra.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Cabecera Fija (shrink-0) */}
        <div className="shrink-0 p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-amber-50/50 dark:bg-amber-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-md">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {editingPackBarcode ? "Editar Código de Pack" : "Nuevo Código de Pack / Caja"}
              </h3>
              <p className="text-xs text-slate-500">
                Asignar código de barra a una presentación por cantidad (ej. Six-Pack, Caja x24)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo Central Scrolleable (flex-1 overflow-y-auto) */}
        <form id="pack-barcode-form" onSubmit={(e) => handleSave(e, false)} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Selector o Ficha del Producto Base */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Producto Base *
            </label>
            {selectedProduct ? (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 font-bold text-xs">
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                      {selectedProduct.nombre}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 mt-0.5">
                      {selectedProduct.codigo_barra && (
                        <span>
                          Cod: <strong className="text-slate-600 dark:text-slate-300">{selectedProduct.codigo_barra}</strong>
                        </span>
                      )}
                      {selectedProduct.sku && <span>SKU: {selectedProduct.sku}</span>}
                    </div>
                  </div>
                </div>
                {!editingPackBarcode && (
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="text-[11px] font-bold text-amber-600 hover:text-amber-700 hover:underline shrink-0"
                  >
                    Cambiar
                  </button>
                )}
              </div>
            ) : (
              <ProductSearchPicker
                autoFocus={!selectedProduct}
                selectedProduct={selectedProduct}
                onSelect={(p) => {
                  setSelectedProduct(p)
                  setTimeout(() => packBarcodeInputRef.current?.focus(), 80)
                }}
                disabled={!!editingPackBarcode}
                placeholder="Escanear con lectora o buscar por código de barra, SKU o nombre..."
              />
            )}
          </div>

          {/* Presets Rápidos */}
          <div className="bg-amber-50/40 dark:bg-amber-950/20 p-3.5 rounded-2xl border border-amber-200/50 dark:border-amber-900/40 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> Atajos de Presentación Frecuentes:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PACK_PRESETS.map((pr) => (
                <button
                  key={pr.label}
                  type="button"
                  onClick={() => {
                    setForm((prev) => ({
                      ...prev,
                      etiqueta: pr.tag,
                      unidades_por_paquete: pr.unidades,
                    }))
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold bg-white dark:bg-slate-800 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-600 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition-all"
                >
                  {pr.label}
                </button>
              ))}
            </div>
          </div>

          {/* Código de Barras de la Caja */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Código de Barras de la Caja/Pack *
            </label>
            <div className="relative">
              <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={packBarcodeInputRef}
                type="text"
                required
                autoFocus={!!selectedProduct}
                placeholder="Escaneá con la lectora o tipeá el código impreso en la caja"
                value={form.codigo_barra}
                onChange={(e) => setForm({ ...form, codigo_barra: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (!form.etiqueta.trim()) {
                      e.preventDefault()
                      packEtiquetaInputRef.current?.focus()
                    }
                  }
                }}
                className="input-field w-full text-xs font-mono font-bold pl-9 py-2.5"
              />
            </div>
          </div>

          {/* Etiqueta y Unidades */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Etiqueta Descriptiva *
              </label>
              <input
                ref={packEtiquetaInputRef}
                type="text"
                required
                placeholder="Ej. Caja x24, Six-Pack, Fardo x12"
                value={form.etiqueta}
                onChange={(e) => setForm({ ...form, etiqueta: e.target.value })}
                className="input-field w-full text-xs font-bold"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Unidades sueltas contenidas *
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={form.unidades_por_paquete}
                  onChange={(e) => setForm({ ...form, unidades_por_paquete: Number(e.target.value) })}
                  className="input-field w-full text-xs font-mono font-black text-amber-600 dark:text-amber-400 text-right pr-14"
                />
                <span className="text-[10px] font-bold text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  unidades
                </span>
              </div>
            </div>
          </div>
        </form>

        {/* Pie de Acciones Fijo (shrink-0) */}
        <div className="shrink-0 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {!editingPackBarcode && (
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(undefined, true)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-60"
                title="Guarda este pack y deja el producto listo para agregar la siguiente presentación"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Guardar y agregar otro pack
              </button>
            )}
            <button
              type="submit"
              form="pack-barcode-form"
              disabled={saving}
              className="btn-primary text-xs px-5 py-2.5 flex items-center gap-1.5 shadow-md disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editingPackBarcode ? "Guardar Cambios" : "Guardar y Cerrar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
