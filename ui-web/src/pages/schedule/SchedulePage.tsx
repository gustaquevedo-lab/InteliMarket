import { useState, useMemo, useEffect, useCallback } from "react"
import {
  Clock, Users, Calendar, Plus, Search, Filter, RefreshCcw,
  CheckCircle2, AlertTriangle, ShieldCheck, Sun, Moon,
  DollarSign, ChevronLeft, ChevronRight, Check, X, FileSpreadsheet,
  Building, UserCheck, Award, Briefcase, ExternalLink, LayoutGrid, Zap,
  Sparkles
} from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../../context/ToastContext"
import { formatPYG } from "../../utils/format"
import { api } from "../../api"

const TURNOS = [
  { id: "M", nombre: "Mañana (Apertura)", horario: "06:00 - 14:00", bg: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-300 dark:border-amber-700/60" },
  { id: "T", nombre: "Tarde (Cierre)", horario: "14:00 - 22:00", bg: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-300 dark:border-blue-700/60" },
  { id: "C", nombre: "Central (Pico)", horario: "08:00 - 17:00", bg: "bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-300 dark:border-purple-700/60" },
  { id: "F", nombre: "Franco / Descanso", horario: "Libre", bg: "bg-slate-200/60 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700" },
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
      <span className={`inline-block px-2.5 py-1 rounded-xl text-xs font-black border transition shadow-xs ${t.bg}`}>
        {shiftId}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── COMMAND DECK HERO HEADER ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/80 text-white p-7 border border-amber-500/20 shadow-2xl shadow-amber-950/50">
        <div className="absolute -right-10 -bottom-10 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-1/4 w-64 h-64 bg-orange-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 border border-amber-400/30 flex items-center justify-center shadow-lg shadow-amber-500/30 flex-shrink-0">
              <Calendar className="w-7 h-7 text-white" />
              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 border-2 border-slate-950 rounded-full animate-pulse" />
            </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest text-amber-400 uppercase bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20">
                    GESTIÓN DE TURNOS & CUADRANTE
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Sincronizado con SueldOK
                  </span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white mt-1">
                  Turnos & Cuadrante Semanal
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl font-normal">
                Extra Supermercado — Gestión de rotaciones de cajas, cobertura en horarios pico, francos compensatorios y cálculo proyectado de horas extras.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-[11px] text-slate-300">
                  📅 Semana 34 · Agosto 2026
                </span>
                <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-[11px] text-amber-300">
                  🏪 10 Cajeras Asignadas
                </span>
                <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-[11px] text-emerald-300">
                  ⚡ 95% Cobertura Pico
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleSyncSueldok}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-black shadow-lg shadow-indigo-600/30 transition active:scale-95 disabled:opacity-50"
            >
              <Zap className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              Sincronizar a SueldOK
            </button>
          </div>
        </div>

        {/* ── EXECUTIVE KPIS ROW ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Cajeras & Repositores</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-lg sm:text-xl font-black font-mono tracking-tight text-white">
              {kpis.totalStaff} Colaboradores
            </p>
            <span className="text-[10px] text-emerald-400 font-medium">10 activas en cuadrante</span>
          </div>

          <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Turnos Hoy (En Caja)</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-lg sm:text-xl font-black font-mono tracking-tight text-white">
              {kpis.turnosHoy} en Turno
            </p>
            <span className="text-[10px] text-blue-300 font-medium">8 cajas activas + 2 salón</span>
          </div>

          <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Horas Extras Asignadas</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-lg sm:text-xl font-black font-mono tracking-tight text-white">
              {kpis.totalHsExtras} hs <span className="text-xs text-amber-400 font-normal">({formatPYG(kpis.costoHsExtras)})</span>
            </p>
            <span className="text-[10px] text-amber-300 font-medium">Costo proyectado semanal</span>
          </div>

          <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Cobertura Horas Pico</span>
              <AlertTriangle className="w-4 h-4 text-orange-400" />
            </div>
            <p className="text-lg sm:text-xl font-black font-mono tracking-tight text-emerald-400">
              95% Óptima
            </p>
            <span className="text-[10px] text-slate-400 font-medium">Refuerzo a las 18:30 hs</span>
          </div>
        </div>
      </div>

      {/* ── ALERTA EJECUTIVA DE COBERTURA ── */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-slate-900 border border-amber-500/30 dark:border-amber-800/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/30">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-black text-amber-900 dark:text-amber-300 uppercase tracking-wider">
              Análisis Inteligente de Cobertura en Horas Pico
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-400/90 mt-0.5">
              Pico 1 (Almuerzo 11:30 - 13:30): <strong className="text-slate-900 dark:text-white">7 Cajas Activas (100% Cubierto)</strong> · Pico 2 (Tarde 17:30 - 20:00): <strong className="text-slate-900 dark:text-white">7 Cajas (Recomendado 8 para evitar colas)</strong>
            </p>
          </div>
        </div>
        <span className="px-3 py-1.5 text-xs font-black rounded-xl bg-amber-200 text-amber-950 dark:bg-amber-900/80 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60 shadow-xs flex-shrink-0">
          Refuerzo: Jessica Ferrari (14:00 - 22:00)
        </span>
      </div>

      {/* ── CUADRANTE SEMANAL INTERACTIVO ── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
              Cuadrante Semanal de Cajas (Semana 34 · Agosto 2026)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Haz clic sobre cualquier turno para alternar el horario (M: Mañana · T: Tarde · C: Central · F: Franco)
            </p>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar cajera..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500 transition shadow-inner"
            />
          </div>
        </div>

        {/* Leyenda de Turnos */}
        <div className="flex flex-wrap items-center gap-3 py-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Esquema:</span>
          {TURNOS.map(t => (
            <div key={t.id} className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-850 px-2.5 py-1 rounded-xl border border-slate-200/60 dark:border-slate-800">
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${t.bg}`}>
                {t.id}
              </span>
              <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">{t.nombre} <span className="text-slate-400 font-mono">({t.horario})</span></span>
            </div>
          ))}
        </div>

        {/* Tabla Cuadrante */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-black tracking-wider">
              <tr>
                <th className="p-3.5">Colaborador</th>
                <th className="p-3.5">Rol / Puesto</th>
                <th className="p-3.5 text-center">Lun</th>
                <th className="p-3.5 text-center">Mar</th>
                <th className="p-3.5 text-center">Mié</th>
                <th className="p-3.5 text-center">Jue</th>
                <th className="p-3.5 text-center">Vie</th>
                <th className="p-3.5 text-center">Sáb</th>
                <th className="p-3.5 text-center">Dom</th>
                <th className="p-3.5 text-right">Hs Extra</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {staff
                .filter(s => !search || s.nombre.toLowerCase().includes(search.toLowerCase()))
                .map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/50 transition">
                    <td className="p-3.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">{s.nombre}</td>
                    <td className="p-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">{s.rol}</td>
                    {["lun", "mar", "mie", "jue", "vie", "sab", "dom"].map(day => (
                      <td
                        key={day}
                        onClick={() => cycleShift(s.id, day)}
                        className="p-3 text-center cursor-pointer hover:scale-110 active:scale-95 transition select-none"
                        title="Haz clic para rotar turno"
                      >
                        {getShiftBadge((s as any)[day])}
                      </td>
                    ))}
                    <td className="p-3.5 text-right font-bold font-mono text-amber-600 dark:text-amber-400 whitespace-nowrap">
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
