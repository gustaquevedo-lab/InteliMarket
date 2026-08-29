/** Offline sync manager — catalog caching, retry queue, crash recovery */

import { offlineDB, type CachedProduct, type CachedCustomer, type PendingSale, type CachedReceipt } from "./offlineDB"
import { api } from "../api"

const CART_SAVE_INTERVAL = 5000
const MAX_RETRIES = 10
const BASE_DELAY_MS = 2000

let cartSaveTimer: ReturnType<typeof setInterval> | null = null
let syncTimer: ReturnType<typeof setTimeout> | null = null

export function startCartAutoSave(getCartItems: () => Array<{ id: string; nombre: string; precio: number; quantity: number; iva_tasa: number; sku: string; categoria: string }>) {
  if (cartSaveTimer) clearInterval(cartSaveTimer)
  cartSaveTimer = setInterval(() => {
    const items = getCartItems()
    if (items.length > 0) {
      offlineDB.cart.set(items).catch(() => {})
    }
  }, CART_SAVE_INTERVAL)
}

export function stopCartAutoSave() {
  if (cartSaveTimer) { clearInterval(cartSaveTimer); cartSaveTimer = null }
}

export async function restoreCart(): Promise<Array<{ id: string; nombre: string; precio: number; quantity: number; iva_tasa: number; sku: string; categoria: string }>> {
  return offlineDB.cart.getAll()
}

export async function syncFullCatalog(): Promise<{ products: number; customers: number; success: boolean }> {
  try {
    // Descarga el catálogo completo (todos los SKUs) y clientes con líneas de crédito
    const [products, customers] = await Promise.all([
      api.products.list({ limit: 10000, activo: true }),
      api.customers.list({ limit: 10000, activo: true }),
    ])

    const cachedProducts: CachedProduct[] = products.map(p => ({
      id: p.id,
      sku: p.sku,
      codigo_barra: p.codigo_barra ?? null,
      nombre: p.nombre,
      category_id: p.categoria_id ?? null,
      iva_tasa: p.iva_tasa || 10,
      activo: p.activo !== false,
      precio: Number(p.precio ?? p.precio_venta ?? 0),
      stock: p.stock ?? 0,
      categoria_nombre: p.categoria?.nombre || null,
      data: p,
      cached_at: new Date().toISOString(),
    }))

    const cachedCustomers: CachedCustomer[] = customers.map(c => {
      const limite = Number(c.credito_limite ?? c.limite_credito ?? 0)
      const usado = Number(c.credito_usado ?? c.saldo_pendiente ?? 0)
      return {
        id: c.id,
        razon_social: c.razon_social ?? c.nombre ?? "",
        nombre: c.nombre ?? "",
        ruc: c.ruc ?? null,
        ci: c.ci ?? null,
        telefono: c.telefono ?? null,
        email: c.email ?? null,
        tipo_persona: c.tipo_persona || "fisica",
        credito_limite: limite,
        credito_usado: usado,
        credito_disponible: Math.max(0, limite - usado),
        puntos_fidelidad: (c as any).puntos_acumulados || (c as any).puntos || 0,
        descuento_afinidad_pct: (c as any).descuento_afinidad_pct || 0,
        activo: c.activo !== false,
        cached_at: new Date().toISOString(),
      }
    })

    await Promise.all([
      offlineDB.products.setAll(cachedProducts),
      offlineDB.customers.setAll(cachedCustomers),
    ])

    await offlineDB.syncState.set({
      last_full_sync: new Date().toISOString(),
    })

    return { products: cachedProducts.length, customers: cachedCustomers.length, success: true }
  } catch {
    return { products: 0, customers: 0, success: false }
  }
}

export async function getCachedCatalog(): Promise<{
  products: CachedProduct[]
  customers: CachedCustomer[]
  lastSync: string | null
}> {
  const [products, customers, state] = await Promise.all([
    offlineDB.products.getAll(),
    offlineDB.customers.getAll(),
    offlineDB.syncState.get(),
  ])
  return {
    products: products.filter(p => p.activo),
    customers: customers.filter(c => c.activo),
    lastSync: state?.last_full_sync || null,
  }
}

export function getRetryDelay(retryCount: number): number {
  return Math.min(BASE_DELAY_MS * Math.pow(2, retryCount), 5 * 60 * 1000)
}

