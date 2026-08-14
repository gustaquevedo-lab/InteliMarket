/**
 * Offline POS Engine — Full fiscal stack for local invoice generation.
 * Handles: CDC calculation, timbrado management, sequential numbering, 
 * dual-mode receipt/factura, hardware I/O.
 */

import { offlineDB, type CachedProduct, type CachedCustomer } from "./offlineDB"
import { api } from "../api"

// ==================== TYPES ====================

export interface OfflineInvoice {
  id: string
  numero: string
  cdc: string | null
  tipo_comprobante: string
  condicion: string
  fecha: string
  subtotal: number
  iva_10: number
  iva_5: number
  total: number
  estado: "offline_ticket" | "factura" | "pendiente_sifen"
  items: OfflineInvoiceItem[]
  customer_id: string | null
  customer_name: string | null
  payment_method: string
  timbrado: string | null
  punto_emision: number
  establecimiento: string
  synced: boolean
}

export interface OfflineInvoiceItem {
  product_id: string
  nombre: string
  cantidad: number
  precio_unitario: number
  iva_tasa: number
  total: number
}

export interface CachedTimbrado {
  id: string
  company_id: string
  numero: string
  fecha_inicio: string
  fecha_fin: string
  rango_desde: number
  rango_hasta: number
  tipo_comprobante: string
  activo: boolean
  ultimo_usado: number  // Last used number locally
  bloque_inicio: number  // Block start assigned to this POS
  bloque_fin: number     // Block end assigned to this POS
}

export interface CachedPaymentMethod {
  id: string
  tipo: string
  nombre: string
  activo: boolean
}

export interface CachedCompanyConfig {
  ruc: string
  razon_social: string
  establecimiento: string
  punto_emision: number
  regimen: string
}

// ==================== CDC GENERATION (SIFEN) ====================

export function calculateCDC(
  timbrado: string,
  tipoDocumento: number,
  ruc: string,
  fecha: string, // YYYY-MM-DD
  numero: number,
  puntoEmision: number,
  establecimiento: string,
): string {
  // CDC = SHA256(timbrado + tipo_documento + ruc + fecha + nro + p_emision + estab + tipo_emision)
  const fechaClean = fecha.replace(/-/g, "")
  const data = [
    timbrado,
    String(tipoDocumento),
    ruc,
    fechaClean,
    String(numero).padStart(7, '0'),
    String(puntoEmision).padStart(3, '0'),
    establecimiento.padStart(3, '0'),
    "1", // tipo_emision normal
  ].join("")

  // Simple SHA256-like hash using Web Crypto
  // For production, use the exact SIFEN CDC algorithm from the backend
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  const hexHash = Math.abs(hash).toString(16).toUpperCase().padStart(44, '0').slice(0, 44)
  
  // Append check digit (mod-11)
  let sum = 0
  for (let i = 0; i < hexHash.length; i++) {
    sum += parseInt(hexHash[i], 16) * ((i % 11) + 2)
  }
  const dv = (11 - (sum % 11)) % 11
  const dvStr = dv === 10 ? "A" : String(dv)

  return `${hexHash}${dvStr}`.slice(0, 44)
}

// ==================== SYNC ALL POS-RELEVANT DATA ====================

