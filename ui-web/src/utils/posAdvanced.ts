/**
 * POS Advanced Features Engine
 * Promotions, Loyalty, X/Z Reports, Kitchen Display, Multi-POS Sync
 */

import { api } from "../api"

// ==================== PROMOTIONS ENGINE ====================

export type PromotionType = "2x1" | "pct_discount" | "fixed_discount" | "combo" | "happy_hour"

export interface Promotion {
  id: string
  nombre: string
  tipo: PromotionType
  aplica_a: string[]       // product IDs
  condicion: string          // "todos" | "min_qty:3" | "horario:18-20" | "dia:lunes"
  valor: number              // discount % or fixed amount
  stackable: boolean
  activo: boolean
}

export interface AppliedPromotion {
  promotion: Promotion
  descripcion: string
  descuento: number
}

const HAPPY_HOUR_PROMOS: Promotion[] = [
  { id: "hh-default", nombre: "Happy Hour 18-20", tipo: "happy_hour", aplica_a: [], condicion: "horario:18-20", valor: 10, stackable: false, activo: true },
]

export function getActivePromotions(now: Date = new Date()): Promotion[] {
  const promos: Promotion[] = []
  for (const p of HAPPY_HOUR_PROMOS) {
    if (!p.activo) continue
    if (p.condicion.startsWith("horario:")) {
      const [h1, h2] = p.condicion.replace("horario:", "").split("-").map(Number)
      if (now.getHours() >= h1 && now.getHours() < h2) promos.push(p)
    }
  }
  return promos
}

export function applyPromotions(
  items: Array<{ id: string; nombre: string; precio: number; cantidad: number }>,
  customPromos: Promotion[] = [],
): { applied: AppliedPromotion[]; totalDiscount: number; description: string } {
  const allPromos = [...getActivePromotions(), ...customPromos]
  const applied: AppliedPromotion[] = []
  let totalDiscount = 0

  for (const promo of allPromos) {
    if (promo.tipo === "pct_discount") {
      const d = Math.round(items.reduce((s, i) => s + i.precio * i.cantidad, 0) * promo.valor / 100)
      totalDiscount += d
      applied.push({ promotion: promo, descripcion: `${promo.nombre}`, descuento: d })
    } else if (promo.tipo === "2x1" && promo.aplica_a.length > 0) {
      for (const pid of promo.aplica_a) {
        const item = items.find(i => i.id === pid)
        if (item && item.cantidad >= 2) {
          const free = Math.floor(item.cantidad / 2) * item.precio
          totalDiscount += free
          applied.push({ promotion: promo, descripcion: `2x1 en ${item.nombre}`, descuento: free })
        }
      }
    }
  }

  return { applied, totalDiscount, description: applied.map(a => a.descripcion).join(" + ") || "" }
}

// ==================== LOYALTY POINTS ====================

export interface LoyaltyAccount {
  customer_id: string
  puntos: number
  historial: Array<{ fecha: string; tipo: "acumulado" | "canjeado"; puntos: number; venta_id?: string }>
}

export function calculatePoints(total: number): number {
  return Math.floor(total / 10000)  // 1 punto por cada 10,000 Gs
}

export function pointsToDiscount(puntos: number): number {
  return puntos * 100  // 1 punto = 100 Gs
}

// ==================== X/Z REPORTS ====================

export interface ShiftReport {
  tipo: "X" | "Z"
  fecha_apertura: string
  fecha_cierre: string
  cajero: string
  sucursal: string
  ventas: {
    total_ventas: number
    total_cobrado: number
    ticket_promedio: number
    cantidad: number
  }
  por_metodo: Record<string, { cantidad: number; total: number }>
  impuestos: { iva_10: number; iva_5: number; exento: number }
  descuentos_aplicados: number
  efectivo_en_caja: number
  diferencia: number
  ventas_canceladas: number
}

