/**
 * Validaciones fiscales paraguayas
 */

/**
 * Valida RUC paraguayo
 * Formato: XXXXXXXX-X (8 dígitos + guion + dígito verificador)
 * Personas jurídicas: empiezan con 80
 * Personas físicas: empiezan con CI + dígito
 */
export function validarRUC(ruc: string): boolean {
  const clean = ruc.replace(/[-.\s]/g, "")
  if (!/^\d{8,9}$/.test(clean)) return false

  const body = clean.slice(0, -1)
  const dv = parseInt(clean.slice(-1), 10)

  // Algoritmo módulo 11
  const weights = body.length === 8
    ? [2, 3, 4, 5, 6, 7, 2, 3]
    : [2, 3, 4, 5, 6, 7, 2, 3, 4]

  let sum = 0
  for (let i = 0; i < body.length; i++) {
    sum += parseInt(body[i], 10) * weights[i]
  }

  const remainder = sum % 11
  const expected = remainder === 0 ? 0 : remainder === 1 ? 1 : 11 - remainder

  return expected === dv
}

/**
 * Formatea RUC con guion
 */
export function formatRUC(ruc: string): string {
  const clean = ruc.replace(/[^0-9]/g, "")
  if (clean.length === 9) return `${clean.slice(0, 8)}-${clean[8]}`
  return ruc
}

/**
 * Valida Cédula de Identidad paraguaya
 * Formato: 1,000,000 a 9,999,999
 */
export function validarCI(ci: string): boolean {
  const clean = ci.replace(/[-.\s]/g, "")
  if (!/^\d{6,8}$/.test(clean)) return false
  const num = parseInt(clean, 10)
  return num >= 100000 && num <= 99999999
}

/**
 * Formatea CI con puntos
 */
export function formatCI(ci: string): string {
  const clean = ci.replace(/[^0-9]/g, "")
  if (clean.length > 6) {
    return `${clean.slice(0, 1)},${clean.slice(1, 4)},${clean.slice(4)}`
  }
  return ci
}

/**
 * Valida CDC (Código de Control Digital SIFEN)
 * 44 caracteres hexadecimales
 */
export function validarCDC(cdc: string): boolean {
  return /^[0-9A-Fa-f]{44}$/.test(cdc)
}

/**
 * Valida timbrado SET
 * Formato: XXX-XXX-XXXXXXXX (3-3-8 dígitos)
 */
export function validarTimbrado(timbrado: string): boolean {
  return /^\d{3}-\d{3}-\d{7,8}$/.test(timbrado)
}

/**
 * Valida teléfono paraguayo
 * Fijo: 0XX-XXXXXX, Celular: 09XX-XXXXXX
 */
export function validarTelefono(tel: string): boolean {
  const clean = tel.replace(/[-.\s()]/g, "")
  return /^(0[0-9]{2,3})?[0-9]{6,9}$/.test(clean)
}

/**
 * Calcula el dígito verificador de RUC
 */
export function calcularDV(body: string): number {
  const clean = body.replace(/[^0-9]/g, "")
  const weights = clean.length === 7
    ? [2, 3, 4, 5, 6, 7, 2]
    : [2, 3, 4, 5, 6, 7, 2, 3]

  let sum = 0
  for (let i = 0; i < clean.length; i++) {
    sum += parseInt(clean[i], 10) * weights[i]
  }

  const remainder = sum % 11
  if (remainder === 0) return 0
  if (remainder === 1) return 1
  return 11 - remainder
}

/**
 * Clasifica tipo de contribuyente según RUC
 */
export function tipoContribuyente(ruc: string): string {
  const clean = ruc.replace(/[^0-9]/g, "")
  if (clean.startsWith("80")) return "juridica"
  if (clean.startsWith("90")) return "temporal"
  if (clean.startsWith("60")) return "diplomatico"
  return "fisica"
}

/**
 * Calcula IVA según tasa paraguaya
 */
export function calcularIVA(monto: number, tasa: 0 | 5 | 10): { base: number; iva: number; total: number } {
  if (tasa === 0) return { base: monto, iva: 0, total: monto }
  const divisor = 1 + (tasa / 100)
  const base = Math.round(monto / divisor)
  const iva = monto - base
  return { base, iva, total: monto }
}

/**
 * Calcula base gravada desde el total (IVA incluido)
 */
export function baseGravada(total: number, tasa: 0 | 5 | 10): number {
  if (tasa === 0) return total
  return Math.round(total / (1 + tasa / 100))
}