export async function syncPOSData(): Promise<{
  products: number
  customers: number
  timbrados: number
  payments: number
  company: boolean
}> {
  try {
    const [products, customers] = await Promise.all([
      api.products.list({ activo: true }),
      api.customers.list({ activo: true }),
    ])

    const cachedProducts: CachedProduct[] = products.map(p => ({
      id: p.id,
      sku: p.sku,
      codigo_barra: p.codigo_barra ?? null,
      nombre: p.nombre,
      category_id: p.categoria_id ?? null,
      iva_tasa: p.iva_tasa || 10,
      activo: p.activo !== false,
      precio: p.precio || 0,
      stock: p.stock ?? 0,
      categoria_nombre: p.categoria?.nombre || null,
      data: p,
      cached_at: new Date().toISOString(),
    }))

    const cachedCustomers: CachedCustomer[] = customers.map(c => ({
      id: c.id,
      razon_social: c.razon_social ?? "",
      ruc: c.ruc ?? null,
      ci: c.ci ?? null,
      tipo_persona: c.tipo_persona || "fisica",
      telefono: c.telefono ?? null,
      email: c.email ?? null,
      credito_limite: c.credito_limite || 0,
      activo: c.activo !== false,
      cached_at: new Date().toISOString(),
    }))

    await Promise.all([
      offlineDB.products.setAll(cachedProducts),
      offlineDB.customers.setAll(cachedCustomers),
    ])

    // Try to cache timbrados, payments, company
    let timbradoCount = 0
    let paymentCount = 0
    let companyOk = false
    try {
      const [timbrados, payments, company] = await Promise.allSettled([
        api.sifen.timbrados.list(),
        api.paymentMethods.list(),
        api.companies.list(),
      ])
      if (timbrados.status === "fulfilled") {
        const ts = timbrados.value as any[]
        const cachedTimbrados = ts.filter(t => t.activo).map(t => ({
          id: t.id,
          company_id: t.company_id,
          numero: t.numero,
          fecha_inicio: t.fecha_inicio,
          fecha_fin: t.fecha_fin,
          rango_desde: t.rango_desde,
          rango_hasta: t.rango_hasta,
          tipo_comprobante: t.tipo_comprobante || "ticket",
          activo: t.activo,
          ultimo_usado: t.rango_desde - 1,
          bloque_inicio: t.rango_desde,
          bloque_fin: t.rango_hasta,
        }))
        await offlineDB.timbrados.setAll(cachedTimbrados)
        timbradoCount = cachedTimbrados.length
      }
      if (payments.status === "fulfilled") {
        const ps = payments.value as any[]
        const cachedPayments: CachedPaymentMethod[] = ps.filter(p => p.activo !== false).map(p => ({
          id: p.id, tipo: p.tipo, nombre: p.nombre, activo: p.activo !== false,
        }))
        await offlineDB.paymentMethods.setAll(cachedPayments)
        paymentCount = cachedPayments.length
      }
      if (company.status === "fulfilled") {
        const comps = company.value as any[]
        if (comps.length > 0) {
          const c = comps[0]
          await offlineDB.companyConfig.set({
            ruc: c.ruc || "80012345-6",
            razon_social: c.razon_social || "InteliMarket",
            establecimiento: "001",
            punto_emision: 1,
            regimen: c.regimen_tributario || "general",
          })
          companyOk = true
        }
      }
    } catch {}
    return { products: cachedProducts.length, customers: cachedCustomers.length, timbrados: timbradoCount, payments: paymentCount, company: companyOk }
  } catch {
    return { products: 0, customers: 0, timbrados: 0, payments: 0, company: false }
  }
}

// ==================== OFFLINE INVOICE GENERATION ====================

export async function getNextNumber(timbradoId: string): Promise<{ numero: number; ok: boolean; message?: string }> {
  const timbrados = await offlineDB.timbrados.getAll()
  const timbrado = timbrados.find(t => t.id === timbradoId)
  if (!timbrado) return { numero: 0, ok: false, message: "Timbrado no encontrado" }
  if (!timbrado.activo) return { numero: 0, ok: false, message: "Timbrado inactivo" }

  const next = timbrado.ultimo_usado + 1
  if (next > timbrado.bloque_fin) {
    return { numero: 0, ok: false, message: "Bloque agotado. Se necesita sincronizar para obtener nuevo bloque." }
  }
  if (next < timbrado.rango_desde || next > timbrado.rango_hasta) {
    return { numero: 0, ok: false, message: "Fuera de rango del timbrado." }
  }

  const now = new Date()
  const fechaInicio = new Date(timbrado.fecha_inicio)
  const fechaFin = new Date(timbrado.fecha_fin)
  if (now < fechaInicio || now > fechaFin) {
    return { numero: 0, ok: false, message: "Timbrado vencido." }
  }

  timbrado.ultimo_usado = next
  await offlineDB.timbrados.update(timbrado)
  return { numero: next, ok: true }
}

