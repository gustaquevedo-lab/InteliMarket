/**
 * Envoltorios de las llamadas a los terminales de cobro (Bancard y Dinelco).
 * Devuelven EXACTAMENTE lo mismo que la llamada original; lo unico que agregan
 * es avisarle al monitor cuando algo falla por causa del equipo o de la red
 * (no cuando el cliente cancela o el banco rechaza la tarjeta, que es normal).
 */
import { captureIntegration } from "./index"

const NORMAL = /USER CANCEL|CANCEL|RECHAZAD|DENEGAD|FONDOS|INSUFICIENT|DECLINED/i

export async function imDinelco(api: any, ip: string, tipo: string, params: any, sessionId: any, timeoutMs?: number) {
  const t0 = performance.now()
  let res: any
  try {
    res = await api.dinelcoCall(ip, tipo, params, sessionId, timeoutMs)
  } catch (e: any) {
    captureIntegration({ provider: "dinelco", op: tipo, code: "excepcion", message: String(e?.message || e), duration_ms: Math.round(performance.now() - t0), extra: { ip } })
    throw e
  }
  try {
    if (res && res.ok === false) {
      const ms = Math.round(performance.now() - t0)
      if (res.error) {
        // sin respuesta o conexion caida con el terminal
        captureIntegration({ provider: "dinelco", op: tipo, code: String(res.error), message: `Sin respuesta del terminal (${res.error})`, level: "error", duration_ms: ms, extra: { ip } })
      } else {
        const code = [res.code, res.desc].filter(Boolean).join(" ")
        if (!NORMAL.test(code)) {
          const grave = /CANT CONNECT|-90|TIMEOUT/i.test(code)
          captureIntegration({ provider: "dinelco", op: tipo, code: code || "NOK", message: `El terminal respondió: ${code || "NOK"}`, level: grave ? "error" : "warning", duration_ms: ms, extra: { ip } })
        }
      }
    }
  } catch { /* el monitor nunca rompe el cobro */ }
  return res
}

export async function imBancard(api: any, ip: string, path: string, body: any, timeoutMs?: number) {
  const t0 = performance.now()
  let res: any
  try {
    res = await api.bancardCall(ip, path, body, timeoutMs)
  } catch (e: any) {
    captureIntegration({ provider: "bancard", op: path, code: "excepcion", message: String(e?.message || e), duration_ms: Math.round(performance.now() - t0), extra: { ip } })
    throw e
  }
  try {
    if (res && res.ok === false) {
      const ms = Math.round(performance.now() - t0)
      if (res.status == null) {
        captureIntegration({ provider: "bancard", op: path, code: String(res.message || "sin_respuesta"), message: `Sin respuesta del terminal (${res.message || "sin_respuesta"})`, level: "error", duration_ms: ms, extra: { ip } })
      } else if (res.status >= 500) {
        const msg = String(res.body?.message || `HTTP ${res.status}`)
        if (!NORMAL.test(msg)) {
          captureIntegration({ provider: "bancard", op: path, code: `${res.status} ${msg}`.slice(0, 120), message: `El terminal respondió ${res.status}: ${msg}`, level: "warning", duration_ms: ms, extra: { ip } })
        }
      }
    }
  } catch { /* el monitor nunca rompe el cobro */ }
  return res
}