export function generateShiftReport(
  tipo: "X" | "Z",
  salesData: Array<{ total: number; payment_method: string; iva_10: number; iva_5: number; estado: string; descuento: number }>,
  cashInDrawer: number,
  cashierName: string,
  branchName: string,
  fechaApertura: Date,
): ShiftReport {
  const confirmadas = salesData.filter(s => s.estado !== "cancelado")
  const canceladas = salesData.filter(s => s.estado === "cancelado")
  const totalVentas = confirmadas.reduce((s, v) => s + v.total, 0)
  const totalCobrado = confirmadas.reduce((s, v) => s + v.total, 0)
  const porMetodo: Record<string, { cantidad: number; total: number }> = {}

  for (const s of confirmadas) {
    const method = s.payment_method || "otros"
    if (!porMetodo[method]) porMetodo[method] = { cantidad: 0, total: 0 }
    porMetodo[method].cantidad++
    porMetodo[method].total += s.total
  }

  const efectivo = porMetodo["efectivo"]?.total || 0
  const diferencia = cashInDrawer - efectivo

  return {
    tipo,
    fecha_apertura: fechaApertura.toISOString(),
    fecha_cierre: new Date().toISOString(),
    cajero: cashierName,
    sucursal: branchName,
    ventas: {
      total_ventas: totalVentas,
      total_cobrado: totalCobrado,
      ticket_promedio: confirmadas.length > 0 ? Math.round(totalVentas / confirmadas.length) : 0,
      cantidad: confirmadas.length,
    },
    por_metodo: porMetodo,
    impuestos: {
      iva_10: confirmadas.reduce((s, v) => s + (v.iva_10 || 0), 0),
      iva_5: confirmadas.reduce((s, v) => s + (v.iva_5 || 0), 0),
      exento: 0,
    },
    descuentos_aplicados: confirmadas.reduce((s, v) => s + (v.descuento || 0), 0),
    efectivo_en_caja: cashInDrawer,
    diferencia,
    ventas_canceladas: canceladas.length,
  }
}

export function formatShiftReport(report: ShiftReport): string {
  const pm = Object.entries(report.por_metodo).map(([m, d]) => `${m}: ${d.cantidad} ventas, Gs. ${d.total.toLocaleString()}`).join("\n  ")
  return `REPORTE ${report.tipo}
==============================
Sucursal: ${report.sucursal}
Cajero: ${report.cajero}
Apertura: ${new Date(report.fecha_apertura).toLocaleString("es-PY")}
Cierre: ${new Date(report.fecha_cierre).toLocaleString("es-PY")}
==============================
VENTAS: ${report.ventas.cantidad}
TOTAL: Gs. ${report.ventas.total_ventas.toLocaleString()}
TICKET PROM: Gs. ${report.ventas.ticket_promedio.toLocaleString()}
==============================
POR MÉTODO:
  ${pm}
==============================
IMPUESTOS:
  IVA 10%: Gs. ${report.impuestos.iva_10.toLocaleString()}
  IVA 5%: Gs. ${report.impuestos.iva_5.toLocaleString()}
==============================
DESCUENTOS: Gs. ${report.descuentos_aplicados.toLocaleString()}
CANCELADAS: ${report.ventas_canceladas}
==============================
EFECTIVO EN CAJA: Gs. ${report.efectivo_en_caja.toLocaleString()}
DIFERENCIA: Gs. ${report.diferencia.toLocaleString()}
`
}

// ==================== KITCHEN DISPLAY ====================

export interface KitchenOrder {
  id: string
  mesa?: string
  items: Array<{ nombre: string; cantidad: number; notas?: string }>
  timestamp: string
  estado: "pendiente" | "preparando" | "listo" | "entregado"
}

// ==================== MULTI-POS SYNC (SSE) ====================

export function useStockSync(onUpdate: (productId: string, newStock: number) => void) {
  const eventSource = new EventSource(`${import.meta.env.VITE_API_URL || "/api"}/v1/events/stream`)

  eventSource.addEventListener("stock_update", (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data)
      onUpdate(data.product_id, data.stock)
    } catch {}
  })

  eventSource.addEventListener("sale_completed", (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data)
      if (data.items) {
        for (const item of data.items) {
          onUpdate(item.product_id, item.stock_remaining)
        }
      }
    } catch {}
  })

  return () => eventSource.close()
}
