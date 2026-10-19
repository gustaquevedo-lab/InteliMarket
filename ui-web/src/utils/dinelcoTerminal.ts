/**
 * Terminal Dinelco/Bepsa -- POS Android/Feitian por REST ("Manual de Integración
 * Feitian Bepsa" v1.0.5): HTTP + JSON, puerto 9000. Los Ingenico viejos (TCP 9600,
 * electron/dinelco-client.cjs) ya no existen en las cajas.
 *
 * Expone la misma interfaz que tenía el puente de Electron (dinelcoCall /
 * dinelcoCancel, mismo formato de respuesta) para que el POS casi no cambie.
 *
 * El REST va desde la pantalla (fetch) y no desde Electron a propósito: así no
 * hace falta redistribuir la app de caja en cada PC; la página ya corre con
 * webSecurity desactivado, que es lo que deja llamar al terminal en la red local.
 */

const REST_PORT = 9000

interface DinelcoRes {
  ok: boolean
  sessionId?: string | null
  comando?: string
  campos?: string[]
  data?: any
  code?: string | null
  desc?: string
  error?: string
}

// Sesión REST = lo que devolvió el paso 1 (bin/nsu), a la espera del paso 2.
const sesiones = new Map<string, { ip: string; bin: string; nsu: string; monto: number }>()

interface HttpRes { ok: boolean; status: number | null; body: any; error?: string }

