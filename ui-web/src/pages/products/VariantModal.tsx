import React, { useState, useEffect } from "react"
import { Palette, X, Loader2 } from "lucide-react"
import { api, type Product } from "../../api"
import { useToast } from "../../context/ToastContext"
import ProductSearchPicker from "./ProductSearchPicker"

export interface VariantModalProps {
  open: boolean
  onClose: () => void
  parentProduct: Product | null
  onSaved: () => void
}

/**
 * Modal estándar (Regla 14) para alta de variantes de producto (talle, color, sabor, presentación).
 */
export default function VariantModal({
  open,
  onClose,
  parentProduct,
  onSaved,
}: VariantModalProps) {
  const toast = useToast()
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(parentProduct)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    tipo: "talle",
    valor: "",
    sku_variante: "",
    codigo_barra: "",
    precio_extra: 0,
    stock: 0,
  })

  useEffect(() => {
    setSelectedProduct(parentProduct)
  }, [parentProduct])

  useEffect(() => {
    if (open) {
      setForm({
        tipo: "talle",
        valor: "",
        sku_variante: "",
        codigo_barra: "",
        precio_extra: 0,
        stock: 0,
      })
    }
  }, [open])

  if (!open) return null

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduct?.id) {
      toast.error("Seleccione un producto", "Debe elegir el producto padre para la variante.")
      return
    }
    if (!form.valor.trim()) {
      toast.error("Falta el valor", "Ingrese el valor o nombre de la variante (ej. XL, Rojo, Vainilla).")
      return
    }

    setSaving(true)
    try {
      await api.products.variants.create(selectedProduct.id, {
        tipo: form.tipo,
        valor: form.valor.trim(),
        sku_variante: form.sku_variante.trim() || undefined,
        codigo_barra: form.codigo_barra.trim() || undefined,
        precio_extra: Number(form.precio_extra) || 0,
        stock: Number(form.stock) || 0,
      })
      toast.success("Variante Creada", `Se agregó "${form.valor}" a ${selectedProduct.nombre}`)
      onSaved()
      onClose()
    } catch (err: any) {
      toast.error("Error al crear variante", err.message || "No se pudo registrar la variante.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Cabecera Fija (shrink-0) */}
        <div className="shrink-0 p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-indigo-50/50 dark:bg-indigo-950/20">
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Palette className="w-5 h-5 text-indigo-600" /> Nueva Variante de Producto
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo Central Scrolleable (flex-1 overflow-y-auto) */}
        <form id="variant-form" onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Producto Padre *
            </label>
            <ProductSearchPicker
              selectedProduct={selectedProduct}
              onSelect={(p) => setSelectedProduct(p)}
              onClear={() => setSelectedProduct(null)}
              placeholder="Buscar producto por código de barra, SKU o nombre..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Tipo de Variante *
              </label>
              <select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                className="input-field w-full text-xs font-bold"
              >
                <option value="talle">Talle (S, M, L, XL)</option>
                <option value="color">Color</option>
                <option value="sabor">Sabor</option>
                <option value="presentacion">Presentación / Pack</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Valor / Opción *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. XL, Rojo, 6-Pack"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                className="input-field w-full text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                SKU Derivado
              </label>
              <input
                type="text"
                placeholder="Auto o Ej. 120480-XL"
                value={form.sku_variante}
                onChange={(e) => setForm({ ...form, sku_variante: e.target.value })}
                className="input-field w-full text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Código de Barras
              </label>
              <input
                type="text"
                placeholder="784..."
                value={form.codigo_barra}
                onChange={(e) => setForm({ ...form, codigo_barra: e.target.value })}
                className="input-field w-full text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Precio Extra (+Gs.)
              </label>
              <input
                type="number"
                min="0"
                value={form.precio_extra}
                onChange={(e) => setForm({ ...form, precio_extra: Number(e.target.value) })}
                className="input-field w-full text-xs font-mono font-bold text-emerald-600"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Stock Inicial
              </label>
              <input
                type="number"
                min="0"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                className="input-field w-full text-xs font-mono font-bold"
              />
            </div>
          </div>
        </form>

        {/* Pie de Acciones Fijo (shrink-0) */}
        <div className="shrink-0 flex items-center justify-end gap-2 p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="variant-form"
            disabled={saving}
            className="btn-primary text-xs px-5 py-2.5 flex items-center gap-2 shadow-md disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Crear Variante
          </button>
        </div>
      </div>
    </div>
  )
}
