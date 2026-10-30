/** Offline sync manager — catalog caching, retry queue, crash recovery */

import { offlineDB, type CachedProduct, type CachedCustomer, type PendingSale, type CachedReceipt, type CachedTerminal, type CachedCreditAccount } from "./offlineDB"
import { api, COMPANY_ID } from "../api"
import { syncSupervisorPins } from "./localAuth"

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

const DELTA_OVERLAP_MS = 30 * 1000
let lastPriceDeltaAt: string | null = null

// Delta liviano SOLO de productos (precios/promos), pensado para correr cada
// pocos segundos: la balanza recibe un precio nuevo en ~3 s, la caja tardaba
// hasta 5 min (y hasta 35 si el cambio caia en la ventana de commit). No toca
// clientes, PINs, terminales ni creditos -- eso sigue en syncFullCatalog.
export async function syncProductPriceDelta(): Promise<any[]> {
  const syncState = await offlineDB.syncState.get()
  const base = lastPriceDeltaAt || syncState?.last_full_sync
  if (!base) return []
  const startedAt = new Date().toISOString()
  const since = new Date(new Date(base).getTime() - DELTA_OVERLAP_MS).toISOString()
  const products = await api.products.list({ limit: 2000, include_inactive: true, updated_since: since })
  const cached = (products || []).map((p: any) => ({
    ...p,
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
  if (cached.length > 0) await offlineDB.products.upsertMany(cached)
  lastPriceDeltaAt = startedAt
  return cached
}

export async function syncFullCatalog(forceFull = false): Promise<{ products: number; customers: number; success: boolean }> {
  try {
    const syncState = await offlineDB.syncState.get()
    const lastSync = syncState?.last_full_sync
    const localProducts = await offlineDB.products.getAll()
    const hasLocalProducts = localProducts.length > 0
    // Autocuracion: versiones anteriores guardaban productos SIN precio_venta
    // (solo `precio`), y el POS lee precio_venta -> precio 0 en caja. Si el
    // cache local tiene alguno asi, se fuerza carga completa que lo reemplaza.
    const cacheSinPrecioVenta = localProducts.some((p: any) => p && p.precio_venta === undefined)

    // Si ya hay catálogo local y no es forceFull, hacemos sincronización DELTA (solo novedades)
    const isDelta = !forceFull && hasLocalProducts && !!lastSync && !cacheSinPrecioVenta
    // Solape: el servidor marca updated_at con la hora de INICIO de su transaccion
    // (now()), asi que un cambio puede commitear despues de que esta caja ya
    // sincronizo con un last_sync posterior a ese updated_at -> el delta lo
    // salteaba para siempre (hasta el proximo toque de la promo, hasta 30 min).
    const sinceDelta = lastSync ? new Date(new Date(lastSync).getTime() - DELTA_OVERLAP_MS).toISOString() : undefined

    const [products, customers] = await Promise.all([
      api.products.list({
        limit: isDelta ? 2000 : 15000,
        include_inactive: true,
        updated_since: isDelta ? sinceDelta : undefined,
      }),
      api.customers.list({
        limit: isDelta ? 2000 : 15000,
        updated_since: isDelta ? sinceDelta : undefined,
      }),
    ])

    const cachedProducts: CachedProduct[] = (products || []).map(p => ({
      // Se conserva el producto completo (precio_venta, precio_promo,
      // en_promocion, precio_regular, escalas...): el POS usa este mismo
      // objeto como Product, no solo `precio`.
      ...p,
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

    const cachedCustomers: CachedCustomer[] = (customers || []).map(c => {
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

    if (isDelta) {
      // Sincronización Delta: actualización rápida in-place sin borrar nada
      if (cachedProducts.length > 0) await offlineDB.products.upsertMany(cachedProducts)
      if (cachedCustomers.length > 0) await offlineDB.customers.upsertMany(cachedCustomers)
    } else {
      // Carga completa inicial
      await Promise.all([
        offlineDB.products.setAll(cachedProducts),
        offlineDB.customers.setAll(cachedCustomers),
      ])
    }

    // No bloquean el resultado del sync de catalogo -- si fallan (sin
    // conexion en este preciso instante) se mantiene el cache anterior de
    // cada uno, que es exactamente el comportamiento que se busca.
    syncSupervisorPins().catch(() => {})
    syncTerminals().catch(() => {})
    syncCreditAccounts().catch(() => {})

    await offlineDB.syncState.set({
      last_full_sync: new Date().toISOString(),
    })

    return { products: cachedProducts.length, customers: cachedCustomers.length, success: true }
  } catch (e) {
    console.warn("[syncManager] Error en syncFullCatalog:", e)
    return { products: 0, customers: 0, success: false }
  }
}

// Lista de cajas (hostname/IP/punto de emision) para que la malla LAN entre
// cajas (peer-mesh, ver OfflineContext.tsx) sepa a quien preguntarle
// mientras el servidor central esta caido.
async function syncTerminals(): Promise<void> {
  const terminals = await api.posTerminals.list()
  const cached: CachedTerminal[] = (terminals || []).map((t: any) => ({
    id: t.id,
    hostname: t.hostname,
    ip_address: t.ip_address ?? null,
    punto_emision: t.punto_emision,
    caja_nombre: t.caja_nombre,
    activo: t.activo !== false,
  }))
  await offlineDB.terminals.setAll(cached)
}

// Ultimo saldo conocido de cada cuenta de credito Extra Club -- para poder
// cobrar Extra Club offline (sin tope, venta marcada para revision) usando
// este dato en vez de bloquear el cobro cuando el servidor no responde.
async function syncCreditAccounts(): Promise<void> {
  const accounts = await api.creditAccounts.list({ activo: true })
  const cached: CachedCreditAccount[] = (accounts || []).map((a: any) => ({
    id: a.id,
    customer_id: a.customer_id,
    limite_credito: Number(a.limite_credito || 0),
    saldo_disponible: Number(a.saldo_disponible || 0),
    saldo_utilizado: Number(a.saldo_utilizado || 0),
    activo: a.activo !== false,
    en_mora: !!a.en_mora,
    cached_at: new Date().toISOString(),
  }))
  await offlineDB.creditAccounts.setAll(cached)
}

export async function getCachedCatalog(): Promise<{
  products: CachedProduct[]
  customers: CachedCustomer[]
  lastSync: string | null
}> {
  const [products, state] = await Promise.all([
    offlineDB.products.getAll(),
    offlineDB.syncState.get(),
  ])
  return {
    products: products.filter(p => p.activo),
    customers: [], // Optimización: los clientes se buscan bajo demanda en offlineDB.customers.search
    lastSync: state?.last_full_sync || null,
  }
}

export function getRetryDelay(retryCount: number): number {
  return Math.min(BASE_DELAY_MS * Math.pow(1.5, Math.min(retryCount, 8)), 60 * 1000)
}

// Ventas que quedaron trabadas se rescatan periódicamente con backoff.
// Las ventas al contado NUNCA se abandonan permanentemente.
const rechazosReportados = new Set<string>()

export function resetVentasRescatadas(): void {
  // Mantener compatibilidad de export
}

async function rescatarVentasAtascadas(forceAll: boolean = false): Promise<void> {
  try {
    const todas = await offlineDB.pendingSales.getAll()
    const ahora = Date.now()
    for (const v of todas) {
      if (!v || v.status === "synced") continue
      const syncingViejo = v.status === "syncing" && ahora - new Date(v.last_retry).getTime() > 45000
      const enError = v.status === "error"
      const errorRecuperable = /sesión activa|inicie sesión|token|401|unauthorized|conflict|409|duplicat/i.test(v.error || "")
      // Las ventas al contado siempre se recuperan; las de crédito solo si el error es recuperable o forceAll
      const esContado = (v.data as any)?.condicion === "contado"
      if (syncingViejo || forceAll || (enError && (esContado || errorRecuperable))) {
        await offlineDB.pendingSales.update({
          ...v,
          status: "pending" as const,
          retry_count: forceAll ? 0 : v.retry_count,
          next_retry: forceAll ? new Date(ahora).toISOString() : v.next_retry,
        })
      }
    }
  } catch {}
}

export async function syncPendingSales(
  forceRetryErrors: boolean = false,
  onProgress?: (synced: number, total: number) => void
): Promise<{ synced: number; failed: number; lastError?: string }> {
  await rescatarVentasAtascadas(forceRetryErrors)
  // Obtenemos todas las ventas no sincronizadas directamente de la base local
  const todas = await offlineDB.pendingSales.getAll()
  const pending = todas.filter(s => s && s.status !== "synced")
  if (pending.length === 0) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0
  let lastError: string | undefined

  for (const sale of pending) {
    const now = Date.now()
    const nextRetry = new Date(sale.next_retry).getTime()
    if (!forceRetryErrors && now < nextRetry) continue

    await offlineDB.pendingSales.update({
      ...sale,
      status: "syncing",
      last_retry: new Date(now).toISOString(),
      next_retry: new Date(now + getRetryDelay(sale.retry_count)).toISOString(),
    })

    try {
      await api.sales.create(sale.data as Parameters<typeof api.sales.create>[0])
      await offlineDB.pendingSales.update({ ...sale, status: "synced" as const })
      // Si esta venta tenia un consumo Extra Club anotado en la malla LAN
      ;(window as any).electronAPI?.peerMesh?.confirmSynced?.(`xc-${sale.id}`)?.catch?.(() => {})
      synced++
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : "Sync failed"
      lastError = msg

      // Si el servidor responde que el recurso ya existe o conflicto 409:
      // Verificar si la venta YA está grabada en la base de datos central de forma idempotente.
      const saleId = (sale.data as any)?.id
      let yaConfirmada = false
      if (saleId && /ya existe|conflict|409|duplicat/i.test(msg)) {
        try {
          const check = await api.sales.get(saleId)
          if (check && check.id === saleId) {
            yaConfirmada = true
          }
        } catch {}
      }

      if (yaConfirmada) {
        await offlineDB.pendingSales.update({ ...sale, status: "synced" as const })
        synced++
        failed--
        continue
      }

      // En ventas al contado (efectivo, tarjetas, vouchers), CUALQUIER fallo es transitorio
      // (corte de red, servidor reiniciando o bug temporal de base de datos) porque
      // no existe rechazo por línea de crédito. Siempre se reintenta con backoff.
      const esContado = (sale.data as any)?.condicion === "contado"
      const transitorio = esContado || /failed to fetch|network|load failed|abort|timeout|reiniciando|HTTP 5\d\d|HTTP 408|HTTP 429|HTTP 409|conflict|sesión activa|inicie sesión|token|401|unauthorized/i.test(msg)

      if (!transitorio && !rechazosReportados.has(sale.id)) {
        rechazosReportados.add(sale.id)
        try {
          const d = sale.data as any
          api.inteliaudit.recordEvent({
            company_id: d?.company_id || COMPANY_ID,
            user_id: d?.user_id,
            accion: "venta_offline_rechazada",
            entidad: "venta_pendiente",
            datos_nuevos: {
              id_local: sale.id,
              error: msg,
              total: d?.total,
              customer_id: d?.customer_id,
              condicion: d?.condicion,
              formas_pago: Array.isArray(d?.payments) ? d.payments.map((x: any) => `${x?.forma_pago}:${x?.monto}`) : undefined,
              items: Array.isArray(d?.items) ? d.items.length : undefined,
              creada: sale.created_at,
              punto_emision: d?.punto_emision,
            },
          } as any).catch(() => {})
        } catch {}
      }

      await offlineDB.pendingSales.update({
        ...sale,
        status: transitorio ? ("pending" as const) : ("error" as const),
        retry_count: sale.retry_count + 1,
        last_retry: new Date(now).toISOString(),
        next_retry: new Date(now + getRetryDelay(sale.retry_count)).toISOString(),
        error: msg,
      })
    }
  }

  if (synced > 0) {
    await offlineDB.syncState.set({
      last_sale_sync: new Date().toISOString(),
      pending_count: (await offlineDB.pendingSales.getAll()).filter(s => s && s.status !== "synced").length,
    })
  }

  if (onProgress) onProgress(synced, pending.length)
  return { synced, failed, lastError }
}

export async function syncPendingCupones(onProgress?: (synced: number, total: number) => void): Promise<{ synced: number; failed: number }> {
  const pending = await offlineDB.pendingCupones.getPending()
  if (pending.length === 0) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0

  for (const cupon of pending) {
    if (cupon.retry_count >= MAX_RETRIES) continue

    await offlineDB.pendingCupones.update({
      ...cupon,
      status: "syncing",
      retry_count: cupon.retry_count + 1,
    })

    try {
      await api.cupones.registrarMultiple(cupon.data as any)
      await offlineDB.pendingCupones.update({ ...cupon, status: "synced" as const })
      synced++
    } catch (err) {
      failed++
      await offlineDB.pendingCupones.update({
        ...cupon,
        status: "pending" as const,
        last_error: err instanceof Error ? err.message : "Sync failed",
      })
    }
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
    try {
      await Promise.allSettled([
        syncPendingSales(),
        syncPendingCupones()
      ])
    } catch (e) {
      console.warn("[SyncManager] Error en ciclo periódico de sincronización:", e)
    } finally {
      try { onSyncComplete() } catch {}
      // Mantener SIEMPRE vivo el ciclo de sincronización en segundo plano (cada 10 segundos)
      // para que las ventas offline se sincronicen apenas haya red sin depender de eventos
      scheduleSyncRetry(onSyncComplete)
    }
  }, 10000)
}

export function cancelSyncRetry() {
  if (syncTimer) { clearTimeout(syncTimer); syncTimer = null }
}
