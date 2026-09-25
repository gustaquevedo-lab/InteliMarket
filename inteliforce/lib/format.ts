// lib/format.ts
import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Formatea un número con separadores de miles de puntos (ej: 1250000 -> "1.250.000").
 * Garantizado independiente del motor JS (Hermes/JSC/V8).
 */
export function formatThousands(value: number | string | null | undefined): string {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return '0';
  }
  const integerPart = Math.round(Number(value));
  return integerPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Formatea un monto en Guaraníes (₲) con separador de miles estricto y sin decimales.
 * Ejemplos:
 *   formatGS(8500) -> "₲ 8.500"
 *   formatGS(1250000) -> "₲ 1.250.000"
 */
export function formatGS(amount: number | string | null | undefined): string {
  return `₲ ${formatThousands(amount)}`;
}

/**
 * Formato de fecha estándar: "31/12/2026"
 */
export function formatDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  const d = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
  if (!isValid(d)) return '-';
  return format(d, 'dd/MM/yyyy');
}

/**
 * Formato de hora estándar: "14:30"
 */
export function formatTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  const d = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
  if (!isValid(d)) return '-';
  return format(d, 'HH:mm');
}

/**
 * Formato relativo amigable: "hace 10 minutos", "ayer", etc.
 */
export function formatRelativeTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  const d = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
  if (!isValid(d)) return '-';
  return formatDistanceToNow(d, { addSuffix: true, locale: es });
}
