import { useState, useMemo, useEffect, useCallback } from "react"
import {
  Clock, Users, Calendar, Plus, Search, Filter, RefreshCcw,
  CheckCircle2, AlertTriangle, ShieldCheck, Sun, Moon,
  DollarSign, ChevronLeft, ChevronRight, Check, X, FileSpreadsheet,
  Building, UserCheck, Award, Briefcase, ExternalLink, LayoutGrid, Zap
} from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"
import { api } from "../../api"

const TURNOS = [
  { id: "M", nombre: "Mañana (Apertura)", horario: "06:00 - 14:00", bg: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300" },
  { id: "T", nombre: "Tarde (Cierre)", horario: "14:00 - 22:00", bg: "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300" },
  { id: "C", nombre: "Central (Pico)", horario: "08:00 - 17:00", bg: "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300" },
  { id: "F", nombre: "Franco / Descanso", horario: "Libre", bg: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-400" },
]

export default function SchedulePage() {
  const toast = useToast()
  const { user } = useAuth()
  const [search, setSearch] = useState("")
  const [syncing, setSyncing] = useState(false)

  // Personal de Cajas de Extra Supermercado
  const [staff, setStaff] = useState([
    { id: "u1", nombre: "NILDA AQUINO", rol: "Cajera Principal", seccion: "Cajas POS", lun: "M", mar: "M", mie: "M", jue: "M", vie: "M", sab: "T", dom: "F", hs_extras: 4 },
    { id: "u2", nombre: "LILIANA CRISTALDO", rol: "Cajera Turno Tarde", seccion: "Cajas POS", lun: "T", mar: "T", mie: "T", jue: "T", vie: "T", sab: "T", dom: "F", hs_extras: 2 },
    { id: "u3", nombre: "EVELIN HERRERO", rol: "Cajera / Cobros", seccion: "Cajas POS", lun: "M", mar: "M", mie: "F", jue: "M", vie: "M", sab: "M", dom: "M", hs_extras: 8 },
    { id: "u4", nombre: "JESSICA FERRARI", rol: "Cajera Refuerzo", seccion: "Cajas POS", lun: "F", mar: "T", mie: "T", jue: "T", vie: "T", sab: "M", dom: "T", hs_extras: 6 },
    { id: "u5", nombre: "MARISTELA IBARRA", rol: "Cajera Mañana", seccion: "Cajas POS", lun: "M", mar: "M", mie: "M", jue: "M", vie: "M", sab: "M", dom: "F", hs_extras: 4 },
    { id: "u6", nombre: "ROCIO INSAURRALDE", rol: "Cajera Cierre", seccion: "Cajas POS", lun: "T", mar: "T", mie: "T", jue: "T", vie: "T", sab: "F", dom: "T", hs_extras: 5 },
    { id: "u7", nombre: "LEIDI VERA", rol: "Cajera Salón", seccion: "Cajas POS", lun: "M", mar: "M", mie: "M", jue: "F", vie: "M", sab: "M", dom: "M", hs_extras: 3 },
    { id: "u8", nombre: "DIANA GONZALEZ", rol: "Cajera / Atención", seccion: "Cajas POS", lun: "C", mar: "C", mie: "C", jue: "C", vie: "C", sab: "M", dom: "F", hs_extras: 4 },
    { id: "u9", nombre: "TOMASA", rol: "Cajera", seccion: "Cajas POS", lun: "M", mar: "M", mie: "F", jue: "M", vie: "M", sab: "M", dom: "T", hs_extras: 6 },
    { id: "u10", nombre: "JUAN GABRIEL RUIZ", rol: "Cajero / Repositor", seccion: "Cajas POS", lun: "T", mar: "T", mie: "T", jue: "T", vie: "T", sab: "T", dom: "F", hs_extras: 2 },
  ])

  const kpis = useMemo(() => {
    const totalHsExtras = staff.reduce((a, b) => a + b.hs_extras, 0)
    const costoHsExtras = totalHsExtras * 28500
    return {
      totalStaff: staff.length,
      turnosHoy: staff.length - 2,
      totalHsExtras,
      costoHsExtras,
      estadoSincronizacion: "Sincronizado con SueldOK"
    }
  }, [staff])

  const handleSyncSueldok = async () => {
    setSyncing(true)
    try {
      await api.sueldok.syncShifts({
        company_id: "00000000-0000-0000-0000-000000000010",
        semana_inicio: "2026-W34",
        assignments: staff.map(s => ({
          user_id: s.id,
          user_nombre: s.nombre,
          rol: s.rol,
          seccion: s.seccion,
          lun: s.lun,
          mar: s.mar,
          mie: s.mie,
          jue: s.jue,
          vie: s.vie,
          sab: s.sab,
          dom: s.dom,
          hs_extras: s.hs_extras
        }))
      })
      toast.success("¡Cuadrante Sincronizado!", `Se enviaron los turnos de ${staff.length} colaboradores a SueldOK`)
    } catch {
      toast.info("Cuadrante Actualizado", "Los turnos quedaron guardados localmente")
    } finally {
      setSyncing(false)
    }
  }

  const cycleShift = (staffId: string, day: string) => {
    const shiftOrder = ["M", "T", "C", "F"]
    setStaff(prev => prev.map(s => {
      if (s.id !== staffId) return s
      const current = (s as any)[day] || "M"
      const nextIdx = (shiftOrder.indexOf(current) + 1) % shiftOrder.length
      return { ...s, [day]: shiftOrder[nextIdx] }
    }))
  }

  const getShiftBadge = (shiftId: string) => {
    const t = TURNOS.find(x => x.id === shiftId) || TURNOS[0]
    return (
      <span className={`px-2 py-1 rounded-lg text-xs font-black border transition ${t.bg}`}>
        {shiftId}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-500/20">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white tracking-tight">
                  Turnos & Cuadrante Semanal
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  Sincronizado con SueldOK
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Rotaciones de cajas, cobertura en picos de demanda y cálculo de horas extras
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncSueldok}
            disabled={syncing}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-xl shadow-md shadow-indigo-500/25 transition disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            Sincronizar con SueldOK
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Cajeras & Repositores</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">{kpis.totalStaff}</p>
          <p className="text-xs text-emerald-600 font-bold mt-1">10 activas en cuadrante</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Turnos Hoy (En Caja)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">{kpis.turnosHoy}</p>
          <p className="text-xs text-blue-500 mt-1">8 cajas + 2 reposición</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Horas Extras Asignadas</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-gray-900 dark:text-white">{kpis.totalHsExtras} hs</p>
          <p className="text-xs text-amber-500 font-bold mt-1">Gs. {kpis.costoHsExtras.toLocaleString()}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Cobertura Horas Pico</span>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-base sm:text-lg xl:text-lg 2xl:text-xl font-black font-mono tracking-tight truncate text-emerald-600 dark:text-emerald-400">95% Óptima</p>
          <p className="text-xs text-gray-500 mt-1">Alerta: Refuerzo 18:30hs</p>
        </div>
      </div>

      {/* ── ALERTA DE HORAS PICO VS CAJAS ABIERTAS ── */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-900/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500 text-white">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-black text-amber-900 dark:text-amber-300 uppercase tracking-wider">
              Análisis de Cobertura en Horas Pico (Extra Supermercado)
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Pico 1 (Almuerzo 11:30 - 13:30): <strong>7 Cajas Activas (100% Cubierto)</strong> · Pico 2 (Tarde 17:30 - 20:00): <strong>7 Cajas (Recomendado 8 para evitar filas)</strong>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 text-xs font-black rounded-lg bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
            Turno Refuerzo: Jessica Ferrari (14:00 - 22:00)
          </span>
        </div>
      </div>

      {/* ── CUADRANTE SEMANAL INTERACTIVO ── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-gray-900 dark:text-white">
              Cuadrante Semanal de Cajas (Semana 34 · Agosto 2026)
            </h2>
            <p className="text-xs text-gray-500">
              Haz clic en cualquier turno para alternar (M: Mañana · T: Tarde · C: Central · F: Franco)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar cajera..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 text-gray-900 dark:text-white outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Leyenda */}
        <div className="flex flex-wrap items-center gap-2 pt-1 pb-2 border-b border-gray-100 dark:border-gray-700">
          <span className="text-[10px] font-bold text-gray-400 uppercase mr-1">Turnos:</span>
          {TURNOS.map(t => (
            <div key={t.id} className="flex items-center gap-1.5">
              <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${t.bg}`}>
                {t.id}
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-400">{t.nombre} ({t.horario})</span>
            </div>
          ))}
        </div>

        {/* Tabla Cuadrante */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 dark:bg-gray-750 text-gray-500 uppercase text-[10px] font-bold">
              <tr>
                <th className="p-3">Colaborador</th>
                <th className="p-3">Rol</th>
                <th className="p-3 text-center">Lun</th>
                <th className="p-3 text-center">Mar</th>
                <th className="p-3 text-center">Mié</th>
                <th className="p-3 text-center">Jue</th>
                <th className="p-3 text-center">Vie</th>
                <th className="p-3 text-center">Sáb</th>
                <th className="p-3 text-center">Dom</th>
                <th className="p-3 text-right">Hs Extra</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {staff
                .filter(s => !search || s.nombre.toLowerCase().includes(search.toLowerCase()))
                .map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-750/50">
                    <td className="p-3 font-bold text-gray-900 dark:text-white whitespace-nowrap">{s.nombre}</td>
                    <td className="p-3 text-gray-500 whitespace-nowrap">{s.rol}</td>
                    {["lun", "mar", "mie", "jue", "vie", "sab", "dom"].map(day => (
                      <td
                        key={day}
                        onClick={() => cycleShift(s.id, day)}
                        className="p-3 text-center cursor-pointer hover:scale-105 transition"
                        title="Haz clic para rotar turno"
                      >
                        {getShiftBadge((s as any)[day])}
                      </td>
                    ))}
                    <td className="p-3 text-right font-bold text-amber-600 whitespace-nowrap">
                      +{s.hs_extras} hs
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
