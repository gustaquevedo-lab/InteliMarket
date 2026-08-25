import { useState, useEffect } from "react"
import { api } from "../api"

export const entityCache = {
  products: {} as Record<string, string>,
  customers: {} as Record<string, string>,
  suppliers: {} as Record<string, string>,
}

export function getProductName(id?: string | null): string {
  if (!id) return "—"
  return entityCache.products[id] || `Producto ${id.slice(0, 8)}`
}

export function getCustomerName(id?: string | null): string {
  if (!id) return "Cliente General"
  return entityCache.customers[id] || `Cliente ${id.slice(0, 8)}`
}

export function getSupplierName(id?: string | null): string {
  if (!id) return "Proveedor General"
  return entityCache.suppliers[id] || `Proveedor ${id.slice(0, 8)}`
}

export function useEntityLookup() {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (Object.keys(entityCache.products).length === 0) {
      api.products.list({ limit: 500 }).then((res: any) => {
        const list = Array.isArray(res) ? res : (res?.data || [])
        list.forEach((p: any) => {
          if (p.id) entityCache.products[p.id] = p.nombre || p.descripcion || p.sku
        })
        setTick(t => t + 1)
      }).catch(() => {})
    }

    if (Object.keys(entityCache.customers).length === 0) {
      api.customers.list({ limit: 500, exclude_proveedores: true } as any).then((res: any) => {
        const list = Array.isArray(res) ? res : (res?.data || [])
        list.forEach((c: any) => {
          if (c.id) entityCache.customers[c.id] = c.razon_social || c.nombre || c.ruc
        })
        setTick(t => t + 1)
      }).catch(() => {})
    }

    if (Object.keys(entityCache.suppliers).length === 0) {
      api.purchases.listSuppliers().then((res: any) => {
        const list = Array.isArray(res) ? res : (res?.data || [])
        list.forEach((s: any) => {
          if (s.id) entityCache.suppliers[s.id] = s.razon_social || s.nombre || s.ruc
        })
        setTick(t => t + 1)
      }).catch(() => {})
    }
  }, [])

  return {
    products: entityCache.products,
    customers: entityCache.customers,
    suppliers: entityCache.suppliers,
    getProductName,
    getCustomerName,
    getSupplierName,
  }
}