async function post(ip: string, path: string, body: unknown, timeoutMs: number): Promise<HttpRes> {
  const ctrl = new AbortController()
  // Plazo duro: pase lo que pase la promesa se resuelve (mismo criterio que el
  // puente de Bancard -- un terminal que deja la conexión abierta no puede
  // congelar la pantalla de cobro).
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`http://${ip}:${REST_PORT}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: ctrl.signal,
    })
    const text = await res.text()
    let parsed: any = null
    try { parsed = text ? JSON.parse(text) : null } catch { parsed = null }
    return { ok: res.ok, status: res.status, body: parsed }
  } catch (e: any) {
    return { ok: false, status: null, body: null, error: e?.name === "AbortError" ? "timeout" : "sin_conexion" }
  } finally {
    clearTimeout(timer)
  }
}

function errorHttp(r: HttpRes): DinelcoRes {
  if (r.status === null) return { ok: false, error: r.error || "sin_conexion" }
  const b = r.body || {}
  return { ok: false, code: String(b.statusCode ?? r.status), desc: b.message || b.error || `Error ${r.status} del terminal` }
}

/** Respuesta aprobada del terminal -> mismo orden de campos que el protocolo TCP:
 *  AUTHCODE|AUTHORIZER|OPTYPE|BOLETA|TERMINAL|COMERCIO|ULTIMOS4|PUNTOS */
function aprobada(b: any, comando: string): DinelcoRes {
  const pan = String(b?.pan || b?.card || "")
  const ultimos4 = /\d{4}$/.test(pan) ? pan.slice(-4) : ""
  return {
    ok: true,
    comando,
    campos: [
      String(b.codigoAutorizacion ?? ""), String(b.issuerId ?? b.nombreTarjeta ?? ""), String(b.paymentTypeId ?? ""),
      String(b.nroReferencia ?? ""), String(b.terminal ?? ""), String(b.codigoComercio ?? ""), ultimos4, "",
    ],
    data: b,
  }
}

function nuevoId() {
  return `rest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

async function restCall(ip: string, tipo: string, params: any, sessionId: string | null | undefined, timeoutMs?: number): Promise<DinelcoRes> {
  const t = timeoutMs || 90_000
  const p = params || {}
  const monto = Math.round(Number(p.monto || 0))

  switch (tipo) {
    case "venta_inicio": {
      // En REST las cuotas se piden en el paso 1 (/pos/venta/cuotas); en el
      // protocolo TCP iban en el paso 2. Contado = sin cuotas o cuotas 1.
      const cuotas = Number(p.cuotas || 0)
      const conCuotas = cuotas > 1
      const r = await post(ip, conCuotas ? "/pos/venta/cuotas" : "/pos/venta/contado",
        conCuotas ? { facturaNro: Date.now(), monto, cuotas } : { facturaNro: Date.now(), monto }, t)
      if (!r.ok) return errorHttp(r)
      const { bin, nsu } = r.body || {}
      if (nsu === undefined || nsu === null || nsu === "") return { ok: false, error: "respuesta_sin_nsu" }
      const id = nuevoId()
      sesiones.set(id, { ip, bin: String(bin ?? ""), nsu: String(nsu), monto })
      return { ok: true, sessionId: id, comando: "venta", campos: [String(bin ?? ""), String(nsu)], data: r.body }
    }
    case "venta_confirmar": {
      const s = sessionId ? sesiones.get(sessionId) : undefined
      if (!s) return { ok: false, error: "sesion_inexistente" }
      sesiones.delete(sessionId as string)
      // Sin descuento por BIN el monto del paso 2 es el mismo del paso 1.
      const r = await post(s.ip, "/pos/descuento", { bin: s.bin, nsu: s.nsu, monto: monto || s.monto }, t)
      if (!r.ok) return errorHttp(r)
      // Un 200 sin código de autorización NO se da por aprobado: va por la vía
      // "ambigua" (revisar el terminal / cargar el cupón a mano).
      if (!r.body?.codigoAutorizacion) return { ok: false, error: "respuesta_sin_autorizacion", desc: r.body?.mensajeDisplay }
      return aprobada(r.body, "descuento")
    }
    case "qr": {
      // /pos/venta/qr-din va directo al QR Dinelco. El genérico /pos/venta/qr deja en el terminal la
      // pantalla de elección (SIP / QR / PIX / QR Arg) y nadie la toca: vence a los ~100 s con
      // "REINTENTE LA TRANSACCION" (probado con un POS de prueba el 19-oct-2026).
      const r = await post(ip, "/pos/venta/qr-din", { facturaNro: Date.now(), monto }, t)
      if (!r.ok) return errorHttp(r)
      if (!r.body?.codigoAutorizacion) return { ok: false, error: "respuesta_sin_autorizacion", desc: r.body?.mensajeDisplay }
      return aprobada(r.body, "venta_qr")
    }
    case "pix": {
      const r = await post(ip, "/pos/venta/qr-pix", { facturaNro: Date.now(), monto, pixCpf: String(p.cpf || "") }, t)
      if (!r.ok) return errorHttp(r)
      if (!r.body?.codigoAutorizacion) return { ok: false, error: "respuesta_sin_autorizacion", desc: r.body?.mensajeDisplay }
      return aprobada(r.body, "venta_qr_pix")
    }
    default:
      return { ok: false, error: `operacion_no_soportada_rest: ${tipo}` }
  }
}

/** ¿Esta pantalla puede hablar con un terminal? Solo corre dentro de la app de caja (Electron). */
export function dinelcoDisponible(): boolean {
  return typeof window !== "undefined" && !!(window as any).electronAPI
}

export const dinelcoApi = {
  dinelcoCall(ip: string, tipo: string, params: any, sessionId?: string | null, timeoutMs?: number): Promise<DinelcoRes> {
    return restCall(ip, tipo, params, sessionId, timeoutMs)
  },

  /** El manual no define "cancelar": solo se descarta la sesión. Si quedó una operación a medias
   *  se cancela en la pantalla del propio terminal. */
  async dinelcoCancel(sessionId: string | null | undefined): Promise<{ ok: boolean }> {
    if (sessionId) sesiones.delete(sessionId)
    return { ok: true }
  },
}

/** CPF brasileño: 11 dígitos y dígitos verificadores correctos. El terminal rechaza un CPF inválido
 *  con un "REINTENTE LA TRANSACCION" que no dice nada; esto lo atrapa antes de mandarlo. */
export function cpfValido(valor: string): boolean {
  const d = (valor || "").replace(/\D/g, "")
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const dv = (n: number) => {
    let suma = 0
    for (let i = 0; i < n; i++) suma += Number(d[i]) * (n + 1 - i)
    const r = (suma * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10])
}
