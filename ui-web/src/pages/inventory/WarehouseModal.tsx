import React, { useState, useEffect } from "react"
import { Building2, CornerDownRight, FolderTree, X, Check, Loader2 } from "lucide-react"
import type { Warehouse } from "../../api"

export interface WarehouseFormData {
  codigo: string
  nombre: string
  direccion: string
  tipo: string
  parent_id: string | null
  responsable: string
  descripcion: string
}

interface WarehouseModalProps {
  isOpen: boolean
  onClose: () => void
  editingWh: Warehouse | null
  warehouses: Warehouse[]
  initialParentId?: string | null
  onSave: (data: WarehouseFormData) => Promise<void>
  isSaving: boolean
}

/**
 * Modal estándar (Regla 14) para Alta y Edición de Depósitos y Subdepósitos.
 * Contenedor max-h-[90vh], cabecera y pie de acciones fijados (shrink-0),
 * y cuerpo scrolleable (flex-1 overflow-y-auto).
 */
export default function WarehouseModal({
  isOpen,
  onClose,
  editingWh,
  warehouses,
  initialParentId = null,
  onSave,
  isSaving,
}: WarehouseModalProps) {
  const [formData, setFormData] = useState<WarehouseFormData>({
    codigo: "",
    nombre: "",
    direccion: "",
    tipo: "principal",
    parent_id: null,
    responsable: "",
    descripcion: "",
  })

  useEffect(() => {
    if (!isOpen) return

    if (editingWh) {
      setFormData({
        codigo: editingWh.codigo || "",
        nombre: editingWh.nombre || "",
        direccion: editingWh.direccion || "",
        tipo: editingWh.tipo || (editingWh.parent_id ? "subdeposito" : "principal"),
        parent_id: editingWh.parent_id || null,
        responsable: editingWh.responsable || "",
        descripcion: editingWh.descripcion || "",
      })
    } else {
      setFormData({
        codigo: "",
        nombre: "",
        direccion: "",
        tipo: initialParentId ? "subdeposito" : "principal",
        parent_id: initialParentId,
        responsable: "",
        descripcion: "",
      })
    }
  }, [isOpen, editingWh, initialParentId])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.nombre.trim() || !formData.codigo.trim()) return
    onSave(formData)
  }

  const principalWarehouses = warehouses.filter((w) => !w.parent_id)

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Cabecera (shrink-0) */}
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200 dark:border-purple-800 shrink-0">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-gray-900 dark:text-white leading-tight">
                {editingWh
                  ? "Editar Depósito / Subdepósito"
                  : formData.parent_id
                  ? "Crear Nuevo Subdepósito de Sector"
                  : "Crear Nuevo Depósito o Subdepósito"}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-slate-400">
                Estructura logística bimonetaria y sectorizada de Extra Supermercado
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario envolvente */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          {/* Cuerpo Central Scrolleable (flex-1 overflow-y-auto) */}
          <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
            {/* Selector de Jerarquía: Principal vs Subdepósito */}
            {!editingWh && (
              <div className="space-y-2 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/60">
                <label className="block font-bold text-gray-500 dark:text-slate-400 uppercase text-[10px]">
                  Nivel de Almacén:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, parent_id: null, tipo: "principal" })}
                    className={`px-3 py-2 rounded-xl font-bold text-xs border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      !formData.parent_id
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-gray-300"
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    Depósito Principal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const firstParent = principalWarehouses[0]?.id || warehouses[0]?.id || null
                      setFormData({ ...formData, parent_id: firstParent, tipo: "subdeposito" })
                    }}
                    className={`px-3 py-2 rounded-xl font-bold text-xs border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      formData.parent_id
                        ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                        : "bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-gray-300"
                    }`}
                  >
                    <CornerDownRight className="w-3.5 h-3.5" />
                    Subdepósito / Sector
                  </button>
                </div>

                {/* Selector del Depósito Padre */}
                {formData.parent_id && (
                  <div className="pt-2 space-y-1">
                    <label className="block font-semibold text-gray-600 dark:text-slate-300 text-[11px]">
                      Seleccione el Depósito Principal al que pertenece: *
                    </label>
                    <select
                      required
                      value={formData.parent_id}
                      onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {principalWarehouses.map((pw) => (
                        <option key={pw.id} value={pw.id}>
                          🏢 {pw.nombre} ({pw.codigo})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Selector de Tipo */}
            <div className="space-y-1.5">
              <label className="block font-bold text-gray-500 dark:text-slate-400 uppercase text-[10px]">
                Tipo Funcional de Almacén: *
              </label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="principal">🏢 Depósito Central / Principal</option>
                <option value="subdeposito">📦 Subdepósito Operativo de Sector</option>
                <option value="camara">❄️ Cámara Frigorífica / Climatizada</option>
                <option value="salon">🛒 Salón de Ventas / Góndolas</option>
                <option value="produccion">🥩 Área de Producción (Carnicería, Panadería, Rotisería)</option>
                <option value="merma">⚠️ Depósito de Averías / Mermas / Devoluciones</option>
              </select>
            </div>

            {/* Código y Nombre */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="block font-bold text-gray-500 dark:text-slate-400 uppercase text-[10px]">
                  Código *
                </label>
                <input
                  type="text"
                  required
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                  placeholder="Ej: SUB-01"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-purple-500 uppercase"
                />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="block font-bold text-gray-500 dark:text-slate-400 uppercase text-[10px]">
                  Nombre del Depósito / Sector *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: Subdepósito Carnicería / Salón de Ventas"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Responsable y Ubicación */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block font-bold text-gray-500 dark:text-slate-400 uppercase text-[10px]">
                  Responsable / Encargado
                </label>
                <input
                  type="text"
                  value={formData.responsable}
                  onChange={(e) => setFormData({ ...formData, responsable: e.target.value })}
                  placeholder="Ej: Carlos Maidana (Encargado)"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-gray-500 dark:text-slate-400 uppercase text-[10px]">
                  Ubicación Física / Pasillo
                </label>
                <input
                  type="text"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  placeholder="Ej: Sector Frescos - Pasillo 2"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Descripción */}
            <div className="space-y-1">
              <label className="block font-bold text-gray-500 dark:text-slate-400 uppercase text-[10px]">
                Descripción u Observaciones Operativas
              </label>
              <textarea
                rows={2}
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Detalles sobre temperatura, mercaderías asignadas o procesos internos..."
                className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Pie de Acciones Fijo (shrink-0) */}
          <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 shrink-0 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-bold hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition shadow-md shadow-purple-600/30 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>
                    {editingWh
                      ? "Actualizar Depósito"
                      : formData.parent_id
                      ? "Crear Subdepósito"
                      : "Guardar Depósito"}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