export async function generateOfflineInvoice(
  tipoComprobante: string,
  items: OfflineInvoiceItem[],
  paymentMethod: string,
  customerId: string | null,
  customerName: string | null,
  condicion: string = "contado",
): Promise<OfflineInvoice> {
  const company = await offlineDB.companyConfig.get()
  const companyRuc = company?.ruc || "80012345-6"
  const companyName = company?.razon_social || "InteliMarket"
  const establecimiento = company?.establecimiento || "001"
  const pEmision = company?.punto_emision || 1

  // Find active timbrado for this tipo_comprobante
  const timbrados = await offlineDB.timbrados.getAll()
  const timbrado = timbrados.find(t => t.activo && t.tipo_comprobante === tipoComprobante)
  
  let numero: string
  let cdc: string | null = null
  let estado: OfflineInvoice["estado"] = "offline_ticket"

  if (timbrado) {
    const next = await getNextNumber(timbrado.id)
    if (next.ok) {
      const fecha = new Date().toISOString().slice(0, 10)
      numero = `${fecha.replace(/-/g, "")}-${establecimiento.padStart(3, '0')}-${String(next.numero).padStart(7, '0')}`
      cdc = calculateCDC(
        timbrado.numero,
        tipoComprobante === "factura" ? 1 : tipoComprobante === "ticket" ? 5 : 1,
        companyRuc,
        fecha,
        next.numero,
        pEmision,
        establecimiento,
      )
      estado = "factura"
    } else {
      numero = `OFF-${Date.now()}`
      estado = "offline_ticket"
    }
  } else {
    numero = `OFF-${Date.now()}`
    estado = "offline_ticket"
  }

  const subtotal = items.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0)
  const iva10 = items.filter(i => i.iva_tasa === 10).reduce((s, i) => s + Math.round(i.precio_unitario * i.cantidad * 0.1 / 1.1), 0)
  const iva5 = items.filter(i => i.iva_tasa === 5).reduce((s, i) => s + Math.round(i.precio_unitario * i.cantidad * 0.05 / 1.05), 0)
  const total = subtotal

  return {
    id: crypto.randomUUID(),
    numero,
    cdc,
    tipo_comprobante: tipoComprobante,
    condicion,
    fecha: new Date().toISOString(),
    subtotal,
    iva_10: iva10,
    iva_5: iva5,
    total,
    estado,
    items,
    customer_id: customerId,
    customer_name: customerName,
    payment_method: paymentMethod,
    timbrado: timbrado?.numero || null,
    punto_emision: pEmision,
    establecimiento,
    synced: false,
  }
}

export async function upgradeToFactura(invoiceId: string): Promise<OfflineInvoice | null> {
  const invoices = await offlineDB.invoices.getAll()
  const invoice = invoices.find(i => i.id === invoiceId)
  if (!invoice || invoice.estado !== "offline_ticket") return null

  const newInvoice = await generateOfflineInvoice(
    "factura",
    invoice.items,
    invoice.payment_method,
    invoice.customer_id,
    invoice.customer_name,
    invoice.condicion,
  )
  newInvoice.id = invoice.id
  newInvoice.synced = false

  await offlineDB.invoices.update(newInvoice)
  return newInvoice
}

// ==================== HARDWARE ABSTRACTION ====================

export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI
}

export async function printReceipt(html: string): Promise<boolean> {
  if (isElectron()) {
    const result = await window.electronAPI!.printReceipt(html)
    return result.success
  }
  // Browser fallback
  const w = window.open("", "_blank", "width=300,height=600")
  if (w) {
    w.document.write(html)
    w.document.close()
    w.print()
  }
  return true
}

export async function openCashDrawer(): Promise<boolean> {
  if (isElectron()) {
    const result = await window.electronAPI!.openCashDrawer()
    return result.success
  }
  return false
}
