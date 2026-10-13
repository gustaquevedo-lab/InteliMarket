// Autorizacion de supervisor 100% offline -- ver memoria
// "pendiente-autorizacion-supervisor-offline". Los 12 flujos del POS que
// piden aprobacion de un supervisor (anular item, descuento directo, Extra
// Club, devoluciones, reapertura de venta, etc.) dependian por completo de
// un round-trip al servidor (verify-supervisor o supervisor_auth_requests) --
// si la API esta caida o reiniciando (pasa seguido en desarrollo activo),
// ninguna autorizacion funcionaba, contradiciendo el objetivo de que la caja
// sea realmente autonoma.
//
// Este modulo cachea localmente (IndexedDB, via offlineDB.supervisorPins) el
// hash bcrypt del PIN corto de cada supervisor/admin, sincronizado en
// segundo plano cuando hay conexion, y verifica el PIN 100% en el cliente
// (bcryptjs) sin pegarle a la API para autorizar en el momento.
import bcrypt from "bcryptjs"
import { api } from "../api"
import { offlineDB, type SupervisorPin } from "./offlineDB"

let syncing = false

/** Trae los hashes de PIN vigentes del servidor y los cachea localmente.
 * Se llama en segundo plano (login, ciclo periodico de syncManager) -- si
 * falla (sin conexion), simplemente deja el cache anterior como esta. */
export async function syncSupervisorPins(): Promise<void> {
  if (syncing) return
  syncing = true
  try {
    const res = await api.auth.posSupervisorPins()
    const pins: SupervisorPin[] = (res.supervisors || []).map((s) => ({
      id: s.id, nombre: s.nombre, rol: s.rol, pin_hash: s.pin_hash,
      synced_at: new Date().toISOString(),
    }))
    await offlineDB.supervisorPins.setAll(pins)
  } catch (e) {
    console.warn("[localAuth] No se pudo sincronizar PINs de supervisor (se mantiene el cache local):", e)
  } finally {
    syncing = false
  }
}

export interface LocalAuthResult {
  valid: boolean
  id?: string
  nombre?: string
  rol?: string
  offline?: boolean
}

/** Verifica un PIN contra el cache local, sin tocar la red. Si se pasa
 * supervisorId, compara solo contra ese registro (flujo normal: la cajera
 * ya eligio "quien autoriza" de una lista); si no, prueba contra todos los
 * cacheados (fallback cuando no hay selector previo). */
export async function verifySupervisorPinLocal(pin: string, supervisorId?: string): Promise<LocalAuthResult> {
  if (!/^\d{4,6}$/.test(pin)) return { valid: false }
  let cached: SupervisorPin[] = []
  try {
    cached = await offlineDB.supervisorPins.getAll()
  } catch {
    return { valid: false }
  }
  if (cached.length === 0) return { valid: false }

  const candidates = supervisorId ? cached.filter((c) => c.id === supervisorId) : cached
  for (const c of candidates) {
    try {
      const ok = await bcrypt.compare(pin, c.pin_hash)
      if (ok) return { valid: true, id: c.id, nombre: c.nombre, rol: c.rol, offline: true }
    } catch {
      // hash corrupto o formato inesperado -- seguir probando el resto
    }
  }
  return { valid: false }
}

/** Hay al menos un PIN cacheado -- usarse para decidir si mostrar la opcion
 * de PIN local en la UI, o si hace falta caer directo al flujo con clave. */
export async function hasSupervisorPinsCached(): Promise<boolean> {
  try {
    const cached = await offlineDB.supervisorPins.getAll()
    return cached.length > 0
  } catch {
    return false
  }
}