export async function syncPendingSales(onProgress?: (synced: number, total: number) => void): Promise<{ synced: number; failed: number }> {
  const pending = await offlineDB.pendingSales.getPending()
  if (pending.length === 0) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0

  for (const sale of pending) {
    if (sale.retry_count >= MAX_RETRIES) continue

    const now = Date.now()
    const nextRetry = new Date(sale.next_retry).getTime()
    if (now < nextRetry) continue

    await offlineDB.pendingSales.update({
      ...sale,
      status: "syncing",
      retry_count: sale.retry_count + 1,
      last_retry: new Date(now).toISOString(),
      next_retry: new Date(now + getRetryDelay(sale.retry_count)).toISOString(),
    })

    try {
      await api.sales.create(sale.data as Parameters<typeof api.sales.create>[0])
      await offlineDB.pendingSales.update({ ...sale, status: "synced" as const })
      synced++
    } catch (err) {
      failed++
      await offlineDB.pendingSales.update({
        ...sale,
        status: "pending" as const,
        error: err instanceof Error ? err.message : "Sync failed",
      })
    }
  }

  if (synced > 0) {
    await offlineDB.syncState.set({
      last_sale_sync: new Date().toISOString(),
      pending_count: (await offlineDB.pendingSales.getPending()).length,
    })
  }

  if (onProgress) onProgress(synced, pending.length)
  return { synced, failed }
}

export function generateOfflineReceipt(
  saleNumber: string,
  items: Array<{ nombre: string; cantidad: number; precio: number; total: number }>,
  total: number,
  iva10: number,
  iva5: number,
  paymentMethod: string,
  customerName: string | null,
  branchName: string = "EXTRA SUPERMERCADO S.A.",
): string {
  const now = new Date().toLocaleString("es-PY")
  const lines = items.map((i) => {
    const precio = i.precio.toLocaleString("es-PY")
    const subtotal = (i.precio * i.cantidad).toLocaleString("es-PY")
    return `<tr><td>${i.nombre}</td><td align="right">${i.cantidad}</td><td align="right">${precio}</td><td align="right">${subtotal}</td></tr>`
  }).join("")

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Comprobante ${saleNumber}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  body { font-family: 'Courier New', monospace; font-size: 11px; width: 72mm; margin: 0 auto; padding: 4px; line-height: 1.2; }
  .center { text-align: center; }
  .line { border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  th { border-bottom: 1px solid #000; text-align: left; font-size: 10px; }
  td { font-size: 11px; padding: 1px 0; }
  .total { font-size: 14px; font-weight: bold; }
</style></head><body>
<div class="center">
  <h3 style="margin:0; font-size: 13px;">${branchName}</h3>
  <p style="margin:2px 0;font-size:10px;">RUC: 80150377-9 | Timbrado DNIT: 18545636</p>
  <p style="margin:1px 0;font-size:9px;">Avda. Principal esq. Curupayty Nº 1450</p>
  <p style="margin:2px 0;font-size:10px;">${now}</p>
</div>
<div class="line"></div>
<p style="margin:3px 0;">Ticket Factura: <strong>${saleNumber}</strong></p>
${customerName ? `<p style="margin:3px 0;">Cliente: ${customerName}</p>` : "<p style=\"margin:3px 0;\">Cliente: Consumidor Final</p>"}
<p style="margin:3px 0;">Condición: CONTADO | Pago: ${paymentMethod}</p>
<div class="line"></div>
<table>
  <tr><th>Ítem / SKU</th><th align="right">Cant</th><th align="right">P.U.</th><th align="right">Total</th></tr>
  ${lines}
</table>
<div class="line"></div>
<div class="center">
  <p class="total">TOTAL A PAGAR: Gs. ${total.toLocaleString("es-PY")}</p>
  ${iva10 > 0 ? `<p style="font-size:10px; margin: 2px 0;">Liquidación IVA 10%: Gs. ${iva10.toLocaleString("es-PY")}</p>` : ""}
  ${iva5 > 0 ? `<p style="font-size:10px; margin: 2px 0;">Liquidación IVA 5%: Gs. ${iva5.toLocaleString("es-PY")}</p>` : ""}
</div>
<div class="line"></div>
<div class="center">
  <p style="font-size:9px; margin: 2px 0;">Resolución DNIT Autoimpresor Vigente</p>
  <p style="font-size:9px; margin: 2px 0;">¡Gracias por preferirnos!</p>
</div>
</body></html>`
}

export async function saveOfflineReceipt(saleId: string, saleNumber: string, html: string): Promise<void> {
  await offlineDB.receipts.add({
    id: `receipt-${saleId}`,
    sale_id: saleId,
    html,
    created_at: new Date().toISOString(),
  })
}

export async function getOfflineReceipt(saleId: string): Promise<CachedReceipt | null> {
  const receipts = await offlineDB.receipts.getBySale(saleId)
  return receipts[0] || null
}

export function scheduleSyncRetry(onSyncComplete: () => void) {
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(async () => {
    const result = await syncPendingSales()
    if (result.synced > 0 || result.failed > 0) {
      scheduleSyncRetry(onSyncComplete)
    }
    onSyncComplete()
  }, 10000)
}

export function cancelSyncRetry() {
  if (syncTimer) { clearTimeout(syncTimer); syncTimer = null }
}
