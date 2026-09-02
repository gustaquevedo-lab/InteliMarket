
export interface CustomerLostDemand {
  id: string
  company_id: string
  producto_nombre: string
  categoria?: string | null
  marca?: string | null
  notas?: string | null
  cliente_nombre?: string | null
  cliente_contacto?: string | null
  cajero_id?: string | null
  cajero_nombre?: string | null
  caja_id?: string | null
  estado: "PENDIENTE" | "EN_EVALUACION" | "COMPRADO" | "DESCARTADO"
  orden_compra_id?: string | null
  created_at: string
  updated_at: string
}

const rawApiUrl = import.meta.env.VITE_API_URL || ""
const isLocalhostOrRelative = !rawApiUrl || rawApiUrl.startsWith("/") || rawApiUrl.includes("intelimarket-ia")
const API_BASE = isLocalhostOrRelative ? "/api" : rawApiUrl
export const API_ORIGIN = API_BASE.startsWith("http") ? API_BASE.replace(/\/api\/?$/, "") : (typeof window !== "undefined" ? window.location.origin : "")
export const COMPANY_ID = "00000000-0000-0000-0000-000000000010"

let isRefreshing = false
let refreshPromise: Promise<string | null> | null = null

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let token = localStorage.getItem("access_token")
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  if (token) headers["Authorization"] = `Bearer ${token}`
  const cleanEndpoint = endpoint.startsWith("/api") ? endpoint.substring(4) : endpoint
  let response = await fetch(`${API_BASE}${cleanEndpoint}`, { ...options, headers })

  // Manejo de expiración de sesión (401)
  if (response.status === 401 && !cleanEndpoint.includes("/auth/")) {
    const refreshToken = localStorage.getItem("refresh_token")
    if (refreshToken) {
      if (!isRefreshing) {
        isRefreshing = true
        refreshPromise = (async () => {
          try {
            const refreshRes = await fetch(`${API_BASE}/v1/auth/refresh`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refresh_token: refreshToken }),
            })
            if (refreshRes.ok) {
              const refreshData = await refreshRes.json()
              localStorage.setItem("access_token", refreshData.access_token)
              if (refreshData.refresh_token) localStorage.setItem("refresh_token", refreshData.refresh_token)
              return refreshData.access_token as string
            } else {
              localStorage.removeItem("access_token")
              localStorage.removeItem("refresh_token")
              localStorage.removeItem("user_email")
              return null
            }
          } catch {
            return null
          } finally {
            isRefreshing = false
          }
        })()
      }

      const newToken = await refreshPromise
      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`
        response = await fetch(`${API_BASE}${cleanEndpoint}`, { ...options, headers })
      }
    } else {
      localStorage.removeItem("access_token")
      localStorage.removeItem("refresh_token")
      localStorage.removeItem("user_email")
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Error desconocido" }))
    const detailMsg = Array.isArray(error.detail)
      ? error.detail.map((d: any) => d.msg || `${d.loc?.join(".")}: ${d.type}`).join(", ")
      : typeof error.detail === "string"
      ? error.detail
      : typeof error.message === "string"
      ? error.message
      : JSON.stringify(error.detail || error)
    throw new Error(detailMsg || `HTTP ${response.status}`)
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

// No fija Content-Type -- con body FormData, fetch tiene que poner el
// boundary del multipart solo. request() de arriba fuerza siempre
// "application/json" salvo que el caller lo pise, lo cual rompe cualquier
// subida de archivo real que pase por ahi (ver migration.preview/import,
// que tienen el mismo problema sin usar).
async function requestMultipart<T>(endpoint: string, formData: FormData): Promise<T> {
  const token = localStorage.getItem("access_token")
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `Bearer ${token}`
  const cleanEndpoint = endpoint.startsWith("/api") ? endpoint.substring(4) : endpoint
  const response = await fetch(`${API_BASE}${cleanEndpoint}`, { method: "POST", headers, body: formData })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Error desconocido" }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  return response.json()
}

export const client = {
  get: <T>(endpoint: string, params?: Record<string, string | boolean | number | undefined>) => {
    const url = params ? `${endpoint}?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined) as [string, string][])}` : endpoint
    return request<T>(url)
  },
  post: <T>(endpoint: string, data?: unknown) => request<T>(endpoint, { method: "POST", body: JSON.stringify(data) }),
  put: <T>(endpoint: string, data?: unknown) => request<T>(endpoint, { method: "PUT", body: JSON.stringify(data) }),
  patch: <T>(endpoint: string, data?: unknown) => request<T>(endpoint, { method: "PATCH", body: JSON.stringify(data) }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: "DELETE" }),
}

async function downloadAuthenticated(path: string, params: Record<string, string | undefined> | undefined, filename: string) {
  const token = localStorage.getItem("access_token")
  const cleanPath = path.startsWith("/") ? path : `/${path}`
  const qs = params ? new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "")) as Record<string, string>).toString() : ""
  const sep = cleanPath.includes("?") ? "&" : "?"
  const url = `${API_BASE}${cleanPath}${qs ? `${sep}${qs}` : ""}`
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) throw new Error(`No se pudo descargar el archivo (${res.status})`)
  const blob = await res.blob()
  const isPdf = filename.toLowerCase().endsWith(".pdf")
  const fileBlob = new Blob([blob], { type: isPdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  const blobUrl = URL.createObjectURL(fileBlob)
  const a = document.createElement("a")
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(blobUrl), 20000)
}

// ========== TYPE STUBS ==========
export interface Product { id: string; sku: string; nombre: string; descripcion?: string | null; categoria_id?: string | null; supplier_id?: string; supplier_nombre?: string; codigo_barra?: string; unidad_medida?: string; tipo?: string; tipo_venta?: string; iva_tasa?: number; stock_minimo?: number; stock_maximo?: number; peso_kg?: number; imagen_url?: string | null; precio_venta?: number; costo_promedio?: number; ultimo_costo?: number; costo_landed?: number; activo?: boolean; created_at?: string; updated_at?: string; precio?: number; categoria?: Category; stock?: number }
export interface Category { id: string; nombre: string; codigo?: string; parent_id?: string; company_id?: string; activo?: boolean; created_at?: string }
export interface Customer { id: string; nombre: string; email?: string; telefono?: string; ruc?: string; extra_club_numero?: string | null; empresa_vinculada_nombre?: string | null; empresa_vinculada_ruc?: string | null; razon_social?: string; ci?: string; direccion?: string; ciudad?: string; tipo?: string; tipo_persona?: string; activo?: boolean; saldo_pendiente?: number; limite_credito?: number; credito_limite?: number; credito_usado?: number; created_at?: string; updated_at?: string }
export interface Sale { id: string; company_id?: string; customer_id?: string; customer?: Customer; customer_nombre?: string; customer_doc?: string; customer_extra_club?: string; items?: SaleItem[]; total?: number; subtotal?: number; total_iva?: number; estado?: string; condicion?: string; forma_pago?: string; tipo_comprobante?: string; fecha?: string; caja_session_id?: string; usuario_id?: string; observaciones?: string; numero?: string; numero_interno?: string; recibo_html?: string; recibo_escpos_b64?: string; total_pagado?: number; saldo?: number; iva_10?: number; iva_5?: number; descuento_total?: number; sifen_estado?: string; cdc?: string; created_at?: string }
export interface SaleItem { id?: string; sale_id?: string; product_id?: string; producto?: Product; product?: Product; descripcion?: string; cantidad?: number; cantidad_devuelta?: number; cantidad_disponible?: number; precio_unitario?: number; subtotal?: number; iva_tasa?: number; iva_monto?: number; total?: number; descuento?: number }
export interface PaymentMethod { id: string; nombre: string; codigo?: string; tipo?: string; moneda?: string; activo?: boolean; permite_parcial?: boolean; requiere_autorizacion?: boolean; created_at?: string }
export interface Payment { id: string; sale_id?: string; metodo_pago_id?: string; payment_method_id?: string; metodo_pago?: PaymentMethod; tipo?: string; monto?: number; moneda?: string; referencia?: string; estado?: string; fecha?: string; created_at?: string }
export interface Warehouse { id: string; codigo?: string; nombre: string; direccion?: string; ciudad?: string; tipo?: string; activo?: boolean; company_id?: string; created_at?: string }
export interface StockItem { id?: string; product_id?: string; producto?: Product; product?: Product; nombre?: string; sku?: string; warehouse_id?: string; warehouse?: Warehouse; cantidad?: number; cantidad_reservada?: number; cantidad_disponible?: number; stock_minimo?: number; stock_maximo?: number; costo_promedio?: number; ultimo_costo?: number; costo_unitario?: number; lote?: string; fecha_vencimiento?: string; created_at?: string }
export interface Company { id: string; nombre?: string; nombre_fantasia?: string; ruc?: string; razon_social?: string; direccion?: string; ciudad?: string; departamento?: string; telefono?: string; email?: string; logo_url?: string; activo?: boolean; config?: Record<string, unknown>; iva_condition?: string; regimen_tributario?: string; created_at?: string; updated_at?: string }
export interface CashRegister { id: string; nombre: string; codigo?: string; tipo?: string; branch_id?: string; sucursal_id?: string; warehouse_id?: string; activo?: boolean; cash_drop_threshold?: number | null; diferencia_maxima_tolerada?: number | null; created_at?: string }
export interface CashHandoff { id: string; session_id: string; register_nombre: string | null; entregado_por_nombre: string | null; recibido_por_nombre?: string | null; monto_pyg: number; monto_usd: number; monto_brl: number; monto_confirmado_pyg?: number | null; monto_confirmado_usd?: number | null; monto_confirmado_brl?: number | null; discrepancia_confirmacion?: boolean; requiere_revision: boolean; estado: string; created_at: string; fecha_confirmacion?: string | null }
export interface KioskPriceTier { min_qty: number; max_qty: number | null; precio_unitario: number; moneda: string }
export interface KioskProductLookup { id: string; nombre: string; sku?: string | null; codigo_barra?: string | null; precio_venta: number; imagen_url?: string | null; categoria_nombre?: string | null; tipo_venta?: string | null; escalas: KioskPriceTier[]; en_promocion?: boolean; badge_promo?: string; ahorro_unitario?: number; ahorro_porcentaje?: number; precio_regular?: number; limite_por_compra?: number; mensaje_dias?: string; promocion_nombre?: string | null; valido_hasta?: string | null }
export interface KioskBanner { id: string; company_id: string; titulo: string; subtitulo?: string | null; etiqueta?: string | null; descuento_texto?: string | null; color?: string | null; imagen_url?: string | null; orden: number; activo: boolean; fecha_inicio?: string | null; fecha_fin?: string | null; created_at: string; updated_at?: string | null }
export interface VaultEntry { id: string; origen: string; monto_pyg: number; monto_usd: number; monto_brl: number; estado: string; bank_transaction_id?: string | null; created_at: string; fecha_deposito?: string | null }
export interface VaultDashboard { saldo_en_boveda_pyg: number; saldo_en_boveda_usd: number; saldo_en_boveda_brl: number; entradas_en_boveda: number; entregas_pendientes: number; entregas_pendientes_detalle: CashHandoff[]; retiros_pendientes: number; retiros_pendientes_detalle: any[]; movimientos_recientes: VaultEntry[] }
export interface CashSession { id: string; caja_id?: string; caja?: CashRegister; cash_register?: CashRegister; usuario_id?: string; fecha_apertura?: string; fecha_cierre?: string; monto_apertura?: number; monto_cierre?: number; total_ventas?: number; total_retiros?: number; total_ingresos?: number; estado?: string; observaciones?: string; created_at?: string }
export interface Branch { id: string; nombre: string; codigo: string; direccion?: string; ciudad?: string; departamento?: string; telefono?: string; email?: string; ruc?: string; punto_emision?: string | number; activo?: boolean; company_id?: string; created_at?: string; updated_at?: string }
export interface CreditAccount { id: string; customer_id?: string; customer?: Customer; customer_nombre?: string; customer_ruc?: string; saldo?: number; limite_credito?: number; saldo_utilizado?: number; saldo_disponible?: number; porcentaje_uso?: number; estado?: string; activo?: boolean; dias_mora_max?: number; en_mora?: boolean; created_at?: string; updated_at?: string }
export interface CreditMovement { id: string; credit_account_id?: string; tipo?: string; fuente?: string; monto?: number; saldo_anterior?: number; saldo_nuevo?: number; referencia?: string; observaciones?: string; sale_id?: string; fecha?: string; created_at?: string; estado?: string | null; saldo_pendiente?: number | null; dias_mora?: number | null }
export interface MoraConfig { activo: boolean; porcentaje_mensual: number; dias_gracia: number }
export interface MoraPreviewItem { credit_account_id: string; customer_id: string; customer_nombre?: string; documentos_afectados: number; recargo_total: number }
export interface MoraPreviewResponse { config: MoraConfig; items: MoraPreviewItem[]; total_recargo: number }
export interface WriteoffRequest { id: string; accounts_receivable_id: string; customer_id: string; customer_nombre?: string; numero_documento?: string; monto: number; motivo: string; estado: string; aprobado_gerente_id?: string | null; aprobado_finanzas_id?: string | null; created_at: string }
export interface DunningConfig { activo: boolean; buckets_dias: number[]; mensaje_template: string }
export interface DunningPreviewItem { customer_id: string; customer_nombre?: string; telefono?: string; monto_total: number; dias_mora: number; bucket_dias: number; documentos_count: number }
export interface DunningPreviewResponse { config: DunningConfig; items: DunningPreviewItem[] }
export interface CustomerAdvance { id: string; company_id: string; customer_id: string; customer_nombre?: string | null; monto_total: number; monto_disponible: number; moneda: string; forma_pago?: string | null; referencia?: string | null; fecha: string; observaciones?: string | null; created_at: string }
export interface Delivery { id: string; company_id?: string; sale_id?: string; customer_id?: string; customer?: Customer; driver_id?: string; driver?: Driver; driver_name?: string; vehicle_id?: string; direccion_entrega?: string; coordenadas?: string; estado?: string; fecha_programada?: string; fecha_salida?: string; fecha_entrega?: string; observaciones?: string; created_at?: string }
export interface Driver { id: string; company_id?: string; nombre: string; telefono?: string; email?: string; licencia_numero?: string; estado?: string; activo?: boolean; created_at?: string }
export interface Vehicle { id: string; company_id?: string; patente?: string; marca?: string; modelo?: string; tipo?: string; capacidad_kg?: number; activo?: boolean; created_at?: string }
export interface Route { id: string; company_id?: string; nombre?: string; fecha?: string; driver_id?: string; driver_name?: string; vehicle_id?: string; estado?: string; distancia_km?: number; duracion_estimada_min?: number; total_stops?: number; completed_stops?: number; total_deliveries?: number; completed_deliveries?: number; observaciones?: string; created_at?: string; updated_at?: string }
export interface Notification { id: string; tenant_id?: string; user_id?: string; title?: string; body?: string; tipo?: string; link?: string | null; leida?: boolean; created_at?: string }
export interface NotificationTemplate { id: string; nombre?: string; tipo?: string; subject?: string; body?: string; variables?: string[]; activo?: boolean; created_at?: string }
export interface UserNotificationPreference { id: string; user_id?: string; tipo?: string; email?: boolean; push?: boolean; in_app?: boolean; activo?: boolean; created_at?: string }
export interface Lead { id: string; tenant_id?: string; company_id?: string; nombre?: string; email?: string; telefono?: string; empresa?: string; fuente?: string; origen?: string; estado?: string; valor_estimado?: number; puntaje?: number; probabilidad?: number; fecha_cierre_estimada?: string; notas?: string; asignado_a?: string; activo?: boolean; created_at?: string; updated_at?: string }
export interface Oportunidad { id: string; tenant_id?: string; company_id?: string; lead_id?: string; lead?: Lead; nombre?: string; etapa?: string; valor?: number; monto_estimado?: number; probabilidad?: number; cliente_nombre?: string; fecha_cierre?: string; fecha_cierre_estimada?: string; notas?: string; activo?: boolean; created_at?: string; updated_at?: string }
export interface Actividad { id: string; tenant_id?: string; company_id?: string; oportunidad_id?: string; lead_id?: string; oportunidad?: Oportunidad; tipo?: string; titulo?: string; descripcion?: string; fecha?: string; hora?: string; duracion_min?: number; fecha_vencimiento?: string; completada?: boolean; fecha_completada?: string; asignado_a?: string; created_at?: string; updated_at?: string }
export interface LeadStats { total?: number; nuevo?: number; nuevos?: number; contactado?: number; contactados?: number; cualificado?: number; cualificados?: number; convertido?: number; convertidos?: number; descartado?: number; descartados?: number; avg_puntaje?: number }
export interface PipelineStats { total?: number; total_valor?: number; by_etapa?: Record<string, any>; por_etapa?: Record<string, any> }
export interface ActivityStats { total?: number; completadas?: number; pendientes?: number; by_tipo?: Record<string, number>; por_tipo?: Record<string, number> }
export interface Permission { id: string; name?: string; description?: string | null; module?: string; action?: string; created_at?: string }
export interface Role { id: string; name?: string; description?: string | null; is_system?: boolean; is_default?: boolean; created_at?: string; permissions?: Permission[] }
export interface TenantUser { id: string; email: string; nombre: string; telefono?: string | null; rol: string; activo: boolean; is_superadmin: boolean; foto_url?: string | null; last_login?: string | null; created_at: string; tenant_rol: string; role_names: string[] }
export interface PurchaseOrder { id: string; company_id?: string; supplier_id?: string; supplier?: Supplier; numero?: string; fecha?: string; fecha_entrega?: string; estado?: string; subtotal?: number; total_iva?: number; total?: number; moneda?: string; tipo_cambio?: number; fecha_entrega_estimada?: string | null; descuento_total?: number; iva_10?: number; iva_5?: number; observaciones?: string | null; items?: PurchaseOrderItem[]; created_at?: string; updated_at?: string }
export interface PurchaseRequisitionItem { id: string; requisition_id: string; product_id: string; variant_id?: string | null; descripcion?: string | null; cantidad_solicitada: number; cantidad_aprobada?: number | null; precio_estimado?: number | null; total_estimado?: number | null; observaciones?: string | null; created_at: string }
export interface PurchaseRequisition { id: string; company_id: string; numero: string; fecha: string; fecha_necesidad?: string | null; departamento?: string | null; solicitante_id?: string | null; solicitante_nombre?: string | null; estado: string; prioridad?: string | null; moneda?: string | null; subtotal?: number | null; total?: number | null; motivo?: string | null; observaciones?: string | null; aprobado_por?: string | null; fecha_aprobacion?: string | null; rechazado_motivo?: string | null; purchase_order_id?: string | null; user_id?: string | null; created_at: string; items?: PurchaseRequisitionItem[] }
export interface PurchaseOrderItem { id?: string; orden_id?: string; producto_id?: string; producto?: Product; cantidad?: number; precio_unitario?: number; subtotal?: number; iva_tasa?: number; recibido?: number; pendiente?: number; created_at?: string }
export interface PurchaseRfqItem { id: string; rfq_id: string; product_id: string; variant_id?: string | null; descripcion?: string | null; cantidad_solicitada: number; created_at: string }
export interface PurchaseRfqResponseItem { id: string; response_id: string; rfq_item_id: string; product_id: string; precio_unitario: number; plazo_entrega_dias?: number | null; created_at: string }
export interface PurchaseRfqResponse { id: string; rfq_id: string; supplier_id: string; estado: string; fecha_respuesta?: string | null; plazo_entrega_dias?: number | null; observaciones?: string | null; supplier?: Supplier; items: PurchaseRfqResponseItem[]; total_cotizado?: number | null; created_at: string }
export interface PurchaseRfq { id: string; company_id: string; requisition_id?: string | null; numero: string; fecha: string; fecha_limite?: string | null; estado: string; motivo?: string | null; observaciones?: string | null; ganador_supplier_id?: string | null; purchase_order_id?: string | null; created_at: string }
export interface PurchaseRfqWithDetail extends PurchaseRfq { items: PurchaseRfqItem[]; responses: PurchaseRfqResponse[] }
export interface PurchaseBudget { id: string; company_id: string; nombre: string; anio: number; mes?: number | null; tipo?: string | null; moneda?: string | null; monto_presupuestado: number; monto_ejecutado?: number | null; monto_disponible?: number | null; categoria_id?: string | null; departamento?: string | null; activo: boolean; observaciones?: string | null; user_id?: string | null; created_at?: string; updated_at?: string }
export interface PurchaseBudgetConsumption { budget_id: string; nombre: string; anio: number; mes?: number | null; monto_presupuestado: number; monto_ejecutado: number; monto_disponible: number; porcentaje_ejecutado: number }
export interface PurchaseReceipt { id: string; company_id?: string; purchase_order_id?: string | null; orden?: PurchaseOrder; supplier_id?: string; supplier?: Supplier; warehouse_id?: string; numero?: string; fecha?: string; estado?: string; proveedor_ref?: string | null; total?: number; user_id?: string | null; observaciones?: string | null; requiere_revision?: boolean; motivo_revision?: string | null; items?: PurchaseReceiptItem[]; created_at?: string; updated_at?: string }
export interface PurchaseReceiptItem { id?: string; receipt_id?: string; product_id?: string; producto?: Product; variant_id?: string | null; cantidad_ordenada?: number | null; cantidad_recibida?: number; precio_unitario?: number; costo_unitario?: number; total?: number; batch_id?: string | null; cantidad_rechazada?: number | null; motivo_rechazo?: string | null; created_at?: string }
export interface SmartReplenishmentItem {
  product_id: string
  nombre: string
  sku?: string | null
  codigo_barra?: string | null
  unidad_medida: string
  stock_actual: number
  stock_en_transito: number
  ventas_periodo: number
  demanda_diaria_base: number
  multiplicador_estacional: number
  demanda_diaria_ajustada: number
  dias_stock_restantes: number
  autonomia_estado: "critico" | "bajo" | "optimo" | "sobrestock"
  stock_seguridad?: number
  punto_reorden?: number
  target_stock?: number
  cantidad_sugerida: number
  costo_unitario_estimado: number
  subtotal_estimado: number
  iva_tasa: number
  explicacion_ia: string
  generada_automaticamente?: boolean
}

export interface SmartReplenishmentResponse {
  total_evaluados: number
  total_quiebres: number
  total_bajos: number
  total_sugeridos: number
  monto_total_estimado: number
  items: SmartReplenishmentItem[]
}

export interface SmartReplenishmentRequest {
  company_id?: string
  supplier_id?: string
  categoria_id?: string
  dias_cobertura?: number
  lead_time_dias?: number
  dias_historial_ventas?: number
  factor_fin_semana?: boolean
  factor_fin_mes?: boolean
  factor_clima?: "normal" | "calor" | "frio" | "lluvia"
  factor_evento?: "normal" | "feriado" | "semana_santa" | "fin_de_ano"
  solo_quiebre_o_bajo?: boolean
  search?: string
  limit?: number
}

export interface FinanceAgentRun { id: string; company_id: string; started_at: string; finished_at?: string; model?: string; status: string; diagnostico?: string; error_message?: string }
export interface FinanceRecommendation { id: string; company_id: string; run_id: string; tipo: string; titulo: string; descripcion: string; entidad_relacionada?: string; monto_relacionado?: string; requested_by: string; approved_by?: string; status: string; comments?: string; created_at: string; updated_at: string }
export interface SalesAgentRun { id: string; company_id: string; started_at: string; finished_at?: string; model?: string; status: string; diagnostico?: string; error_message?: string }
export interface SalesRecommendation { id: string; company_id: string; run_id: string; tipo: string; titulo: string; descripcion: string; entidad_relacionada?: string; monto_relacionado?: string; requested_by: string; approved_by?: string; status: string; comments?: string; created_at: string; updated_at: string }
export interface Supplier { id: string; company_id?: string; ruc?: string; razon_social?: string; nombre_fantasia?: string; direccion?: string; telefono?: string; email?: string; contacto?: string; contacto_nombre?: string; contacto_telefono?: string; plazo_pago_dias?: number; plazo_entrega_promedio?: number; rating?: number; tipo?: string; tipo_proveedor?: string; grupo?: string; activo?: boolean; created_at?: string; updated_at?: string }
export interface Quote { id: string; company_id?: string; customer_id?: string; customer?: Customer; numero?: string; fecha?: string; fecha_vencimiento?: string; valido_hasta?: string; estado?: string; subtotal?: number; total_iva?: number; total?: number; moneda?: string; observaciones?: string; condiciones_pago?: string; descuento_total?: number; iva_10?: number; iva_5?: number; sale_id?: string; items?: QuoteItem[]; created_at?: string; updated_at?: string }
export interface QuoteItem { id?: string; cotizacion_id?: string; producto_id?: string; producto?: Product; product?: Product; cantidad?: number; precio_unitario?: number; subtotal?: number; iva_tasa?: number; descuento?: number; total?: number; descripcion?: string; created_at?: string }
export interface Discount { id: string; company_id?: string; nombre?: string; descripcion?: string; tipo?: string; valor?: number; aplica_a?: string; monto_minimo?: number; monto_maximo?: number; cantidad_minima?: number; fecha_inicio?: string; fecha_fin?: string; producto_ids?: string[]; categoria_ids?: string[]; cliente_ids?: string[]; activo?: boolean; created_at?: string; updated_at?: string }
export interface CommissionRule { id: string; company_id?: string; nombre: string; tipo: string; porcentaje?: number; vendedor_id?: string; vendedor_nombre?: string; aplica_a?: string; producto_ids?: string[]; categoria_ids?: string[]; monto_minimo?: number; monto_maximo?: number; valido_desde?: string; valido_hasta?: string; activo?: boolean; created_at?: string; updated_at?: string }
export interface SalesCommission { id: string; company_id?: string; vendedor_id?: string; vendedor_nombre?: string; vendedor?: Customer; sale_id?: string; sale_numero?: string; venta_id?: string; venta?: Sale; regla_id?: string; rule_id?: string; rule_nombre?: string; regla?: CommissionRule; monto_venta?: number; porcentaje?: number; comision?: number; monto_comision?: number; base_calculo?: number; estado?: string; fecha_pago?: string; created_at?: string; updated_at?: string }
export interface Return { id: string; company_id?: string; sale_id?: string; sale?: Sale; customer_id?: string; customer?: Customer; numero?: string; sale_numero?: string; nota_credito_numero?: string; nota_credito_error?: string; fecha?: string; estado?: string; motivo?: string; motivo_detalle?: string; observaciones?: string; aprobado_por?: string; subtotal?: number; total_iva?: number; total?: number; items?: ReturnItem[]; created_at?: string; updated_at?: string }
export interface ReturnItem { id?: string; devolucion_id?: string; producto_id?: string; producto?: Product; cantidad?: number; precio_unitario?: number; subtotal?: number; iva_tasa?: number; motivo?: string; estado?: string; condicion?: string; descripcion?: string; total?: number; created_at?: string }
export interface SalesOrder { id: string; company_id?: string; customer_id?: string; customer?: Customer; numero?: string; fecha?: string; fecha_entrega?: string; estado?: string; prioridad?: string; subtotal?: number; total_iva?: number; total?: number; observaciones?: string; condicion?: string; moneda?: string; iva_10?: number; iva_5?: number; descuento_total?: number; fecha_entrega_solicitada?: string; fecha_entrega_estimada?: string; direccion_entrega?: string; items?: SalesOrderItem[]; created_at?: string; updated_at?: string }
export interface SalesOrderItem { id?: string; pedido_id?: string; producto_id?: string; producto?: Product; cantidad?: number; precio_unitario?: number; subtotal?: number; iva_tasa?: number; descuento?: number; total?: number; entregado?: number; pendiente?: number; created_at?: string }
export interface ProductVariant { id: string; product_id?: string; producto?: Product; tipo?: string; valor?: string; sku_variante?: string; codigo_barra?: string; precio_extra?: number; stock?: number; activo?: boolean; created_at?: string }
export interface SupermerRecipe { id: string; area?: string; nombre?: string; descripcion?: string; producto_terminado_id?: string; producto_terminado_nombre?: string; cantidad_esperada?: number; unidad_medida?: string; rendimiento_esperado?: number; activa?: boolean; items?: SupermerRecipeItem[]; created_at?: string }
export interface SupermerRecipeItem { id?: string; receta_id?: string; producto_id?: string; producto_nombre?: string; cantidad?: number; unidad_medida?: string; es_opcional?: boolean }
export interface SupermerOrder { id: string; area?: string; receta_id?: string; receta_nombre?: string; cantidad_objetivo?: number; estado?: string; fecha_inicio?: string; fecha_fin?: string; fecha_vencimiento?: string; responsable_id?: string; responsable_nombre?: string; notas?: string; insumos_usados?: any; producto_obtenido?: number; rendimiento_real?: number; created_at?: string }
export interface SupermerBatch { id: string; producto_id?: string; producto_nombre?: string; cantidad_obtenida?: number; fecha_produccion?: string; fecha_vencimiento?: string; lote_codigo?: string; costo_unitario?: number; orden_id?: string }
export interface SupermerWaste { id: string; area?: string; producto_id?: string; producto_nombre?: string; cantidad?: number; costo_unitario?: number; costo_total?: number; tipo_merma?: string; motivo?: string; fecha?: string; registrado_por?: string }
export interface SupermerPerishableConfig { id: string; producto_id?: string; producto_nombre?: string; vida_util_dias?: number; requiere_markdown?: boolean; categoria_perecedera?: string }
export interface SupermerMarkdown { id: string; producto_id?: string; producto_nombre?: string; lote_id?: string; descuento_porcentaje?: number; precio_original?: number; precio_markdown?: number; fecha_inicio?: string; fecha_fin?: string; activo?: boolean; motivo?: string }
export interface SupermerForecast { id: string; producto_id?: string; producto_nombre?: string; fecha_pronosticada?: string; cantidad_pronosticada?: number; confianza?: number; fecha_generacion?: string }
export interface SupermerSuggestion { id: string; producto_id?: string; producto_nombre?: string; proveedor_id?: string; proveedor_nombre?: string; cantidad_sugerida?: number; cantidad_stock_actual?: number; cantidad_pendiente_recibir?: number; cantidad_pronosticada?: number; lead_time_dias?: number; fecha_sugerida_pedido?: string; fecha_sugerida_llegada?: string; precio_estimado?: number; costo_estimado_total?: number; estado?: string; notas?: string; created_at?: string }
export interface SupermerDashboard { ordenes_activas?: number; ordenes_hoy?: number; total_producido_hoy?: number; merma_diaria_total?: number; merma_diaria_porcentaje?: number; productos_en_markdown?: number; productos_por_vencer_30d?: number; alertas_criticas?: number; rendimiento_promedio?: number; sugerencias_pendientes?: number; forecast_actualizacion?: string }
export interface SupermerWasteByArea { area?: string; total_cantidad?: number; total_costo?: number; cantidad_ordenes?: number }
export interface SupermerProductionByArea { area?: string; total_producido?: number; ordenes_completadas?: number; rendimiento_promedio?: number; merma_cantidad?: number; merma_costo?: number }
export interface ButcheryTemplate { id: string; nombre?: string; especie?: string; peso_promedio_kg?: number; descripcion?: string; activa?: boolean; cuts?: ButcheryTemplateCut[]; created_at?: string }
export interface ButcheryTemplateCut { id?: string; producto_id?: string; producto_nombre?: string; rendimiento_porcentual?: number; precio_ponderado?: number; orden?: number; es_subproducto?: boolean }
export interface DesposteInput { template_id: string; peso_entrada_kg: number; costo_total_gs: number; fecha_vencimiento?: string; responsable_id?: string; notas?: string }
export interface DesposteCorteResult { producto_id?: string; producto_nombre?: string; rendimiento_esperado?: number; peso_obtenido_kg?: number; costo_unitario_gs?: number; precio_ponderado?: number; es_subproducto?: boolean }
export interface DesposteResponse { orden_id: string; template_nombre?: string; peso_entrada_kg?: number; costo_total_gs?: number; peso_total_obtenido?: number; merma_kg?: number; merma_porcentaje?: number; cortes?: DesposteCorteResult[]; batches?: SupermerBatch[] }
export interface BakeryPlan { id: string; nombre?: string; dia_semana?: number; activo?: boolean; items?: BakeryPlanItem[]; created_at?: string }
export interface BakeryPlanItem { id?: string; receta_id?: string; receta_nombre?: string; cantidad_objetivo?: number; prioridad?: number }
export interface ScaleRecipeResult { receta_nombre?: string; producto_terminado?: string; cantidad_base?: number; cantidad_deseada?: number; factor_escala?: number; items?: any[]; insumos_totales?: any[] }
export interface ScaleRecipeInput { receta_id: string; cantidad_deseada: number }
export interface ExecutePlanResult { plan_nombre?: string; fecha?: string; ordenes_creadas?: number; ordenes?: SupermerOrder[] }
export interface ProduceReceiveBatch { id: string; producto_id?: string; producto_nombre?: string; proveedor_id?: string; proveedor_nombre?: string; cantidad_recibida?: number; cantidad_aceptada?: number; calidad?: string; precio_unitario?: number; fecha_recepcion?: string; fecha_vencimiento_estimada?: string; lote_proveedor?: string; lote_codigo_interno?: string; nota_calidad?: string; rechazo_motivo?: string; registrado_por?: string; registrado_por_nombre?: string; created_at?: string }
export interface ProduceFreshnessAudit { id: string; producto_id?: string; producto_nombre?: string; batch_id?: string; calidad_actual?: string; firmeza?: number; color?: number; aspecto_general?: number; notas?: string; audited_by?: string; audited_at?: string; triggered_markdown?: boolean }
export interface ProduceSupplierScorecard { id: string; proveedor_id?: string; proveedor_nombre?: string; producto_id?: string; producto_nombre?: string; total_recibido?: number; calidad_promedio?: string; merma_porcentaje?: number; rechazos?: number; entregas_puntuales?: number; total_entregas?: number; precio_promedio?: number; puntaje_general?: number; recomendacion?: string; periodo_inicio?: string; periodo_fin?: string; updated_at?: string }
export interface AutoApplyMarkdownByBatchInput { dias_verde?: number; dias_amarillo?: number; descuento_verde?: number; descuento_amarillo?: number; modo?: string }
export interface AutoApplyMarkdownResult { procesados?: number; markdowns_creados?: number; errores?: string[]; detalle?: any[] }
export interface ForecastEnhanceInput { producto_ids?: string[]; lookback_dias?: number; incluir_estacionalidad?: boolean }
export interface ProduceDashboard { total_recibido_hoy?: number; lotes_activos?: number; lotes_por_vencer?: number; auditorias_pendientes?: number; scorecards_generados?: number; proveedores_activos?: number; calidad_promedio_general?: string }
export interface ProductsStatsResponse {
  total_productos: number
  total_pesables: number
  margen_promedio_pct: number
  total_valorizado_costo: number
  total_quiebres: number
  total_bajos: number
}

export interface Product360Response {
  product: {
    id: string
    sku: string
    nombre: string
    codigo_barra?: string | null
    plu_codigo?: string | null
    unidad_medida: string
    tipo: string
    categoria_id?: string | null
    categoria_nombre?: string | null
    precio_venta: number
    costo_promedio: number
    ultimo_costo: number
    stock_minimo: number
    iva_tasa: number
    es_perecedero: boolean
    vida_util_dias?: number
    activo: boolean
  }
  stock: {
    total_fisico: number
    total_reservado: number
    total_disponible: number
    valor_inventario_costo: number
    por_deposito: Array<{
      id: string
      warehouse_id: string
      warehouse_nombre: string
      warehouse_codigo: string
      cantidad: number
      cantidad_reservada: number
      costo_unitario: number
    }>
  }
  rotacion: {
    ventas_ultimos_30d_unidades: number
    ventas_ultimos_30d_gs: number
    demanda_diaria_estimada: number
    autonomia_dias: number
    estado_stock: "critico" | "bajo" | "optimo"
  }
  metricas_financieras: {
    precio_venta: number
    costo_unitario: number
    margen_bruto_monto: number
    margen_bruto_pct: number
    markup_pct: number
  }
  ultimas_compras: Array<{
    id: string
    numero: string
    fecha: string
    estado: string
    cantidad: number
    precio_unitario: number
    total: number
    supplier_nombre?: string
    supplier_ruc?: string
  }>
  ultimas_ventas: Array<{
    id: string
    numero: string
    fecha: string
    venta_total: number
    cantidad: number
    precio_unitario: number
    subtotal: number
    customer_nombre?: string
  }>
  kardex_reciente: Array<{
    id: string
    tipo: string
    cantidad: number
    costo_unitario: number
    motivo?: string
    referencia_type?: string
    created_at: string
    warehouse_nombre?: string
  }>
}

export interface InventoryStatsResponse {
  total_skus_almacenados: number
  total_unidades_fisicas: number
  total_unidades_reservadas: number
  valor_total_costo: number
  valor_total_venta_proyectada: number
  total_quiebres: number
  total_bajos: number
  cant_mermas_mes: number
  monto_mermas_mes_gs: number
}

export interface InventoryMovementRecord {
  id: string
  company_id: string
  warehouse_id: string
  product_id: string
  variant_id?: string | null
  tipo: string
  cantidad: number
  costo_unitario: number
  referencia_type?: string
  referencia_id?: string
  motivo?: string
  user_id?: string
  created_at: string
  product_nombre?: string
  product_sku?: string
  warehouse_nombre?: string
  warehouse_codigo?: string
  user_nombre?: string
  saldo_acumulado?: number
}

export interface InventoryAdjustmentRecord {
  id: string
  codigo: string
  motivo: string
  estado: string
  observaciones?: string
  created_at: string
  fecha_aprobacion?: string
  warehouse_nombre?: string
  warehouse_codigo?: string
  total_items: number
  diferencia_unidades: number
  diferencia_valorizada_gs: number
}

export interface ScaleConfig { id: string; nombre: string; marca: string; modelo?: string; protocolo: string; conexion: string; puerto_com?: string; baudrate: number; data_bits?: number; host?: string; puerto_tcp: number; timeout_segundos: number; vendor_id?: string; product_id?: string; ruta_carga?: string; sync_automatico: boolean; etiqueta_formato: string; etiqueta_cabecera?: string; activa: boolean; created_at: string }
export interface ScaleWeightResult { scale_id: string; scale_nombre: string; protocolo: string; peso_bruto: number; peso_neto?: number; tara: number; unidad: string; estable: boolean; raw_response?: string; timestamp: string }
export interface ConnectionTestResult { scale_id: string; scale_nombre: string; conectada: boolean; protocolo_detectado?: string; mensaje: string; latencia_ms?: number; peso_actual?: number }
export interface GerencialDashboard {
  ventas_hoy: number
  ventas_semana: number
  ventas_mes: number
  margen_promedio: number
  ticket_promedio: number
  clientes_atendidos: number
  productos_vendidos: number
  top_productos: GerencialProductoRanking[]
  ventas_por_hora: GerencialVentaPorHora[]
  deptos: GerencialDeptoPyl[]
}
export interface GerencialProductoRanking {
  producto_id: string
  producto_nombre: string
  categoria?: string | null
  cantidad_vendida: number
  total_ventas: number
  margen: number
  rotacion_dias?: number | null
  participacion_porcentaje: number
}
export interface GerencialVentaPorHora {
  hora: number
  total_ventas: number
  cantidad_transacciones: number
  ticket_promedio: number
}
export interface GerencialDeptoPyl {
  depto: string
  ventas: number
  costo_ventas: number
  margen_bruto: number
  margen_porcentaje: number
  merma_total: number
  merma_porcentaje: number
  markdowns_activos: number
}
export interface GerencialAlertasNegocio {
  margen_bajo: { producto_id: string; producto_nombre: string; cantidad_vendida_30d: number; total_ventas_30d: number; margen_porcentaje: number }[]
  margen_umbral: number
  cxc_vencidas: { cantidad: number; monto: number; total_pendiente: number }
  cxp_vencidas: { cantidad: number; monto: number; total_pendiente: number }
  dias_cobro_promedio: number | null
  dias_pago_promedio: number | null
}
export interface ScalePLUSyncInput { producto_ids?: string[]; modo?: string }
export interface ScalePLUSyncResult { sync_id: string; scale_nombre: string; total_productos: number; exitosos: number; fallidos: number; archivo_generado?: string; errores?: any[] }
export interface ScaleLabelTemplate { id: string; nombre: string; ancho_mm: number; alto_mm: number; campos: any[]; incluir_barcode: boolean; incluir_precio: boolean; incluir_peso: boolean; activo: boolean; created_at: string }
export interface ProtocolDetectInput { conexion?: string; puerto_com?: string; host?: string; puerto_tcp?: number; baudrate?: number; timeout?: number }
export interface PrintLabelInput { scale_id: string; producto_id: string; peso_kg: number; precio_unitario: number; template_id?: string; fecha_vencimiento?: string; lote?: string; cantidad_copias?: number }
export interface WhatsAppConfig { id: string; company_id?: string; tenant_id?: string; numero_telefono?: string; phone_number?: string; account_sid?: string; auth_token?: string; webhook_url?: string; webhook_activo?: boolean; plantilla_bienvenida?: string; plantilla_despedida?: string; horario_atencion_inicio?: string; horario_atencion_fin?: string; dias_atencion?: string[]; fuera_horario_mensaje?: string; activo?: boolean; enabled?: boolean; auto_reply?: boolean; created_at?: string; updated_at?: string }
export interface WhatsAppConversation { id: string; tenant_id?: string; company_id?: string; customer_id?: string; contact_id?: string; customer?: Customer; telefono?: string; nombre_contacto?: string; contact_name?: string; contact_phone?: string; estado?: string; status?: string; ultimo_mensaje?: string; last_message_preview?: string; ultima_respuesta?: string; fecha_ultimo_mensaje?: string; last_message_at?: string; fecha_ultima_respuesta?: string; mensajes_no_leidos?: number; etiquetas?: string[]; asignado_a?: string; session_state?: string; session_data?: Record<string, unknown>; activo?: boolean; created_at?: string; updated_at?: string }
export interface WhatsAppMessage { id: string; tenant_id?: string; message_id?: string; conversacion_id?: string; conversation_id?: string; conversacion?: WhatsAppConversation; direccion?: string; direction?: string; tipo?: string; contenido?: string; content?: string; media_url?: string; estado?: string; status?: string; error_mensaje?: string; fecha_envio?: string; fecha_entrega?: string; fecha_lectura?: string; metadata?: Record<string, unknown>; created_at?: string }
export interface WhatsAppTemplate { id: string; tenant_id?: string; company_id?: string; nombre?: string; name?: string; tipo?: string; categoria?: string; idioma?: string; contenido?: string; content?: string; variables?: string[]; ejemplo?: string; aprobado?: boolean; estado_aprobacion?: string; activo?: boolean; active?: boolean; created_at?: string; updated_at?: string }
export interface WhatsAppStats { id?: string; company_id?: string; fecha?: string; total_conversaciones?: number; total_conversations?: number; conversaciones_activas?: number; active_today?: number; mensajes_enviados?: number; messages_today?: number; mensajes_recibidos?: number; tiempo_respuesta_promedio_min?: number; avg_response_time?: number; satisfaccion_promedio?: number; conversiones?: number; ventas_generadas?: number; created_at?: string }
export interface SifenTimbrado { id: string; company_id?: string; numero?: string; fecha_inicio?: string; fecha_fin?: string; numero_inicio?: number; numero_fin?: number; numero_actual?: number; rango_desde?: number; rango_hasta?: number; estado?: string; activo?: boolean; tipo_comprobante?: string; created_at?: string; updated_at?: string }
export interface SifenResponse { id: string; sale_id?: string; cdc?: string; estado?: string; xml_enviado?: string; xml_sent?: string; xml_respuesta?: string; mensaje?: string; fecha_envio?: string; fecha_respuesta?: string; mensaje_error?: string; codigo_error?: string; created_at?: string }
export interface Currency { id: string; codigo?: string; nombre?: string; simbolo?: string; es_default?: boolean; es_moneda_local?: boolean; tasa_cambio?: number; activo?: boolean; activa?: boolean; created_at?: string; updated_at?: string }
export interface ExchangeRate { id: string; moneda_origen?: string; moneda_destino?: string; tasa?: number; fuente?: string; fecha?: string; created_at?: string }
export interface Tenant { id: string; nombre: string; slug: string; email?: string; plan?: string; estado?: string; config?: Record<string, unknown>; fecha_registro?: string; fecha_inicio?: string; fecha_vencimiento?: string; activo?: boolean; created_at?: string; updated_at?: string }
export interface Vertical { id?: string; slug: string; nombre: string; descripcion: string; features: string[]; config_defaults: Record<string, unknown>; payment_gateways: string[]; icon: string }
export interface CompanyVerticalConfig { vertical_id?: string; features?: string[]; config?: Record<string, unknown> }
export interface IntegrationConfig { id: string; company_id?: string; destino?: string; tipo?: string; nombre?: string; url?: string; token?: string; headers?: Record<string, string>; activo?: boolean; eventos?: string[]; created_at?: string; updated_at?: string }
export interface IntegrationDelivery { id: string; config_id?: string; evento?: string; url?: string; payload?: Record<string, unknown>; payload_size?: number; respuesta_status?: number; respuesta_body?: string; exitoso?: boolean; reintentos?: number; fecha_envio?: string; created_at?: string }
export interface PriceList { id: string; company_id?: string; nombre?: string; tipo?: string; customer_id?: string | null; grupo?: string | null; activo?: boolean; created_at?: string; updated_at?: string }
export interface PriceListItem { id: string; price_list_id?: string; product_id?: string; variant_id?: string | null; precio?: number; moneda?: string; notas?: string | null; activo?: boolean; created_at?: string; updated_at?: string }
export interface PosTerminalTransaction { id: string; company_id?: string; sale_id?: string | null; customer_id?: string | null; tipo_operacion: string; terminal_ip?: string | null; punto_emision?: string | null; factura_nro_provisional?: string | null; bin?: string | null; nsu?: string | null; codigo_autorizacion?: string | null; codigo_comercio?: string | null; issuer_id?: string | null; nombre_tarjeta?: string | null; pan?: string | null; mensaje_display?: string | null; nombre_cliente?: string | null; monto?: number | null; monto_vuelto?: number | null; monto_comision?: number | null; monto_extraccion?: number | null; saldo?: number | null; moneda_alt?: string | null; monto_alt?: number | null; exitosa: boolean; verificado_automaticamente: boolean; error_message?: string | null; raw_response?: any; created_at?: string }
export interface PaymentIntegrationConfig { id: string; company_id: string; provider: string; environment: string; enabled: boolean; config: Record<string, any>; created_at: string; updated_at: string }
export interface Kit { id: string; company_id?: string; nombre?: string; descripcion?: string; sku?: string; precio?: number; costo?: number; margen?: number; items?: KitItem[]; activo?: boolean; created_at?: string; updated_at?: string }
export interface KitItem { id: string; kit_id?: string; producto_id?: string; producto?: Product; cantidad?: number; precio_unitario?: number; subtotal?: number; created_at?: string }
export interface Backup { id: string; company_id?: string; tenant_id?: string; tenant_slug?: string | null; schema_name?: string; nombre?: string; filename?: string; file_size?: number; status?: string; backup_type?: string; expires_at?: string; tipo?: string; ruta?: string; tamano_bytes?: number; estado?: string; fecha_inicio?: string; fecha_fin?: string; duracion_seg?: number; error_mensaje?: string; created_at?: string }
export interface BackupScheduleConfig { id?: string; company_id?: string; frequency?: "hourly" | "daily" | "weekly" | "monthly"; frecuencia?: string; enabled?: boolean; hour?: number; minute?: number; day_of_week?: string | number | null; day_of_month?: number | null; hora?: string; dia_semana?: string; dia_mes?: number; retencion_dias?: number; retention_days?: number; max_backups?: number | null; activo?: boolean; notificar_email?: boolean; email_notificacion?: string; created_at?: string; updated_at?: string }
export type ReturnType = Return
export type ReturnItemType = ReturnItem
export interface AccountsReceivable { id: string; company_id?: string; customer_id?: string; customer?: Customer; customer_name?: string; sale_id?: string; numero_documento?: string; saldo?: number; saldo_pendiente?: number; limite_credito?: number; porcentaje_uso?: number; monto_original?: number; fecha_emision?: string; fecha_vencimiento?: string; dias_mora?: number; estado?: string; activo?: boolean; created_at?: string; updated_at?: string }
export interface BancardTransaction { id: string; company_id: string; order_id: string; amount: number; currency: string; status: string; token?: string; process_id?: string; checkout_url?: string; authorization_code?: string; card_last4?: string; card_brand?: string; terminal_id?: string; payment_type: string; error_message?: string; created_at: string; updated_at: string }
export interface BancardCheckoutResponse { payment_id: string; process_id: string; checkout_url: string; status: string; amount: number; order_id: string }
export interface SpiQr { id: string; company_id?: string; monto?: number; moneda?: string; estado?: string; qr_data?: string; qr_image_url?: string; qr_image_base64?: string; referencia?: string; order_id?: string; merchant_name?: string; descripcion?: string; description?: string; customer_email?: string; customer_name?: string; bcp_transaction_id?: string; fecha_expiracion?: string; fecha_pago?: string; payment_id?: string; amount?: number; status?: string; created_at?: string; updated_at?: string }
export interface DinelcoTransaction { id: string; company_id: string; order_id: string; amount: number; currency: string; status: string; payment_id?: string; checkout_url?: string; customer_email?: string; customer_name?: string; installments: number; authorization_code?: string; card_last4?: string; card_brand?: string; error_message?: string; created_at: string; updated_at: string }
export interface DinelcoCheckoutResponse { payment_id: string; checkout_url: string; status: string; amount: number; order_id: string; installments: number }
export interface EmailConfig { id: string; company_id?: string; smtp_host?: string; smtp_port?: number; smtp_user?: string; smtp_password?: string; from_email?: string; from_name?: string; use_tls?: boolean; activo?: boolean; created_at?: string; updated_at?: string }
export interface EventStream { id: string; tipo?: string; mensaje?: string; datos?: Record<string, unknown>; timestamp?: string }
export interface ImportTemplate { id: string; company_id?: string; nombre?: string; tipo?: string; columnas?: string[]; mapeo?: Record<string, string>; activo?: boolean; created_at?: string }
export interface ImportResult { id: string; template_id?: string; estado?: string; total_registros?: number; exitosos?: number; errores?: number; detalle?: Record<string, unknown>[]; created_at?: string }
export interface LoyaltyConfig { id: string; company_id: string; puntos_por_guarani: number; guarani_por_punto: number; vencimiento_dias: number; canje_minimo_puntos: number; bienvenida_puntos: number; cumpleanos_puntos: number; crear_en_venta: boolean; activo: boolean; created_at: string; updated_at: string }
export interface LoyaltyPoints { id: string; company_id: string; customer_id: string; tipo: string; puntos: number; referencia_tipo?: string; referencia_id?: string; descripcion?: string; vence_en?: string; created_at: string }
export interface LoyaltyReward { id: string; company_id: string; nombre: string; descripcion?: string; puntos_requeridos: number; tipo_recompensa: string; valor_recompensa?: number; stock?: number; imagen_url?: string; activo: boolean; created_at: string; updated_at: string }
export interface PortalCustomer { id: string; nombre?: string; email?: string; telefono?: string; saldo?: number; total_compras?: number; ultima_compra?: string; created_at?: string }
export interface SecurityApiKey { id: string; company_id?: string; nombre?: string; key_hash?: string; scopes?: string[]; ultimo_uso?: string; activo?: boolean; created_at?: string; updated_at?: string }
export interface Receipt { id: string; sale_id?: string; cdc?: string; numero?: string; fecha?: string; total?: number; moneda?: string; estado?: string; qr_url?: string; pdf_url?: string; created_at?: string }
export interface ReportFilter { fecha_desde?: string; fecha_hasta?: string; agrupar_por?: string; category_id?: string; product_id?: string; customer_id?: string; warehouse_id?: string; branch_id?: string }
export interface SalesByPeriodReport { periodo?: string; cantidad_ventas?: number; total_ventas?: number; total_iva?: number; total_costo?: number; margen?: number; cantidad_items?: number }
export interface InventoryReport { producto_id?: string; producto?: Product; warehouse_id?: string; warehouse?: Warehouse; cantidad?: number; costo_promedio?: number; valor_total?: number; stock_minimo?: number; alerta?: boolean }
export interface FifoReport { producto_id?: string; producto?: Product; lote?: string; fecha_ingreso?: string; cantidad?: number; costo_unitario?: number; valor_total?: number; dias_stock?: number }
export interface LifoReport { producto_id?: string; producto?: Product; lote?: string; fecha_ingreso?: string; cantidad?: number; costo_unitario?: number; valor_total?: number; dias_stock?: number }
export interface CostComparisonReport { producto_id?: string; producto?: Product; costo_fifo?: number; costo_lifo?: number; costo_promedio?: number; diferencia_fifo_lifo?: number; diferencia_fifo_promedio?: number; recomendacion?: string }
export interface FiscalBookReport { tipo?: string; periodo?: string; numero?: string; fecha?: string; ruc?: string; razon_social?: string; gravada_10?: number; gravada_5?: number; exenta?: number; total_iva_10?: number; total_iva_5?: number; total?: number }
export interface FinancialSummaryReport { fecha?: string; ingresos?: number; egresos?: number; utilidad?: number; ventas_contado?: number; ventas_credito?: number; cobranzas?: number; pagos?: number }
export interface CashSessionSummary { session_id?: string; caja?: CashRegister; usuario?: string; fecha_apertura?: string; fecha_cierre?: string; monto_apertura?: number; monto_cierre?: number; diferencia?: number; total_ventas?: number; total_retiros?: number; total_ingresos?: number; estado?: string }
export interface ShiftReport { session_id?: string; usuario?: string; fecha?: string; hora_inicio?: string; hora_fin?: string; total_ventas?: number; total_items?: number; ticket_promedio?: number; efectivo?: number; tarjeta?: number; transferencia?: number; credito?: number; otros?: number }
export interface CommercialAgreement { id: string; company_id?: string; supplier_id?: string; supplier?: Supplier; nombre?: string; descripcion?: string; tipo?: string; fecha_inicio?: string; fecha_fin?: string; descuento_general?: number; volumen_minimo?: number; monto_minimo?: number; plazo_pago_dias?: number; exclusividad?: boolean; estado?: string; activo?: boolean; archivo_url?: string; renovacion_automatica?: boolean; created_at?: string; updated_at?: string }
export interface AgreementItem { id: string; agreement_id?: string; producto_id?: string; producto?: Product; descuento?: number; precio_fijo?: number; margen_minimo?: number; volumen_minimo?: number; activo?: boolean; created_at?: string }
export interface AgreementRebate { id: string; agreement_id?: string; periodo?: string; tipo?: string; porcentaje?: number; monto?: number; volumen_minimo?: number; monto_minimo?: number; estado?: string; observaciones?: string; created_at?: string }
export interface AgreementVolume { id: string; agreement_id?: string; supplier_id?: string; periodo?: string; tipo?: string; volumen_objetivo?: number; volumen_alcanzado?: number; porcentaje_cumplimiento?: number; rebate_obtenido?: number; estado?: string; observaciones?: string; created_at?: string }
export interface SupplierNegotiation { id: string; agreement_id?: string; supplier_id?: string; fecha?: string; tema?: string; resultado?: string; compromisos?: string; proxima_reunion?: string; estado?: string; observaciones?: string; created_at?: string }
export interface InteliContEntry { id: string; company_id?: string; fecha?: string; tipo?: string; numero?: string; concepto?: string; monto_debe?: number; monto_haber?: number; cuenta_codigo?: string; cuenta_nombre?: string; documento_tipo?: string; documento_numero?: string; estado?: string; error_mensaje?: string; created_at?: string; updated_at?: string }
export interface InteliAuditEvent { id: string; company_id?: string; fecha?: string; tipo?: string; modulo?: string; entidad_id?: string; entidad_tipo?: string; usuario_id?: string; accion?: string; datos_anteriores?: Record<string, unknown>; datos_nuevos?: Record<string, unknown>; ip_address?: string; user_agent?: string; riesgo_score?: number; estado?: string; created_at?: string }
export interface SueldokPayroll { id: string; company_id?: string; periodo?: string; fecha_inicio?: string; fecha_fin?: string; total_neto?: number; total_bruto?: number; total_descuentos?: number; total_aportes?: number; cantidad_empleados?: number; estado?: string; created_at?: string; updated_at?: string }
export interface Promotion {
  id: string
  company_id?: string
  nombre: string
  descripcion?: string
  tipo: string
  valor?: number
  precio_fijo_promocional?: number
  valor_maximo?: number
  aplica_a: string
  producto_ids?: string[]
  categoria_ids?: string[]
  
  origen?: string
  financiamiento?: string
  supplier_id?: string
  purchases_invoices_ids?: string[]
  
  costo_unitario_referencia?: number
  vende_bajo_costo?: boolean
  estado?: string
  aprobado_por?: string
  fecha_aprobacion?: string
  
  limite_por_compra?: number
  limitar_unidades?: boolean
  stock_limite_unidades?: number
  unidades_vendidas_promo?: number
  unidades_disponibles_promo?: number
  
  monto_minimo_compra?: number
  cantidad_minima?: number
  cantidad_maxima_items?: number
  aplicaciones_por_cliente?: number
  combinable?: boolean
  valido_desde?: string
  valido_hasta?: string
  horario_desde?: string
  horario_hasta?: string
  dias_semana?: number[]
  codigo_cupon?: string
  requiere_cupon?: boolean
  
  nc_estado?: string
  nc_numero_proveedor?: string
  nc_timbrado_proveedor?: string
  nc_monto_total?: number
  
  porcentaje_aporte_proveedor?: number
  porcentaje_aporte_tienda?: number
  monto_aporte_proveedor_pyg?: number
  monto_aporte_tienda_pyg?: number

  origen_fuente?: string
  legacy_id?: number
  
  usos_maximos?: number
  usos_actuales?: number
  activo?: boolean
  created_at?: string
}
export interface PromotionUsage { id: string; promotion_id?: string; sale_id?: string; customer_id?: string; branch_id?: string; codigo_cupon?: string; descuento_aplicado?: number; items_aplicados?: string[]; created_at?: string }
export interface MobileDashboard { recepciones_pendientes: number; inventarios_pendientes: number; sugerencias_pendientes: number; entregas_hoy: number }
export interface InventoryCountItem { product_id: string; cantidad_real: number; lote?: string; fecha_vencimiento?: string }
export interface InventoryCountInput { warehouse_id: string; items: InventoryCountItem[] }
export interface InventoryCountResult { procesados: number; discrepancias: { product_id: string; cantidad_sistema: number; cantidad_real: number; diferencia: number }[] }
export interface ReceiveRemitItem { product_id: string; cantidad_recibida: number; lote?: string; fecha_vencimiento?: string }
export interface ReceiveRemitInput { orden_id: string; items: ReceiveRemitItem[] }
export interface ReceiveRemitResult { orden_id: string; procesados: number; errores: string[] }
export interface ApproveSuggestionInput { suggestion_ids: string[] }
export interface EcommerceSyncLog { id: string; company_id?: string; tipo: string; estado: string; productos_count: number; errores_count: number; resultado?: string | null; created_at?: string }
export interface EcommerceSyncResult { sync_id: string; tipo: string; productos_procesados: number; errores: string[] }
export interface MigrationLog { id: string; company_id?: string; tipo: string; origen: string; archivo_nombre?: string | null; estado: string; total_registros: number; importados: number; errores: number; errores_detalle?: string | null; created_at?: string }
export interface MigrationPreview { columnas: string[]; filas_ejemplo: string[][]; total_filas: number; tipo_detectado: string }
export interface MigrationImportResult { log_id: string; tipo: string; total: number; importados: number; errores: number; errores_detalle: string[] }
export interface FiscalConfig { id: string; company_id: string; modo_emision: string; punto_emision: string; timbrado_id?: string; created_at?: string; updated_at?: string }
export interface TimbradoUsage { id: string; timbrado_id: string; tipo_comprobante: string; numero_utilizado: number; created_at: string }
export interface NotaCreditoDebito { id: string; company_id: string; sale_id: string; tipo: string; numero_nota: string; motivo: string; total: number; estado: string; cdc?: string; xml_enviado?: string; xml_respuesta?: string; created_at: string }
export interface ImportContainer { id: string; company_id: string; supplier_id: string; numero_contenedor: string; booking?: string; viaje?: string; puerto_origen: string; puerto_destino: string; incoterm: string; fecha_zarpe?: string; fecha_llegada?: string; fecha_estiba?: string; fecha_nacionalizacion?: string; estado: string; valor_fob_total: number; flete_total: number; seguro_total: number; arancel_total: number; costo_landed_total: number; notas?: string; created_at: string }
export interface CustomerAgreement { id: string; company_id: string; customer_id: string; numero: string; nombre: string; tipo: string; fecha_inicio: string; fecha_fin: string; descuento_general_pct: number; plazo_pago_dias: number; limite_credito: number; estado: string; created_at: string }
export interface SalesRoute { id: string; company_id: string; nombre: string; codigo?: string; user_id: string; dias_semana?: number[]; zona?: string; estado: string }
export interface RouteVisit { id: string; route_id: string; customer_id: string; user_id: string; fecha_planificada: string; fecha_visita?: string; estado: string; resultado?: string; monto_cobrado?: number; notas?: string; created_at: string }
export interface CustomerCreditLimit { id: string; company_id: string; customer_id: string; limite_credito: number; limite_disponible: number; saldo_utilizado: number; dias_credito: number; scoring?: number; bloqueado_por_mora: boolean; created_at: string }
export interface CreditAuthorization { id: string; company_id: string; customer_id: string; monto_solicitado: number; monto_autorizado?: number; motivo?: string; estado: string; created_at: string }
export interface DistribuidoraDashboard { total_clientes: number; clientes_con_credito: number; clientes_bloqueados: number; ventas_mes: number; margen_promedio: number; facturas_vencidas: number; monto_vencido: number; contenedores_en_transito: number; contenedores_en_aduanas: number; productos_bajo_stock: number; visitas_hoy: number; visitas_completadas_hoy: number }
export interface ExpenseCategory { id: string; nombre: string; descripcion?: string; presupuesto_mensual?: number; activo?: boolean; created_at?: string }
export interface CostCenter { id: string; nombre: string; tipo: "sector" | "global"; peso_prorateo: number; activo?: boolean; created_at?: string }
export interface Expense { id: string; company_id?: string; branch_id?: string; fund_id?: string; category_id?: string; cost_center_id?: string; monto: number; descripcion: string; proveedor?: string; comprobante_url?: string; tipo_pago?: string; fecha_gasto?: string; registrado_por?: string; aprobado_por?: string; aprobado_at?: string; rechazado_por?: string; rechazado_at?: string; rechazado_motivo?: string; anulado?: boolean; anulado_por?: string; anulado_at?: string; anulado_motivo?: string; estado?: string; notas?: string; created_at?: string }
export interface PettyCashFund { id: string; company_id: string; branch_id?: string | null; branch_nombre?: string | null; nombre: string; custodio_id?: string | null; custodio_nombre?: string | null; monto_autorizado: number; saldo_actual: number; activo: boolean; created_at?: string }
export interface PettyCashFundMovement { id: string; fund_id: string; tipo: string; monto: number; saldo_anterior: number; saldo_nuevo: number; referencia_type?: string | null; referencia_id?: string | null; observaciones?: string | null; created_at?: string }
export interface PettyCashFundCount { id: string; fund_id: string; contado_por: string; contado_por_nombre?: string | null; saldo_esperado: number; monto_contado: number; diferencia: number; requiere_revision: boolean; estado: string; confirmado_por?: string | null; confirmado_por_nombre?: string | null; fecha_confirmacion?: string | null; ajusto_saldo: boolean; observaciones?: string | null; created_at?: string }
export interface ExpenseSummary { total_dia: number; total_semana: number; total_mes: number; por_categoria: any[]; por_sucursal: any[]; pendientes_aprobacion: number }
export interface ExpenseDashboard {
  fecha_desde: string; fecha_hasta: string
  total_periodo: number; total_periodo_anterior: number; variacion_pct: number | null
  por_categoria: { category_id: string | null; nombre: string; total: number; presupuesto_prorateado: number | null; pct_usado: number | null; sobre_presupuesto: boolean; variacion_pct: number | null }[]
  por_sector: { cost_center_id: string; nombre: string; directo: number; prorrateado: number; total: number }[]
  sin_asignar: number
  tendencia_mensual: { mes: string; total: number }[]
  top_proveedores: { proveedor: string; total: number }[]
  sugerencias: { tipo: string; titulo: string; detalle: string }[]
}
export interface SupplierInvoice { id: string; company_id?: string; supplier_id?: string; supplier_nombre?: string; numero_factura?: string; timbrado?: string; cdc?: string; fecha_emision?: string; fecha_recepcion?: string; fecha_vencimiento?: string; subtotal?: number; descuento?: number; iva_10?: number; iva_5?: number; total?: number; saldo_pendiente?: number; moneda?: string; condicion?: string; tipo_comprobante?: string; estado?: string; concepto?: string; notas?: string; created_by?: string; approved_by?: string; purchase_order_id?: string; created_at?: string }
export interface SupplierInvoicePayment { id: string; invoice_id?: string; payment_method?: string; monto?: number; moneda?: string; fecha_pago?: string; referencia?: string; estado?: string; created_at?: string }
export interface BankAccount { id: string; company_id?: string; banco?: string; tipo?: string; numero_cuenta?: string; moneda?: string; saldo_inicial?: number; saldo_actual?: number; titular?: string; activo?: boolean; saldo_minimo_alerta?: number | null; saldo_verificado_manualmente?: boolean; saldo_verificado_at?: string | null; saldo_verificado_por?: string | null; created_at?: string }
export interface BankBalanceCorrection { id: string; company_id?: string; bank_account_id: string; origen: string; saldo_actual: number; saldo_propuesto: number; motivo?: string; estado: string; solicitado_por?: string | null; aprobado_supervisor_id?: string | null; aprobado_supervisor_at?: string | null; aprobado_gerente_id?: string | null; aprobado_gerente_at?: string | null; rechazado_por?: string | null; rechazado_motivo?: string | null; created_at?: string }
export interface BankTransaction { id: string; company_id?: string; bank_account_id?: string; fecha?: string; tipo?: string; monto?: number; moneda?: string; descripcion?: string; referencia?: string; contraparte?: string; conciliado?: boolean; categoria?: string; invoice_id?: string; created_at?: string }
export interface CashFlowProjection { id: string; company_id?: string; fecha?: string; saldo_inicial?: number; ingresos_estimados?: number; egresos_estimados?: number; saldo_final_proyectado?: number; ingresos_reales?: number; egresos_reales?: number; saldo_final_real?: number; created_at?: string }
export interface Budget { id: string; company_id?: string; nombre?: string; periodo?: string; categoria?: string; monto_presupuestado?: number; monto_ejecutado?: number; monto_disponible?: number; area?: string; tipo?: string; created_at?: string }
export interface PaymentRun { id: string; company_id?: string; nombre?: string; fecha_programada?: string; total_monto?: number; estado?: string; metodo_pago?: string; bank_account_id?: string; created_by?: string; approved_by?: string; items?: PaymentRunItem[]; created_at?: string }
export interface PaymentRunItem { id: string; payment_run_id?: string; invoice_id?: string; supplier_id?: string; monto_programado?: number; monto_pagado?: number; estado?: string; created_at?: string }
export interface APDashboard { total_pendiente: number; total_vencido: number; total_por_vencer: number; facturas_pendientes: number; facturas_vencidas: number; proveedores_con_deuda: number; aging_30: number; aging_60: number; aging_90: number; aging_90_plus: number }
export interface CashFlowDashboard { saldo_bancario: number; ingresos_hoy: number; egresos_hoy: number; saldo_proyectado_7d: number; saldo_proyectado_30d: number; proyecciones: any[] }
export interface FinancialDashboard { ap_dashboard?: APDashboard; ar_summary?: any; cash_flow?: CashFlowDashboard; budget_summary?: any[]; liquidity_ratio?: number; rotacion_cartera_dias?: number; rotacion_proveedores_dias?: number }
export interface FinancialRatios { liquidity_ratio?: number; quick_ratio?: number; rotacion_cartera_dias?: number; rotacion_proveedores_dias?: number; ciclo_efectivo_dias?: number }
export interface IntelliZappCampaign { id: string; name: string; description?: string; tipo: string; segment_filters?: any; template_id?: string; message_template?: string; scheduled_at?: string; sent_at?: string; completed_at?: string; status: string; total_recipients: number; sent_count: number; delivered_count: number; read_count: number; replied_count: number; created_at: string; updated_at: string }
export interface IntelliZappCampaignRecipient { id: string; campaign_id: string; customer_id?: string; contact_phone: string; contact_name?: string; status: string; error_message?: string; sent_at?: string; delivered_at?: string; read_at?: string; replied_at?: string; created_at: string }
export interface IntelliZappAutomationRule { id: string; name: string; trigger_event: string; conditions?: any; template_id?: string; message_template?: string; delay_minutes: number; active: boolean; created_at: string; updated_at: string }
export interface IntelliZappAnalytics { total_campaigns: number; total_sent: number; total_delivered: number; total_read: number; total_replied: number; campaigns_by_status: Record<string, number>; delivery_rate: number; read_rate: number; reply_rate: number }
export interface ChatbotTestResponse { response_text: string; buttons: Array<{ id: string; title: string }>; next_state: string; state_description: string; conversation_id: string }
export interface BranchPrice { id: string; branch_id?: string; branch_nombre?: string; product_id?: string; product_nombre?: string; precio: number; created_at?: string; updated_at?: string }
export interface BranchTransferItem { id: string; product_id?: string; product_nombre?: string; cantidad: number; costo_unitario?: number; cantidad_recibida?: number }
export interface BranchTransfer { id: string; company_id?: string; origen_branch_id?: string; origen_nombre?: string; destino_branch_id?: string; destino_nombre?: string; numero: string; estado: string; notas?: string; transportista?: string; items?: BranchTransferItem[]; created_by?: string; approved_by?: string; created_at?: string; updated_at?: string }
export interface BranchDashboardItem { branch_id: string; branch_nombre: string; total_ventas: number; cantidad_ventas: number; stock_valor: number; total_gastos: number }
export interface ConsolidatedDashboard { total_branches: number; total_ventas: number; total_stock_valor: number; transferencias_pendientes: number; branches: BranchDashboardItem[] }

export type ApiError = { detail: string; code?: string }

// ========== API CLIENT ==========
export const api = {
  auth: {
    login: (data: { email: string; password: string }) => client.post<{ access_token: string; refresh_token: string }>("/v1/auth/login", data),
    register: (data: { email: string; password: string; nombre: string; tenant_nombre: string }) => client.post<{ access_token: string; refresh_token: string }>("/v1/auth/register", data),
    me: () => client.get<{ id: string; email: string; nombre: string; rol: string; activo: boolean; tenant_id?: string; tenant_slug?: string }>("/v1/auth/me"),
    myTenants: () => client.get<Array<{ tenant_id: string; tenant_nombre: string; tenant_slug: string; plan: string; rol: string }>>("/v1/auth/me/tenants"),
    changePassword: (data: { current_password: string; new_password: string }) => client.post<{ message: string }>("/v1/auth/change-password", data),
    verifySupervisor: (data: { email: string; password: string }) => client.post<{ valid: boolean; id?: string; nombre?: string; rol?: string }>("/v1/auth/verify-supervisor", data),
    users: {
      list: () => client.get<TenantUser[]>("/v1/auth/users"),
      create: (data: { email: string; password?: string; nombre: string; telefono?: string; rol?: string; role_id?: string }) =>
        client.post<{ id: string; email: string; nombre: string; rol: string; temporary_password?: string }>("/v1/auth/users", data),
      update: (id: string, data: { nombre?: string; telefono?: string; rol?: string; activo?: boolean; foto_url?: string }) =>
        client.patch<TenantUser>(`/v1/auth/users/${id}`, data),
      delete: (id: string) => client.delete<{ success: boolean; message: string }>(`/v1/auth/users/${id}`),
      resetPassword: (id: string, newPassword?: string) =>
        client.post<{ temporary_password?: string; message: string }>(`/v1/auth/users/${id}/reset-password`, { new_password: newPassword }),
      uploadPhoto: async (id: string, file: File) => {
        const formData = new FormData()
        formData.append("file", file)
        const token = localStorage.getItem("access_token")
        const res = await fetch(`${API_BASE}/v1/auth/users/${id}/photo`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: "Error al subir la foto" }))
          throw new Error(err.detail || "Error al subir la foto")
        }
        return res.json() as Promise<{ foto_url: string; message: string }>
      },
    },
    posStaff: () => client.get<any>("/v1/auth/pos-staff"),
    posSupervisors: () => client.get<any>("/v1/auth/pos-supervisors"),
    startPosShift: (data?: any) => client.post<any>("/v1/auth/pos-shift/start", data),
    posAuthorizers: () => client.get<any>("/v1/auth/pos-authorizers"),
    activeSupervisor: () => client.get<any>("/v1/auth/pos-active-supervisor"),
    endPosShift: () => client.post<any>("/v1/auth/pos-shift/end"),
  },
  admin: {
    tenants: (params?: { estado?: string; plan?: string; search?: string }) => client.get<Tenant[]>("/v1/admin/tenants", params),
    tenantStats: () => client.get<{ total_tenants: number; by_plan: Record<string, number>; by_estado: Record<string, number>; mrr_usd: number }>("/v1/admin/tenants/stats"),
    plans: () => client.get<Array<{ slug: string; nombre: string; precio_mensual_usd: number; features: string[]; limits: Record<string, unknown> }>>("/v1/admin/plans"),
    updateTenantPlan: (tenantId: string, plan: string) => client.patch<any>(`/v1/admin/tenants/${tenantId}/plan`, { plan }),
    updateTenantEstado: (tenantId: string, estado: string) => client.patch<any>(`/v1/admin/tenants/${tenantId}/estado`, { estado }),
    getTenantConfig: (tenantId: string) => client.get<any>(`/v1/admin/tenants/${tenantId}/config`),
    getMyTenantConfig: () => client.get<any>(`/v1/admin/tenants/me/config`),
    updateTenantConfig: (tenantId: string, data: unknown) => client.put<any>(`/v1/admin/tenants/${tenantId}/config`, data),
    resetTenantConfig: (tenantId: string) => client.post<any>(`/v1/admin/tenants/${tenantId}/config/reset`, {}),
    verticals: () => client.get<Vertical[]>("/v1/admin/verticals"),
    features: () => client.get<Array<{ key: string; label: string }>>("/v1/admin/features"),
  },
  companies: {
    list: () => client.get<Company[]>("/v1/companies"),
    get: (id: string) => client.get<Company>(`/v1/companies/${id}`),
    create: (data: Partial<Company>) => client.post<Company>("/v1/companies", data),
    update: (id: string, data: Partial<Company>) => client.patch<Company>(`/v1/companies/${id}`, data),
    uploadLogo: (id: string, file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      return requestMultipart<Company>(`/v1/companies/${id}/logo`, formData)
    },
    delete: (id: string) => client.delete<void>(`/v1/companies/${id}`),
  },
  categories: {
    list: () => client.get<Category[]>(`/v1/companies/${COMPANY_ID}/categories`),
    get: (id: string) => client.get<Category>(`/v1/companies/${COMPANY_ID}/categories/${id}`),
    create: (data: { nombre: string; codigo?: string; parent_id?: string }) => client.post<Category>("/v1/categories", { ...data, company_id: COMPANY_ID }),
    update: (id: string, data: Partial<Category>) => client.patch<Category>(`/v1/categories/${id}`, data),
    delete: (id: string) => client.delete<void>(`/v1/categories/${id}`),
  },
  products: {
    list: (params?: { search?: string; categoria_id?: string; supplier_id?: string; activo?: boolean; limit?: number; offset?: number }) => client.get<Product[]>(`/v1/companies/${COMPANY_ID}/products`, { search: params?.search, categoria_id: params?.categoria_id, supplier_id: params?.supplier_id, activo: params?.activo?.toString(), limit: params?.limit, offset: params?.offset }),
    get: (id: string) => client.get<Product>(`/v1/products/${id}`),
    getStats: () => client.get<ProductsStatsResponse>(`/v1/companies/${COMPANY_ID}/products/stats`),
    get360: (id: string) => client.get<Product360Response>(`/v1/products/${id}/360`),
    create: (data: Partial<Product> & { sku: string; nombre: string }) => client.post<Product>("/v1/products", { ...data, company_id: COMPANY_ID }),
    update: (id: string, data: Partial<Product>) => client.patch<Product>(`/v1/products/${id}`, data),
    delete: (id: string) => client.delete<void>(`/v1/products/${id}`),
    variants: {
      list: (productId?: string) => client.get<ProductVariant[]>(`/v1/companies/${COMPANY_ID}/variants`, { product_id: productId } as any),
      create: (productId: string, data: { tipo: string; valor: string; sku_variante?: string; codigo_barra?: string; precio_extra?: number; stock?: number }) =>
        client.post<ProductVariant>(`/v1/products/${productId}/variants`, { ...data, company_id: COMPANY_ID }),
      delete: (variantId: string) => client.delete<void>(`/v1/variants/${variantId}`),
    },
  },
  inventory: {
    getStockMap: () => client.get<Record<string, number>>(`/v1/companies/${COMPANY_ID}/stock-map`),
    getProductStock: (productId: string) => client.get<any>(`/v1/companies/${COMPANY_ID}/products/${productId}/stock`),
    getStats: () => client.get<InventoryStatsResponse>(`/v1/companies/${COMPANY_ID}/inventory/stats`),
    getLotsExpiries: (params?: { warehouse_id?: string; estado?: string; limit?: number; offset?: number }) =>
      client.get<any>(`/v1/companies/${COMPANY_ID}/inventory/lots/expiries`, params),
    listMovements: (params?: { product_id?: string; warehouse_id?: string; tipo?: string; fecha_desde?: string; fecha_hasta?: string; limit?: number; offset?: number }) =>
      client.get<InventoryMovementRecord[]>(`/v1/inventory/movements`, { company_id: COMPANY_ID, ...params } as any),
    getKardexSummary: (params?: { fecha_desde?: string; fecha_hasta?: string }) =>
      client.get<any>(`/v1/companies/${COMPANY_ID}/inventory/movements/summary`, params as any),
    downloadKardexExcel: (params?: { fecha_desde?: string; fecha_hasta?: string; tipo?: string; product_id?: string }) =>
      downloadAuthenticated(`/v1/companies/${COMPANY_ID}/inventory/movements/export.xlsx`, params, "kardex.xlsx"),
    downloadKardexPdf: (params?: { fecha_desde?: string; fecha_hasta?: string; tipo?: string; product_id?: string }) =>
      downloadAuthenticated(`/v1/companies/${COMPANY_ID}/inventory/movements/export.pdf`, params, "kardex.pdf"),
    listAdjustments: (params?: { warehouse_id?: string; estado?: string; limit?: number; offset?: number }) =>
      client.get<InventoryAdjustmentRecord[]>(`/v1/companies/${COMPANY_ID}/adjustments`, params as any),
    recordMerma: (data: { warehouse_id: string; product_id: string; cantidad: number; motivo: string; observaciones?: string }) =>
      client.post<any>(`/v1/inventory/mermas`, { ...data, company_id: COMPANY_ID }),
    createAdjustment: (data: any) => client.post<any>(`/v1/inventory/adjustments`, { ...data, company_id: COMPANY_ID }),
    approveAdjustment: (id: string) => client.post<any>(`/v1/inventory/adjustments/${id}/approve`),
    sessions: {
      list: (params?: { area?: string; estado?: string }) => client.get<any[]>("/v1/supermer/inventory/sessions", params),
      get: (id: string) => client.get<any>(`/v1/supermer/inventory/sessions/${id}`),
      create: (data: any) => client.post<any>("/v1/supermer/inventory/sessions", data),
      update: (id: string, data: any) => client.put<any>(`/v1/supermer/inventory/sessions/${id}`, data),
      complete: (id: string) => client.post<any>(`/v1/supermer/inventory/sessions/${id}/complete`),
      items: {
        list: (sessionId: string, params?: { requiere_ajuste?: boolean }) => client.get<any[]>(`/v1/supermer/inventory/sessions/${sessionId}/items`, params),
        create: (sessionId: string, data: any) => client.post<any>(`/v1/supermer/inventory/sessions/${sessionId}/items`, data),
        batchCreate: (sessionId: string, data: any[]) => client.post<any[]>(`/v1/supermer/inventory/sessions/${sessionId}/items/batch`, data),
      },
      adjustments: {
        list: (sessionId: string, params?: { estado?: string }) => client.get<any[]>(`/v1/supermer/inventory/sessions/${sessionId}/adjustments`, params),
        create: (sessionId: string, data: any) => client.post<any>(`/v1/supermer/inventory/sessions/${sessionId}/adjustments`, data),
      },
    },
    items: {
      update: (itemId: string, data: any) => client.put<any>(`/v1/supermer/inventory/items/${itemId}`, data),
    },
    adjustments: {
      approve: (adjId: string) => client.post<any>(`/v1/supermer/inventory/adjustments/${adjId}/approve`),
      reject: (adjId: string) => client.post<any>(`/v1/supermer/inventory/adjustments/${adjId}/reject`),
    },
    dashboard: () => client.get<any>("/v1/supermer/inventory/dashboard"),
  },
  customers: {
    list: (params?: { search?: string; tipo?: string; activo?: boolean; exclude_proveedores?: boolean; limit?: number; offset?: number }) => client.get<Customer[]>(`/v1/companies/${COMPANY_ID}/customers`, params),
    get: (id: string) => client.get<Customer>(`/v1/customers/${id}`),
    get360: (id: string) => client.get<any>(`/v1/customer360/profile/${id}`),
    lookupRuc: (doc: string) => client.get<{ ruc: string; ci: string; dv: string; nombre: string; razon_social: string; telefono?: string; email?: string; encontrado_en_db: boolean; fuente: string }>(`/v1/customers/lookup-ruc/${doc}`),
    create: (data: Partial<Customer>) => client.post<Customer>("/v1/customers", { ...data, company_id: COMPANY_ID }),
    update: (id: string, data: Partial<Customer>) => client.patch<Customer>(`/v1/customers/${id}`, data),
    delete: (id: string) => client.delete<void>(`/v1/customers/${id}`),
  },
  sales: {
    list: (params?: { fecha_desde?: string; fecha_hasta?: string; desde?: string; hasta?: string; estado?: string }) => client.get<Sale[]>(`/v1/companies/${COMPANY_ID}/sales`, params as any),
    get: (id: string) => client.get<Sale>(`/v1/sales/${id}`),
    create: (data: Partial<Sale> & { items: SaleItem[]; payments?: { forma_pago: string; monto: number; moneda?: string }[]; admin_override_credito?: boolean }) => client.post<Sale>("/v1/sales", data),
    cancel: (id: string) => client.post<void>(`/v1/sales/${id}/cancel`),
    items: (id: string) => client.get<SaleItem[]>(`/v1/sales/${id}/items`),
    getItems: (id: string) => client.get<SaleItem[]>(`/v1/sales/${id}/items`),
    addPayment: (id: string, data: { monto: number; metodo_pago_id?: string; payment_method_id?: string; referencia?: string }) => client.post<any>(`/v1/sales/${id}/payments`, data),
    linkQuote: (id: string, quoteId: string) => client.post<any>(`/v1/sales/${id}/link-quote`, { quote_id: quoteId }),
    linkOrder: (id: string, orderId: string) => client.post<any>(`/v1/sales/${id}/link-order`, { order_id: orderId }),
    attachTicket: (id: string, ticketB64: string) => client.patch<any>(`/v1/sales/${id}/ticket`, { recibo_escpos_b64: ticketB64 }),
    reopenCustomer: (id: string, data: { customer_id: string; autorizado_por_id: string; autorizado_por_nombre: string }) => client.patch<Sale>(`/v1/sales/${id}/customer`, data),
    reopenPayment: (id: string, data: { forma_pago: string; motivo: string; autorizado_por_id: string; autorizado_por_nombre: string; customer_id?: string }) => client.patch<Sale>(`/v1/sales/${id}/payment-method`, data),
    downloadReceipt: (id: string) => client.get<Blob>(`/v1/receipts/${id}`),
  },
  payments: {
    methods: () => client.get<PaymentMethod[]>(`/v1/companies/${COMPANY_ID}/payment-methods`),
    list: () => client.get<Payment[]>(`/v1/companies/${COMPANY_ID}/payments`),
    create: (data: Partial<Payment>) => client.post<Payment>("/v1/payments", data),
  },
  paymentMethods: {
    list: () => client.get<PaymentMethod[]>(`/v1/companies/${COMPANY_ID}/payment-methods`),
    create: (data: Partial<PaymentMethod>) => client.post<PaymentMethod>("/v1/payment-methods", data),
    update: (id: string, data: Partial<PaymentMethod>) => client.patch<PaymentMethod>(`/v1/payment-methods/${id}`, data),
  },
  warehouses: {
    list: () => client.get<Warehouse[]>(`/v1/companies/${COMPANY_ID}/warehouses`),
    create: (data: Partial<Warehouse>) => client.post<Warehouse>("/v1/warehouses", data),
  },
  stock: {
    lowStock: () => client.get<StockItem[]>(`/v1/companies/${COMPANY_ID}/low-stock`),
    listByWarehouse: (warehouseId: string) => client.get<StockItem[]>(`/v1/warehouses/${warehouseId}/stock`),
  },
  caja: {
    registers: {
      list: () => client.get<CashRegister[]>("/v1/cash-registers"),
      create: (data: Partial<CashRegister>) => client.post<CashRegister>("/v1/cash-registers", data),
      update: (id: string, data: { nombre?: string; codigo?: string; activo?: boolean; cash_drop_threshold?: number; diferencia_maxima_tolerada?: number }) => client.put<CashRegister>(`/v1/cash-registers/${id}`, data),
    },
    sessions: {
      list: (params?: { estado?: string; limit?: number; offset?: number }) => client.get<CashSession[]>("/v1/cash-sessions", { company_id: COMPANY_ID, ...params }),
      create: (data: { cash_register_id?: string; caja_id?: string; user_id?: string; cajero_nombre?: string; monto_apertura: number; monto_apertura_usd?: number; monto_apertura_brl?: number }) => client.post<CashSession>("/v1/cash-sessions", data),
      activeUser: () => client.get<{ id: string; register_id: string; register_nombre: string; register_codigo: string; user_id: string; cajero_nombre: string; monto_apertura: number; monto_apertura_usd: number; monto_apertura_brl: number; fecha_apertura: string; estado: string; total_ventas: number; total_cobrado: number } | null>("/v1/cash-sessions/active-user"),
      pause: (id: string, data?: { motivo?: string }) => client.post<{ success: boolean; id: string; estado: string }>(`/v1/cash-sessions/${id}/pause`, data || {}),
      resume: (id: string, data?: { cash_register_id?: string; punto_emision?: string }) => client.post<{ success: boolean; id: string; estado: string; register_id: string }>(`/v1/cash-sessions/${id}/resume`, data || {}),
      close: (id: string, data: { monto_cierre_real: number; monto_cierre_usd?: number; monto_cierre_brl?: number; observaciones?: string }) => client.post<{ session: CashSession; monto_cierre_esperado: number; diferencia: number; diferencia_usd: number; diferencia_brl: number; requiere_revision: boolean; total_cobrado: number; desglose_formas_pago: { forma_pago: string; moneda: string; monto: number }[] }>(`/v1/cash-sessions/${id}/close`, data),
      preCloseSummary: (sessionId: string) => client.get<{ session_id: string; cajero_nombre: string | null; fecha_apertura: string; monto_apertura: number; total_ventas_count: number; total_cobrado_pyg: number; total_donaciones_pyg: number; efectivo_pyg_esperado: number; efectivo_usd_esperado: number; efectivo_brl_esperado: number; monto_cierre_esperado_pyg: number; efectivo_en_gaveta_esperado_pyg: number; efectivo_en_gaveta_esperado_usd: number; efectivo_en_gaveta_esperado_brl: number; desglose_formas_pago: { forma_pago: string; moneda: string; cantidad: number; monto: number }[]; cash_drops: any[]; total_drops_confirmados_pyg: number; total_drops_confirmados_usd: number; total_drops_confirmados_brl: number }>(`/v1/cash-sessions/${sessionId}/pre-close-summary`),
    },
    sessionsSummary: (params?: { estado?: string; register_id?: string; limit?: number; offset?: number; fecha_desde?: string }) =>
      client.get<{ id: string; register_id: string; user_id: string; cajero_nombre: string | null; fecha_apertura: string; fecha_cierre: string | null; monto_apertura: number; monto_cierre: number | null; monto_cierre_esperado: number | null; diferencia: number | null; diferencia_usd: number | null; diferencia_brl: number | null; monto_cobrado: number; estado: string; cash_drop_alert: boolean; cash_drop_warning: boolean; cash_drop_threshold: number | null; efectivo_acumulado: number; efectivo_usd_acumulado: number; efectivo_brl_acumulado: number; ultimo_cash_drop_at: string | null }[]>(
        "/v1/cash-sessions-summary", { company_id: COMPANY_ID, ...params } as any
      ),
    paymentBreakdown: (sessionId: string) => client.get<{ pyg: { forma_pago: string; cantidad: number; monto: number; porcentaje: number }[]; otras_monedas: { forma_pago: string; moneda: string; cantidad: number; monto: number }[] }>(`/v1/cash-sessions/${sessionId}/payment-breakdown`),
    cashDrop: (sessionId: string, data: { monto: number; monto_usd?: number; monto_brl?: number; observaciones?: string }) => client.post<any>(`/v1/cash-sessions/${sessionId}/cash-drop`, data),
    cashDropRequests: {
      list: (estado?: string) => client.get<any[]>("/v1/cash-drop-requests", { company_id: COMPANY_ID, estado } as any),
      confirm: (id: string, data: { confirmado_por: string; confirmado_por_nombre: string; monto_confirmado_pyg?: number; monto_confirmado_usd?: number; monto_confirmado_brl?: number }) => client.post<any>(`/v1/cash-drop-requests/${id}/confirm`, data),
      reject: (id: string, motivo: string) => client.post<any>(`/v1/cash-drop-requests/${id}/reject`, { motivo }),
    },
    openSession: (data: { caja_id: string; monto_apertura: number }) => client.post<CashSession>("/v1/cash-sessions/open", data),
    closeSession: (id: string, data: { monto_cierre: number; observaciones?: string }) => client.post<CashSession>(`/v1/cash-sessions/${id}/close`, data),
    summary: (id: string) => client.get<CashSessionSummary>(`/v1/cash-sessions/${id}/summary`),
    registerMovements: (params?: { tipo?: string }) => client.get<{ id: string; register_id: string; tipo: string; monto: number; moneda: string; fecha: string; usuario: string; observaciones: string }[]>("/v1/cash-register-movements", { company_id: COMPANY_ID, ...params } as any),
    handoffs: {
      list: (params?: { estado?: string }) => client.get<CashHandoff[]>("/v1/cash-handoffs", params as any),
      confirm: (id: string, data: { recibido_por: string; recibido_por_nombre: string; monto_confirmado_pyg?: number; monto_confirmado_usd?: number; monto_confirmado_brl?: number }) => client.post<CashHandoff>(`/v1/cash-handoffs/${id}/confirm`, data),
    },
    cajeros: {
      performance: () => client.get<{ cajero_nombre: string; total_cierres: number; monto_total_manejado: number; diferencia_acumulada: number; diferencia_promedio: number; cierres_con_revision: number; pct_con_revision: number; ultimo_cierre: string | null }[]>("/v1/caja/cajeros/performance"),
    },
    treasuryRemittances: {
      pendingSobres: () => client.get<{ id: string; tipo_sobre: string; referencia_id: string; caja_codigo?: string; caja_nombre?: string; cajero_nombre?: string; monto_pyg: number; monto_usd: number; monto_brl: number; ticket_numero?: string; fecha: string }[]>("/v1/caja/supervisor/pending-sobres"),
      create: (data: { item_ids: string[]; observaciones?: string }) => client.post<any>("/v1/caja/treasury-remittances", data),
      list: (estado?: string) => client.get<any[]>("/v1/caja/treasury-remittances", estado ? { estado } : undefined),
      get: (id: string) => client.get<any>(`/v1/caja/treasury-remittances/${id}`),
      receive: (id: string, data?: { observaciones?: string }) => client.post<any>(`/v1/caja/treasury-remittances/${id}/receive`, data || {}),
    },
  },
  vault: {
    dashboard: () => client.get<VaultDashboard>("/v1/vault/dashboard"),
    entries: (params?: { estado?: string }) => client.get<VaultEntry[]>("/v1/vault/entries", params as any),
    deposit: (data: { entry_ids: string[]; bank_transaction_id?: string }) => client.post<{ deposited?: boolean; depositadas?: number; pending_approval?: boolean; request_id?: string; monto_total_pyg?: number }>("/v1/vault/deposit", data),
    depositToBank: (data: { entry_ids: string[]; bank_account_id: string; numero_boleta: string; transportadora?: string; fecha_deposito?: string; observaciones?: string }) => client.post<any>("/v1/vault/deposit-to-bank", data),
    depositApprovals: {
      list: (estado?: string) => client.get<{ id: string; entry_ids: string[]; monto_total_pyg: number; estado: string; aprobado_supervisor_id: string | null; aprobado_gerente_id: string | null; created_at: string }[]>("/v1/vault/deposit-approvals", estado ? { estado } : undefined),
      approve: (id: string) => client.post<{ success: boolean; completo: boolean }>(`/v1/vault/deposit-approvals/${id}/approve`, {}),
      reject: (id: string, motivo: string) => client.post<{ success: boolean }>(`/v1/vault/deposit-approvals/${id}/reject`, { motivo }),
    },
  },
  branches: {
    list: () => client.get<Branch[]>("/v1/branches"),
    get: (id: string) => client.get<Branch>(`/v1/branches/${id}`),
    create: (data: Partial<Branch>) => client.post<Branch>("/v1/branches", data),
    update: (id: string, data: Partial<Branch>) => client.patch<Branch>(`/v1/branches/${id}`, data),
    delete: (id: string) => client.delete<void>(`/v1/branches/${id}`),
    prices: {
      list: (branchId?: string) => branchId
        ? client.get<BranchPrice[]>(`/v1/branches/${branchId}/prices`)
        : client.get<BranchPrice[]>("/v1/branches/prices"),
      upsert: (data: { branch_id: string; product_id: string; precio: number }) => client.post<BranchPrice>("/v1/branches/prices", data),
      delete: (id: string) => client.delete<void>(`/v1/branches/prices/${id}`),
    },
    transfers: {
      list: (params?: { estado?: string }) => client.get<BranchTransfer[]>("/v1/branches/transfers", params),
      get: (id: string) => client.get<BranchTransfer>(`/v1/branches/transfers/${id}`),
      create: (data: { origen_branch_id: string; destino_branch_id: string; notas?: string; transportista?: string; items: { product_id: string; cantidad: number; costo_unitario?: number }[] }) => client.post<BranchTransfer>("/v1/branches/transfers", data),
      send: (id: string) => client.post<BranchTransfer>(`/v1/branches/transfers/${id}/send`),
      receive: (id: string, data: { items: { item_id: string; cantidad_recibida: number }[] }) => client.post<BranchTransfer>(`/v1/branches/transfers/${id}/receive`, data),
    },
    dashboard: () => client.get<ConsolidatedDashboard>("/v1/branches/dashboard"),
  },
  creditAccounts: {
    list: (params?: { activo?: boolean }) => client.get<CreditAccount[]>("/v1/credit-accounts", params),
    get: (id: string) => client.get<CreditAccount>(`/v1/credit-accounts/${id}`),
    create: (data: Partial<CreditAccount>) => client.post<CreditAccount>("/v1/credit-accounts", data),
    getByCustomer: (customerId: string) => client.get<CreditAccount>(`/v1/credit-accounts/customer/${customerId}`),
    movements: (id: string) => client.get<CreditMovement[]>(`/v1/credit-accounts/${id}/movements`),
    payment: (id: string, data: { monto: number; metodo_pago_id?: string; observaciones?: string }) => client.post<CreditAccount>(`/v1/credit-accounts/${id}/payment`, data),
    getMoraConfig: () => client.get<MoraConfig>("/v1/credit-accounts/mora/config"),
    updateMoraConfig: (data: MoraConfig) => client.patch<MoraConfig>("/v1/credit-accounts/mora/config", data),
    previewMora: () => client.get<MoraPreviewResponse>("/v1/credit-accounts/mora/preview"),
    applyMora: () => client.post<{ aplicados: number; total: number }>("/v1/credit-accounts/mora/aplicar"),
    getDunningConfig: () => client.get<DunningConfig>("/v1/credit-accounts/dunning/config"),
    updateDunningConfig: (data: DunningConfig) => client.patch<DunningConfig>("/v1/credit-accounts/dunning/config", data),
    previewDunning: () => client.get<DunningPreviewResponse>("/v1/credit-accounts/dunning/preview"),
    runDunning: () => client.post<{ enviados: number; omitidos: number }>("/v1/credit-accounts/dunning/run"),
  },
  customerAdvances: {
    list: (params?: { customer_id?: string }) => client.get<CustomerAdvance[]>("/v1/customer-advances", params),
    create: (data: { customer_id: string; monto: number; forma_pago?: string; referencia?: string; observaciones?: string }) => client.post<CustomerAdvance>("/v1/customer-advances", data),
    getBalance: (customerId: string) => client.get<{ customer_id: string; monto_disponible: number }>(`/v1/customer-advances/customer/${customerId}/balance`),
    apply: (advanceId: string, data: { accounts_receivable_id: string; monto: number }) => client.post<{ success: boolean; monto_disponible_restante: number; saldo_pendiente_documento: number; estado_documento: string }>(`/v1/customer-advances/${advanceId}/apply`, data),
  },
  creditApprovalRequests: {
    list: (params?: { estado?: string }) => client.get<any[]>("/v1/credit-approval-requests", params),
    approve: (id: string) => client.post<{ success: boolean; completo: boolean }>(`/v1/credit-approval-requests/${id}/approve`),
    reject: (id: string, motivo: string) => client.post<{ success: boolean }>(`/v1/credit-approval-requests/${id}/reject`, { motivo }),
  },
  writeoffRequests: {
    list: (params?: { estado?: string }) => client.get<WriteoffRequest[]>("/v1/receivable-writeoff-requests", params),
    create: (data: { accounts_receivable_id: string; motivo: string }) => client.post<{ success: boolean }>("/v1/receivable-writeoff-requests", data),
    approve: (id: string) => client.post<{ success: boolean; completo: boolean }>(`/v1/receivable-writeoff-requests/${id}/approve`),
    reject: (id: string, motivo: string) => client.post<{ success: boolean }>(`/v1/receivable-writeoff-requests/${id}/reject`, { motivo }),
  },
  logistics: {
    deliveries: {
      list: () => client.get<Delivery[]>("/v1/logistics/deliveries"),
      create: (data: Partial<Delivery>) => client.post<Delivery>("/v1/logistics/deliveries", data),
    },
    routes: {
      list: () => client.get<Route[]>("/v1/logistics/routes"),
      create: (data: Partial<Route>) => client.post<Route>("/v1/logistics/routes", data),
    },
  },
  notifications: {
    listTemplates: () => client.get<NotificationTemplate[]>("/v1/notifications/templates"),
    createTemplate: (data: Partial<NotificationTemplate>) => client.post<NotificationTemplate>("/v1/notifications/templates", data),
    updateTemplate: (id: string, data: Partial<NotificationTemplate>) => client.put<NotificationTemplate>(`/v1/notifications/templates/${id}`, data),
    deleteTemplate: (id: string) => client.delete<void>(`/v1/notifications/templates/${id}`),
    getPreferences: () => client.get<UserNotificationPreference[]>("/v1/notifications/preferences"),
    savePreference: (data: Partial<UserNotificationPreference>) => client.put<UserNotificationPreference>("/v1/notifications/preferences", data),
    listNotifications: (params?: { unread_only?: boolean; limit?: number; offset?: number }) => client.get<{ notifications: Notification[]; total: number; unread_count: number }>("/v1/notifications/notifications", { unread_only: params?.unread_only?.toString(), limit: params?.limit?.toString(), offset: params?.offset?.toString() }),
    getUnreadCount: () => client.get<{ count: number }>("/v1/notifications/notifications/unread-count"),
    markAsRead: (ids: string[]) => client.post<void>("/v1/notifications/notifications/mark-read", { notification_ids: ids }),
    markAllAsRead: () => client.post<void>("/v1/notifications/notifications/mark-all-read"),
    deleteNotification: (id: string) => client.delete<void>(`/v1/notifications/notifications/${id}`),
  },
  whatsapp: {
    getConfig: () => client.get<WhatsAppConfig>("/v1/whatsapp/config"),
    saveConfig: (data: Partial<WhatsAppConfig>) => client.put<WhatsAppConfig>("/v1/whatsapp/config", data),
    testMessage: (data: { to: string; message: string }) => client.post<{ message: string }>("/v1/whatsapp/config/test", data),
    listConversations: () => client.get<WhatsAppConversation[]>("/v1/whatsapp/conversations"),
    getConversation: (id: string) => client.get<WhatsAppConversation>(`/v1/whatsapp/conversations/${id}`),
    getMessages: (convId: string) => client.get<WhatsAppMessage[]>(`/v1/whatsapp/conversations/${convId}/messages`),
    sendMessage: (convId: string, data: { content: string; media_url?: string }) => client.post<WhatsAppMessage>(`/v1/whatsapp/conversations/${convId}/messages`, data),
    archiveConversation: (id: string) => client.put<void>(`/v1/whatsapp/conversations/${id}/archive`),
    listTemplates: () => client.get<WhatsAppTemplate[]>("/v1/whatsapp/templates"),
    createTemplate: (data: Partial<WhatsAppTemplate>) => client.post<WhatsAppTemplate>("/v1/whatsapp/templates", data),
    updateTemplate: (id: string, data: Partial<WhatsAppTemplate>) => client.put<WhatsAppTemplate>(`/v1/whatsapp/templates/${id}`, data),
    deleteTemplate: (id: string) => client.delete<void>(`/v1/whatsapp/templates/${id}`),
    getStats: () => client.get<WhatsAppStats>("/v1/whatsapp/stats"),
  },
  crm: {
    listLeads: () => client.get<Lead[]>("/v1/crm/leads"),
    getLead: (id: string) => client.get<Lead>(`/v1/crm/leads/${id}`),
    createLead: (data: Partial<Lead>) => client.post<Lead>("/v1/crm/leads", data),
    updateLead: (id: string, data: Partial<Lead>) => client.patch<Lead>(`/v1/crm/leads/${id}`, data),
    deleteLead: (id: string) => client.delete<void>(`/v1/crm/leads/${id}`),
    listOportunidades: () => client.get<Oportunidad[]>("/v1/crm/oportunidades"),
    getOportunidad: (id: string) => client.get<Oportunidad>(`/v1/crm/oportunidades/${id}`),
    createOportunidad: (data: Partial<Oportunidad>) => client.post<Oportunidad>("/v1/crm/oportunidades", data),
    updateOportunidad: (id: string, data: Partial<Oportunidad>) => client.patch<Oportunidad>(`/v1/crm/oportunidades/${id}`, data),
    deleteOportunidad: (id: string) => client.delete<void>(`/v1/crm/oportunidades/${id}`),
    moveOportunidadEtapa: (id: string, etapa: string) => client.patch<Oportunidad>(`/v1/crm/oportunidades/${id}/etapa`, { etapa }),
    listActividades: () => client.get<Actividad[]>("/v1/crm/actividades"),
    getActividad: (id: string) => client.get<Actividad>(`/v1/crm/actividades/${id}`),
    createActividad: (data: Partial<Actividad>) => client.post<Actividad>("/v1/crm/actividades", data),
    updateActividad: (id: string, data: Partial<Actividad>) => client.patch<Actividad>(`/v1/crm/actividades/${id}`, data),
    completeActividad: (id: string) => client.post<Actividad>(`/v1/crm/actividades/${id}/complete`),
    deleteActividad: (id: string) => client.delete<void>(`/v1/crm/actividades/${id}`),
    getLeadStats: () => client.get<LeadStats>("/v1/crm/stats/leads"),
    getPipelineStats: () => client.get<PipelineStats>("/v1/crm/stats/pipeline"),
    getActivityStats: () => client.get<ActivityStats>("/v1/crm/stats/activities"),
    stats: () => client.get<{ leads: number; oportunidades: number; actividades: number; conversion_rate: number }>("/v1/crm/stats"),
  },
  rbac: {
    permissions: () => client.get<Permission[]>("/v1/rbac/permissions"),
    listPermissions: () => client.get<Permission[]>("/v1/rbac/permissions"),
    createPermission: (data: Partial<Permission>) => client.post<Permission>("/v1/rbac/permissions", data),
    roles: () => client.get<Role[]>("/v1/rbac/roles"),
    listRoles: () => client.get<Role[]>("/v1/rbac/roles"),
    createRole: (data: Partial<Role> & { name: string }) => client.post<Role>("/v1/rbac/roles", data),
    updateRole: (id: string, data: Partial<Role>) => client.put<Role>(`/v1/rbac/roles/${id}`, data),
    deleteRole: (id: string) => client.delete<void>(`/v1/rbac/roles/${id}`),
    assignRole: (userId: string, roleId: string) => client.post<void>(`/v1/rbac/users/${userId}/roles`, { role_id: roleId }),
    removeRole: (userId: string, roleId: string) => client.delete<void>(`/v1/rbac/users/${userId}/roles/${roleId}`),
    userRoles: (userId: string) => client.get<Role[]>(`/v1/rbac/users/${userId}/roles`),
    setRolePermissions: (roleId: string, permissionIds: string[]) => client.post<void>(`/v1/rbac/roles/${roleId}/permissions`, { permission_ids: permissionIds }),
    updateRolePermissions: (roleId: string, permissionIds: string[]) => client.post<void>(`/v1/rbac/roles/${roleId}/permissions`, { permission_ids: permissionIds }),
    seedRoles: () => client.post<void>("/v1/rbac/seed"),
    seed: () => client.post<void>("/v1/rbac/seed"),
  },
  purchases: {
    lostDemand: {
      list: (params?: { estado?: string; company_id?: string }) =>
        client.get<CustomerLostDemand[]>("/v1/purchases/lost-demand", { company_id: COMPANY_ID, ...params } as any),
      create: (data: { producto_nombre: string; categoria?: string; marca?: string; notas?: string; cliente_nombre?: string; cliente_contacto?: string; customer_id?: string; urgencia?: string; cajero_id?: string; cajero_nombre?: string; caja_id?: string }) =>
        client.post<CustomerLostDemand>("/v1/purchases/lost-demand", { company_id: COMPANY_ID, ...data }),
      update: (id: string, data: { estado?: string; notas?: string; orden_compra_id?: string }) =>
        client.patch<CustomerLostDemand>("/v1/purchases/lost-demand/" + id, data),
    },

    orders: () => client.get<PurchaseOrder[]>(`/v1/companies/${COMPANY_ID}/purchase-orders`),
    listPOs: () => client.get<PurchaseOrder[]>(`/v1/companies/${COMPANY_ID}/purchase-orders`),
    getOrder: (id: string) => client.get<PurchaseOrder>(`/v1/purchase-orders/${id}`),
    getOrderItems: (id: string) => client.get<PurchaseOrderItem[]>(`/v1/purchase-orders/${id}/items`),
    createOrder: (data: Partial<PurchaseOrder>) => client.post<PurchaseOrder>("/v1/purchase-orders", { ...data, company_id: COMPANY_ID }),
    createPO: (data: Partial<PurchaseOrder>) => client.post<PurchaseOrder>("/v1/purchase-orders", { ...data, company_id: COMPANY_ID }),
    updateOrder: (id: string, data: Partial<PurchaseOrder>) => client.put<PurchaseOrder>(`/v1/purchase-orders/${id}`, data),
    confirmOrder: (id: string) => client.post<PurchaseOrder>(`/v1/purchase-orders/${id}/confirm`),
    confirmPO: (id: string) => client.post<PurchaseOrder>(`/v1/purchase-orders/${id}/confirm`),
    sendPO: (id: string) => client.post<PurchaseOrder>(`/v1/purchase-orders/${id}/send`),
    cancelPO: (id: string) => client.post<PurchaseOrder>(`/v1/purchase-orders/${id}/cancel`),
    receipts: () => client.get<PurchaseReceipt[]>(`/v1/companies/${COMPANY_ID}/purchase-receipts`),
    listReceipts: () => client.get<PurchaseReceipt[]>(`/v1/companies/${COMPANY_ID}/purchase-receipts`),
    getReceipt: (id: string) => client.get<PurchaseReceipt>(`/v1/purchase-receipts/${id}`),
    cancelReceipt: (id: string) => client.post<PurchaseReceipt>(`/v1/purchase-receipts/${id}/cancel`),
    createReceipt: (data: Partial<PurchaseReceipt>) => client.post<PurchaseReceipt>("/v1/purchase-receipts", { ...data, company_id: COMPANY_ID }),
    suppliers: (search?: string, solo_mercaderia?: boolean) => client.get<Supplier[]>(`/v1/companies/${COMPANY_ID}/suppliers`, { search, solo_mercaderia }),
    listSuppliers: (params?: { search?: string; solo_mercaderia?: boolean }) => client.get<Supplier[]>(`/v1/companies/${COMPANY_ID}/suppliers`, params),
    getSupplier: (id: string) => client.get<Supplier>(`/v1/suppliers/${id}`),
    createSupplier: (data: Partial<Supplier>) => client.post<Supplier>("/v1/suppliers", { ...data, company_id: COMPANY_ID }),
    updateSupplier: (id: string, data: Partial<Supplier>) => client.patch<Supplier>(`/v1/suppliers/${id}`, data),
    deleteSupplier: (id: string) => client.delete<void>(`/v1/suppliers/${id}`),
    evaluateSupplier: (id: string, data: { company_id: string; puntaje_calidad?: number; puntaje_entrega?: number; puntaje_precio?: number; puntaje_atencion?: number; comentarios?: string }) =>
      client.post<any>(`/v1/suppliers/${id}/evaluate`, data),
    getSupplierEvaluations: (id: string) => client.get<any[]>(`/v1/suppliers/${id}/evaluations`),
    getSupplierPerformance: (id: string) => client.get<{ supplier_id: string; razon_social: string; total_orders: number; total_spent: number; on_time_rate: number | null; avg_quality_score: number | null; avg_delivery_score: number | null; avg_price_score: number | null; avg_attention_score: number | null; overall_rating: number | null; last_evaluation_date: string | null }>(`/v1/suppliers/${id}/performance`),
    getSupplierPriceHistory: (id: string) => client.get<{ product_id: string; product_nombre: string; sku: string; purchase_order_id: string; fecha_orden: string; precio_unitario: number; cantidad: number }[]>(`/v1/suppliers/${id}/price-history`),
    requisitions: {
      list: (estado?: string) => client.get<PurchaseRequisition[]>(`/v1/companies/${COMPANY_ID}/purchase-requisitions`, estado ? { estado } : undefined),
      get: (id: string) => client.get<PurchaseRequisition & { items: PurchaseRequisitionItem[] }>(`/v1/purchase-requisitions/${id}`),
      create: (data: { fecha_necesidad?: string; departamento?: string; solicitante_id?: string; solicitante_nombre?: string; prioridad?: string; moneda?: string; items: { product_id: string; variant_id?: string; descripcion?: string; cantidad_solicitada: number; precio_estimado?: number; observaciones?: string }[]; motivo?: string; observaciones?: string; user_id?: string }) =>
        client.post<PurchaseRequisition>("/v1/purchase-requisitions", { ...data, company_id: COMPANY_ID }),
      approve: (id: string, aprobadoPor?: string) => client.post<PurchaseRequisition>(`/v1/purchase-requisitions/${id}/approve${aprobadoPor ? `?aprobado_por=${aprobadoPor}` : ""}`),
      reject: (id: string, motivo?: string) => client.post<PurchaseRequisition>(`/v1/purchase-requisitions/${id}/reject${motivo ? `?motivo=${encodeURIComponent(motivo)}` : ""}`),
      convertToPO: (id: string, supplierId: string, userId?: string, userName?: string) => {
        const params = new URLSearchParams({ supplier_id: supplierId })
        if (userId) params.set("user_id", userId)
        if (userName) params.set("user_name", userName)
        return client.post<PurchaseOrder>(`/v1/purchase-requisitions/${id}/convert?${params.toString()}`)
      },
    },
    rfqs: {
      list: (estado?: string) => client.get<PurchaseRfq[]>(`/v1/companies/${COMPANY_ID}/purchase-rfqs`, estado ? { estado } : undefined),
      get: (id: string) => client.get<PurchaseRfqWithDetail>(`/v1/purchase-rfqs/${id}`),
      create: (data: { requisition_id?: string; fecha_limite?: string; motivo?: string; observaciones?: string; items?: { product_id: string; variant_id?: string; descripcion?: string; cantidad_solicitada: number }[]; supplier_ids: string[]; user_id?: string }) =>
        client.post<PurchaseRfqWithDetail>("/v1/purchase-rfqs", { ...data, company_id: COMPANY_ID }),
      submitResponse: (rfqId: string, supplierId: string, data: { plazo_entrega_dias?: number; observaciones?: string; items: { product_id: string; precio_unitario: number; plazo_entrega_dias?: number }[] }) =>
        client.post<PurchaseRfqWithDetail>(`/v1/purchase-rfqs/${rfqId}/responses/${supplierId}`, data),
      award: (rfqId: string, supplierId: string, userId?: string, userName?: string) =>
        client.post<PurchaseOrder>(`/v1/purchase-rfqs/${rfqId}/award`, { supplier_id: supplierId, user_id: userId, user_name: userName }),
    },
    budgets: {
      list: (anio?: number) => client.get<PurchaseBudget[]>(`/v1/companies/${COMPANY_ID}/purchase-budgets`, anio ? { anio } : undefined),
      get: (id: string) => client.get<PurchaseBudget>(`/v1/purchase-budgets/${id}`),
      create: (data: { nombre: string; anio: number; mes?: number; tipo?: string; moneda?: string; monto_presupuestado: number; categoria_id?: string; departamento?: string; observaciones?: string; user_id?: string }) =>
        client.post<PurchaseBudget>("/v1/purchase-budgets", { ...data, company_id: COMPANY_ID }),
      update: (id: string, data: { nombre?: string; monto_presupuestado?: number; activo?: boolean; observaciones?: string }) =>
        client.put<PurchaseBudget>(`/v1/purchase-budgets/${id}`, data),
      delete: (id: string) => client.delete<void>(`/v1/purchase-budgets/${id}`),
      consumption: (anio?: number) => client.get<PurchaseBudgetConsumption[]>(`/v1/companies/${COMPANY_ID}/purchase-budgets/consumption`, anio ? { anio } : undefined),
    },
    reports: {
      kpis: () => client.get<{ total_pos: number; total_gastado: number; total_iva: number; prom_pedido: number; proveedores_activos: number; ordenes_pendientes: number; ordenes_atrasadas: number; ahorro_estimado: number; cumplimiento_rate: number | null }>(`/v1/companies/${COMPANY_ID}/purchase-reports/kpis`),
      spendBySupplier: () => client.get<{ supplier_id: string; razon_social: string; cantidad_ordenes: number; total_gastado: number; moneda: string }[]>(`/v1/companies/${COMPANY_ID}/purchase-reports/spend-by-supplier`),
      spendByCategory: () => client.get<{ category_id: string | null; categoria_nombre: string; cantidad_productos: number; total_gastado: number }[]>(`/v1/companies/${COMPANY_ID}/purchase-reports/spend-by-category`),
      priceVariance: () => client.get<{ product_id: string; nombre: string; average_price: number; min_price: number; max_price: number; variance_pct: number; last_purchase_date: string | null; last_supplier: string | null }[]>(`/v1/companies/${COMPANY_ID}/purchase-reports/price-variance`),
      downloadSpendBySupplierPdf: () => downloadAuthenticated(`/v1/companies/${COMPANY_ID}/purchase-reports/export/spend-by-supplier.pdf`, undefined, "gasto_por_proveedor.pdf"),
      downloadPriceVariancePdf: () => downloadAuthenticated(`/v1/companies/${COMPANY_ID}/purchase-reports/export/price-variance.pdf`, undefined, "varianza_de_precios.pdf"),
    },
    smartReplenishmentPreview: (data: SmartReplenishmentRequest) =>
      client.post<SmartReplenishmentResponse>("/v1/purchases/smart-replenishment-preview", { ...data, company_id: COMPANY_ID }),
    generatePOFromReplenishment: (data: {
      supplier_id: string
      fecha_entrega_estimada?: string
      moneda?: string
      prioridad?: string
      condiciones_pago?: string
      observaciones?: string
      user_id?: string
      user_name?: string
      items: {
        product_id: string
        variant_id?: string
        descripcion?: string
        cantidad: number
        precio_unitario: number
        descuento_pct?: number
        iva_tasa?: number
      }[]
    }) => client.post<PurchaseOrder>("/v1/purchases/generate-po-from-replenishment", { ...data, company_id: COMPANY_ID }),
  },
  sifen: {
    timbrados: {
      list: () => client.get<SifenTimbrado[]>("/api/v1/sifen/timbrados"),
      get: (id: string) => client.get<SifenTimbrado>(`/api/v1/sifen/timbrados/${id}`),
      create: (data: Partial<SifenTimbrado>) => client.post<SifenTimbrado>("/api/v1/sifen/timbrados", data),
    },
    getTimbrado: (id: string) => client.get<SifenTimbrado>(`/api/v1/sifen/timbrados/${id}`),
    createTimbrado: (data: Partial<SifenTimbrado>) => client.post<SifenTimbrado>("/api/v1/sifen/timbrados", data),
    responses: {
      list: (params?: { estado?: string; company_id?: string; limit?: number }) =>
        client.get<SifenResponse[]>("/api/v1/sifen/responses", params as any),
      get: (id: string) => client.get<SifenResponse>(`/api/v1/sifen/responses/${id}`),
    },
    getResponse: (id: string) => client.get<SifenResponse>(`/api/v1/sifen/responses/${id}`),
    send: (saleId: string) => client.post<any>("/api/v1/sifen/send", { sale_id: saleId }),
    retry: (saleId: string) => client.post<any>(`/api/v1/sifen/retry/${saleId}`),
    check: (cdc: string) => client.get<any>(`/api/v1/sifen/cdc/${cdc}`),
    qr: (cdc: string) => client.get<{ png?: string; base64: string; qr_data_url?: string }>(`/api/v1/sifen/qr/${cdc}`),
  },
  sifenAvanzado: {
    getDashboard: (companyId: string) => client.get<any>("/v1/sifen-avanzado/dashboard", { company_id: companyId }),
    sendDistribuidoraInvoice: (data: any) => client.post<any>("/v1/sifen-avanzado/invoices/distribuidora", data),
    getIvaBook: (tipo: string, companyId: string, periodo: string) => client.get<any>(`/v1/sifen-avanzado/iva-books/${tipo}`, { company_id: companyId, periodo }),
    getRetentionBook: (companyId: string, periodo: string) => client.get<any>("/v1/sifen-avanzado/retention-books", { company_id: companyId, periodo }),
    listDgrVehicles: (companyId: string) => client.get<any[]>("/v1/sifen-avanzado/dgr/vehicles", { company_id: companyId }),
    createDgrVehicle: (data: any) => client.post<any>("/v1/sifen-avanzado/dgr/vehicles", data),
    listDgrReports: (companyId: string) => client.get<any[]>("/v1/sifen-avanzado/dgr/reports", { company_id: companyId }),
    generateDgrReport: (companyId: string, periodo: string) => client.post<any>("/v1/sifen-avanzado/dgr/reports", { company_id: companyId, periodo }),
    listEkuatiaDocuments: (companyId: string) => client.get<any[]>("/v1/sifen-avanzado/ekuatia/documents", { company_id: companyId }),
    verifyEkuatiaDocument: (docId: string) => client.post<any>(`/v1/sifen-avanzado/ekuatia/documents/${docId}/verify`),
    validateCdc: (companyId: string, saleId: string, cdc: string) => client.post<any>("/v1/sifen-avanzado/cdc/validate", { company_id: companyId, sale_id: saleId, cdc }),
  },
  reports: {
    salesSummary: (params?: { fecha_desde?: string; fecha_hasta?: string }) => client.get<any>("/api/reports/sales/summary", params),
    salesByPeriod: (params?: { fecha_desde?: string; fecha_hasta?: string; agrupar_por?: string }) => client.get<any>("/api/reports/sales/by-period", params),
    salesChartComparison: (params?: { fecha_desde?: string; fecha_hasta?: string; agrupar_por?: string }) => client.get<{ series: any[]; totales: any }>("/api/reports/sales/chart-comparison", params),
    salesByCategory: (params?: { fecha_desde?: string; fecha_hasta?: string }) => client.get<any>("/api/reports/sales/by-category", params),
    salesByProduct: (params?: { fecha_desde?: string; fecha_hasta?: string; limit?: number }) => client.get<{ producto: string; sku: string; unidad_medida: string; cantidad: number; monto: number; costo: number; margen: number }[]>("/api/reports/sales/by-product", params),
    salesByPaymentMethod: (params?: { fecha_desde?: string; fecha_hasta?: string }) => client.get<{ forma_pago: string; cantidad: number; monto: number; porcentaje: number }[]>("/api/reports/sales/by-payment-method", params),
    expensesByCategory: (params?: { fecha_desde?: string; fecha_hasta?: string }) => client.get<{ categoria: string; cantidad: number; monto: number; porcentaje: number }[]>("/api/reports/expenses/by-category", params),
    getDashboardAllKPIs: async (params?: { fecha_desde?: string; fecha_hasta?: string }) => {
      const [summary, byCat, byProd, period] = await Promise.allSettled([
        api.reports.salesSummary(params),
        api.reports.salesByCategory(params),
        api.reports.salesByProduct(params),
        api.reports.salesByPeriod(params),
      ])
      return {
        summary: summary.status === "fulfilled" ? summary.value : null,
        byCat: byCat.status === "fulfilled" ? byCat.value : [],
        byProd: byProd.status === "fulfilled" ? byProd.value : [],
        period: period.status === "fulfilled" ? period.value : [],
      }
    },
    inventory: () => client.get<any>("/api/reports/inventory/summary"),
    inventorySummary: () => client.get<any>("/api/reports/inventory/summary"),
    inventoryDetail: () => client.get<any[]>("/api/reports/inventory/detail"),
    inventoryRotation: () => client.get<any[]>("/api/reports/inventory/rotation"),
    fifo: () => client.get<FifoReport[]>("/api/reports/inventory/fifo"),
    lifo: () => client.get<LifoReport[]>("/api/reports/inventory/lifo"),
    fifoCosting: () => client.get<FifoReport[]>("/api/reports/inventory/fifo"),
    lifoCosting: () => client.get<LifoReport[]>("/api/reports/inventory/lifo"),
    costComparison: () => client.get<CostComparisonReport[]>("/api/reports/inventory/cost-comparison"),
    fiscalBook: (params?: { tipo_libro?: string; fecha_desde?: string; fecha_hasta?: string }) => client.get<any>("/api/reports/fiscal/book", params),
    financialSummary: (params?: { fecha_desde?: string; fecha_hasta?: string }) => client.get<any>("/api/reports/financial/summary", params),
    exportSalesByPeriod: (params?: { fecha_desde?: string; fecha_hasta?: string; agrupar_por?: string }) => client.get<Blob>("/api/reports/export/sales-by-period", params),
    exportInventory: () => client.get<Blob>("/api/reports/export/inventory"),
    exportFifo: () => client.get<Blob>("/api/reports/export/fifo"),
    exportLifo: () => client.get<Blob>("/api/reports/export/lifo"),
    exportCostComparison: () => client.get<Blob>("/api/reports/export/cost-comparison"),
    exportFiscalBook: (params?: { tipo_libro?: string; fecha_desde?: string; fecha_hasta?: string }) => client.get<Blob>("/api/reports/export/fiscal-book", params),
    exportFinancialSummary: (params?: { fecha_desde?: string; fecha_hasta?: string }) => client.get<Blob>("/api/reports/export/financial", params),
  },
  pagopar: {
    checkout: (data: { sale_id?: string; monto?: number; amount?: number; descripcion?: string; order_id?: string; customer_email?: string; customer_name?: string; customer_phone?: string; customer_ci?: string }) => client.post<any>("/v1/pagopar/checkout", data),
    webhook: (data: unknown) => client.post<any>("/v1/pagopar/webhook", data),
    transactions: () => client.get<any[]>("/v1/pagopar/transactions"),
    getTransaction: (id: string) => client.get<any>(`/v1/pagopar/transactions/${id}`),
  },
  kuapay: {
    checkout: (data: { sale_id?: string; monto?: number; amount?: number; description?: string; order_id?: string; customer_email?: string; customer_name?: string; customer_phone?: string; customer_ci?: string; payment_method?: string }) => client.post<any>("/v1/kuapay/checkout", data),
    webhook: (data: unknown) => client.post<any>("/v1/kuapay/webhook", data),
    transactions: () => client.get<any[]>("/v1/kuapay/transactions"),
    getTransaction: (id: string) => client.get<any>(`/v1/kuapay/transactions/${id}`),
  },
  settings: {
    companies: () => client.get<Company[]>("/v1/companies"),
  currencies: {
    list: () => client.get<Currency[]>("/v1/currency"),
    create: (data: Partial<Currency>) => client.post<Currency>("/v1/currency", data),
  },
    paymentMethods: {
      list: () => client.get<PaymentMethod[]>("/v1/payments/methods"),
      create: (data: Partial<PaymentMethod>) => client.post<PaymentMethod>("/v1/payments/methods", data),
      update: (id: string, data: Partial<PaymentMethod>) => client.patch<PaymentMethod>(`/v1/payments/methods/${id}`, data),
    },
  exchangeRates: {
    list: () => client.get<ExchangeRate[]>("/v1/currency/rates"),
    sync: () => client.post<any>("/v1/currency/sync"),
  },
    syncExchangeRates: () => client.post<any>("/v1/currency/sync"),
    verticals: () => client.get<Vertical[]>("/v1/admin/verticals"),
  },
  commissions: {
    rules: {
      list: (activo?: boolean) => client.get<CommissionRule[]>(`/v1/companies/${COMPANY_ID}/commission-rules${activo !== undefined ? `?activo=${activo}` : ""}`),
      get: (id: string) => client.get<CommissionRule>(`/v1/commission-rules/${id}`),
      create: (data: Partial<CommissionRule>) => client.post<CommissionRule>("/v1/commission-rules", { ...data, company_id: COMPANY_ID }),
      update: (id: string, data: Partial<CommissionRule>) => client.put<CommissionRule>(`/v1/commission-rules/${id}`, data),
      delete: (id: string) => client.delete<void>(`/v1/commission-rules/${id}`),
    },
    list: (params?: { vendedor_id?: string; estado?: string }) => client.get<SalesCommission[]>(`/v1/companies/${COMPANY_ID}/commissions`, params),
    pay: (id: string) => client.post<SalesCommission>(`/v1/commissions/${id}/pay`),
    summary: () => client.get<any>(`/v1/companies/${COMPANY_ID}/commissions/summary`),
    calculateBatch: () => client.post<any>(`/v1/companies/${COMPANY_ID}/commissions/calculate-batch`),
  },
  discounts: {
    list: () => client.get<Discount[]>("/v1/discounts"),
    get: (id: string) => client.get<Discount>(`/v1/discounts/${id}`),
    create: (data: Partial<Discount>) => client.post<Discount>("/v1/discounts", data),
    update: (id: string, data: Partial<Discount>) => client.patch<Discount>(`/v1/discounts/${id}`, data),
    delete: (id: string) => client.delete<void>(`/v1/discounts/${id}`),
  },
  quotes: {
    list: (params?: { estado?: string }) => client.get<Quote[]>(`/v1/companies/${COMPANY_ID}/quotes`, params as any),
    get: (id: string) => client.get<Quote>(`/v1/quotes/${id}`),
    create: (data: Partial<Quote>) => client.post<Quote>("/v1/quotes", data),
    update: (id: string, data: Partial<Quote>) => client.put<Quote>(`/v1/quotes/${id}`, data),
    convertToSale: (id: string, data?: { branch_id?: string; condicion?: string; tipo_comprobante?: string }) => client.post<{ sale: Sale; quote: Quote }>(`/v1/quotes/${id}/convert`, data),
    changeStatus: (id: string, estado: string) => client.post<Quote>(`/v1/quotes/${id}/status?estado=${encodeURIComponent(estado)}`),
    expire: () => client.post<{expiradas: number}>("/v1/quotes/expire"),
  },
  returns: {
    list: (params?: { estado?: string }) => client.get<Return[]>(`/v1/companies/${COMPANY_ID}/returns`, params as any),
    get: (id: string) => client.get<Return>(`/v1/returns/${id}`),
    create: (data: Partial<Return>) => client.post<Return>("/v1/returns", data),
    update: (id: string, data: Partial<Return>) => client.patch<Return>(`/v1/returns/${id}`, data),
    delete: (id: string) => client.delete<void>(`/v1/returns/${id}`),
    motivos: () => client.get<string[]>("/v1/returns/motivos"),
    getItems: (id: string) => client.get<ReturnItem[]>(`/v1/returns/${id}/items`),
    approve: (id: string, aprobado_por?: string) => client.post<Return>(`/v1/returns/${id}/approve`, { aprobado_por }),
    reject: (id: string, motivo?: string) => client.post<Return>(`/v1/returns/${id}/reject`, { motivo }),
  },
  salesOrders: {
    list: (params?: { estado?: string }) => client.get<SalesOrder[]>(`/v1/companies/${COMPANY_ID}/sales-orders`, params as any),
    get: (id: string) => client.get<SalesOrder>(`/v1/sales-orders/${id}`),
    create: (data: Partial<SalesOrder>) => client.post<SalesOrder>("/v1/sales-orders", data),
    update: (id: string, data: Partial<SalesOrder>) => client.put<SalesOrder>(`/v1/sales-orders/${id}`, data),
    changeStatus: (id: string, estado: string, motivo?: string) => client.post<SalesOrder>(`/v1/sales-orders/${id}/status?estado=${encodeURIComponent(estado)}${motivo ? `&motivo=${encodeURIComponent(motivo)}` : ""}`),
    approve: (id: string, aprobado_por: string) => client.post<SalesOrder>(`/v1/sales-orders/${id}/approve?aprobado_por=${encodeURIComponent(aprobado_por)}`),
  },
  verticals: {
    list: () => client.get<Vertical[]>("/v1/admin/verticals"),
    getCompanyConfig: () => client.get<CompanyVerticalConfig>("/v1/companies/current/vertical-config"),
    updateCompanyConfig: (config: { vertical_id?: string; features?: string[]; config?: Record<string, unknown> }) => client.put<CompanyVerticalConfig>("/v1/companies/current/vertical-config", config),
  },
  financeAgent: {
    run: () => client.post<FinanceAgentRun>("/v1/finance-agent/run", { company_id: COMPANY_ID }),
    getControlTower: (companyId?: string) => client.get<any>("/v1/finance-agent/control-tower", { company_id: companyId || COMPANY_ID }),
    getInterAgentSync: (companyId?: string) => client.get<any>("/v1/finance-agent/inter-agent/sync", { company_id: companyId || COMPANY_ID }),
    getCashFlowForecast: (companyId?: string) => client.get<any>("/v1/finance-agent/cash-flow-forecast", { company_id: companyId || COMPANY_ID }),
    chat: (data: { message: string; conversation_history?: any[]; company_id?: string }) =>
      client.post<{ response: string; suggestions: string[]; action_proposal?: any }>("/v1/finance-agent/chat", { company_id: data.company_id || COMPANY_ID, ...data }),
    recommendations: (status?: string, tipo?: string, limit?: number, offset?: number) =>
      client.get<FinanceRecommendation[]>("/v1/finance-agent/recommendations", { company_id: COMPANY_ID, status, tipo, limit, offset }),
    countByTipo: (status?: string) => client.get<{ tipo: string; cantidad: number }[]>("/v1/finance-agent/recommendations/count-by-tipo", { company_id: COMPANY_ID, status }),
    approve: (id: string, approved_by: string, comments?: string) => client.post<FinanceRecommendation>(`/v1/finance-agent/recommendations/${id}/approve`, { approved_by, comments }),
    reject: (id: string, approved_by: string, comments?: string) => client.post<FinanceRecommendation>(`/v1/finance-agent/recommendations/${id}/reject`, { approved_by, comments }),
    bulkDecide: (approve: boolean, ids: string[], approved_by: string, comments?: string) =>
      client.post<{ decididas: number }>(`/v1/finance-agent/recommendations/bulk-decide?approve=${approve}`, { ids, approved_by, comments }),
  },
  salesAgent: {
    run: (companyId?: string) => client.post<SalesAgentRun>("/v1/sales-agent/run", { company_id: companyId || COMPANY_ID }),
    getAnalysis: (companyId?: string) => client.get<any>("/v1/sales-agent/analysis", { company_id: companyId || COMPANY_ID }),
    chat: (data: { message: string; conversation_history?: any[]; context_tab?: string; company_id?: string }) =>
      client.post<{ reply: string; action_outcome?: any; suggested_prompts?: string[] }>("/v1/sales-agent/chat", { company_id: data.company_id || COMPANY_ID, ...data }),
    applyPrice: (data: { product_id: string; nuevo_precio: number; motivo?: string; company_id?: string }) =>
      client.post<{ success: boolean; mensaje: string }>("/v1/sales-agent/apply-price", { company_id: data.company_id || COMPANY_ID, ...data }),
    recommendations: (status?: string, companyId?: string) => client.get<SalesRecommendation[]>("/v1/sales-agent/recommendations", { company_id: companyId || COMPANY_ID, status }),
    approve: (id: string, approved_by: string, comments?: string) => client.post<any>(`/v1/sales-agent/recommendations/${id}/approve`, { approved_by, comments }),
    reject: (id: string, approved_by: string, comments?: string) => client.post<any>(`/v1/sales-agent/recommendations/${id}/reject`, { approved_by, comments }),
  },
  generalAgent: {
    chat: (message: string, history: { role: "user" | "assistant"; content: string }[]) =>
      client.post<{ reply: string }>("/v1/general-agent/chat", { company_id: COMPANY_ID, message, history }),
  },
  accountsReceivable: {
    list: (params?: { estado?: string; customer_id?: string; search?: string; limit?: number; offset?: number }) => client.get<AccountsReceivable[]>(`/v1/companies/${COMPANY_ID}/accounts-receivable`, params),
    count: (params?: { estado?: string }) => client.get<{ total: number }>(`/v1/companies/${COMPANY_ID}/accounts-receivable/count`, params),
    get: (id: string) => client.get<AccountsReceivable>(`/v1/accounts-receivable/${id}`),
    create: (data: Partial<AccountsReceivable>) => client.post<AccountsReceivable>("/v1/accounts-receivable", data),
    update: (id: string, data: Partial<AccountsReceivable>) => client.patch<AccountsReceivable>(`/v1/accounts-receivable/${id}`, data),
    delete: (id: string) => client.delete<void>(`/v1/accounts-receivable/${id}`),
    aging: () => client.get<any>(`/v1/companies/${COMPANY_ID}/accounts-receivable/aging`),
    summary: () => client.get<any>(`/v1/companies/${COMPANY_ID}/accounts-receivable/summary`),
    downloadStatementPdf: (customerId: string) => downloadAuthenticated(`/v1/companies/${COMPANY_ID}/accounts-receivable/customers/${customerId}/statement.pdf`, undefined, `estado_cuenta_cliente_${customerId.slice(0, 8)}.pdf`),
    downloadAgingExcel: (params?: { fecha_desde?: string; fecha_hasta?: string }) => downloadAuthenticated(`/v1/companies/${COMPANY_ID}/accounts-receivable/export/aging.xlsx`, params, "aging_cuentas_por_cobrar.xlsx"),
    downloadAgingPdf: (params?: { fecha_desde?: string; fecha_hasta?: string }) => downloadAuthenticated(`/v1/companies/${COMPANY_ID}/accounts-receivable/export/aging.pdf`, params, "aging_cuentas_por_cobrar.pdf"),
    downloadCobranzasExcel: (params?: { fecha_desde?: string; fecha_hasta?: string }) => downloadAuthenticated(`/v1/companies/${COMPANY_ID}/accounts-receivable/export/cobranzas.xlsx`, params, "cobranzas.xlsx"),
    downloadCobranzasPdf: (params?: { fecha_desde?: string; fecha_hasta?: string }) => downloadAuthenticated(`/v1/companies/${COMPANY_ID}/accounts-receivable/export/cobranzas.pdf`, params, "cobranzas.pdf"),
    pendingForCustomer: (customerId: string) => client.get<{ id: string; numero_documento: string; fecha_emision: string; fecha_vencimiento: string | null; moneda: string; monto_original: number; saldo_pendiente: number; dias_mora: number }[]>(`/v1/companies/${COMPANY_ID}/accounts-receivable/customers/${customerId}/pending`),
    registerPayment: (data: { customer_id: string; monto_total: number; moneda?: string; forma_pago?: string; referencia?: string; fecha?: string; observaciones?: string; allocations: { accounts_receivable_id: string; monto: number }[] }) =>
      client.post<{ id: string; monto_total: number; allocations: { accounts_receivable_id: string; monto: number; nuevo_saldo: number; nuevo_estado: string }[] }>(`/v1/companies/${COMPANY_ID}/accounts-receivable/payments`, data),
    documentPayments: (id: string) => client.get<{ id: string; fecha: string; forma_pago: string | null; referencia: string | null; observaciones: string | null; monto: number; created_at: string }[]>(`/v1/accounts-receivable/${id}/payments`),
    customerPayments: (customerId: string) => client.get<{ id: string; fecha: string; monto_total: number; forma_pago: string | null; referencia: string | null; observaciones: string | null; created_at: string; allocations: { accounts_receivable_id: string; numero_documento: string; monto: number }[] }[]>(`/v1/companies/${COMPANY_ID}/accounts-receivable/customers/${customerId}/payments`),
  },
  backups: {
    list: () => client.get<Backup[]>("/v1/backups"),
    create: (schema_name?: string, tenant_id?: string, tenant_slug?: string) => {
      const params = new URLSearchParams()
      if (schema_name) params.append("schema_name", schema_name)
      if (tenant_id) params.append("tenant_id", tenant_id)
      if (tenant_slug) params.append("tenant_slug", tenant_slug)
      const qs = params.toString()
      return client.post<Backup>(`/v1/backups${qs ? "?" + qs : ""}`)
    },
    get: (id: string) => client.get<Backup>(`/v1/backups/${id}`),
    download: (id: string) => client.get<Blob>(`/v1/backups/${id}/download`),
    downloadUrl: (id: string) => `${API_BASE}/v1/backups/${id}/download`,
    delete: (id: string) => client.delete<void>(`/v1/backups/${id}`),
    cleanup: () => client.post<{ deleted: number }>("/v1/backups/cleanup"),
    getSchedule: () => client.get<BackupScheduleConfig>("/v1/backups/schedule"),
    updateSchedule: (config: Partial<BackupScheduleConfig>) => client.put<BackupScheduleConfig>("/v1/backups/schedule", config),
  },
  variants: {
    list: (productId?: string) => client.get<any[]>("/v1/variants", { product_id: productId } as any),
    get: (id: string) => client.get<any>(`/v1/variants/${id}`),
    create: (data: any) => client.post<any>("/v1/variants", { ...data, company_id: COMPANY_ID }),
    update: (id: string, data: any) => client.patch<any>(`/v1/variants/${id}`, data),
    delete: (id: string) => client.delete<void>(`/v1/variants/${id}`),
  },
  priceLists: {
    list: () => client.get<PriceList[]>("/v1/price-lists"),
    get: (id: string) => client.get<PriceList>(`/v1/price-lists/${id}`),
    create: (data: Partial<PriceList>) => client.post<PriceList>("/v1/price-lists", data),
    update: (id: string, data: Partial<PriceList>) => client.patch<PriceList>(`/v1/price-lists/${id}`, data),
    delete: (id: string) => client.delete<void>(`/v1/price-lists/${id}`),
    items: (listId: string) => client.get<PriceListItem[]>(`/v1/price-lists/${listId}/items`),
    addItem: (listId: string, data: Partial<PriceListItem>) => client.post<PriceListItem>(`/v1/price-lists/${listId}/items`, data),
    updateItem: (listId: string, itemId: string, data: Partial<PriceListItem>) => client.patch<PriceListItem>(`/v1/price-lists/${listId}/items/${itemId}`, data),
    removeItem: (listId: string, itemId: string) => client.delete<void>(`/v1/price-lists/${listId}/items/${itemId}`),
    resolvePrice: (customerId: string, productId: string, quantity = 1) => client.get<{ precio: number; price_list_id: string; source: string } | null>("/v1/price-lists/lookup", { customer_id: customerId, product_id: productId, quantity }),
  },
  posTerminalTransactions: {
    create: (data: Partial<PosTerminalTransaction>) => client.post<PosTerminalTransaction>("/v1/pos-terminal-transactions", data),
    update: (id: string, data: Partial<PosTerminalTransaction>) => client.patch<PosTerminalTransaction>(`/v1/pos-terminal-transactions/${id}`, data),
  },
  paymentIntegrations: {
    get: (provider: "bancard" | "plugpay" | "dinelco") => client.get<PaymentIntegrationConfig | null>(`/v1/payment-integrations/${provider}`),
    update: (provider: "bancard" | "plugpay" | "dinelco", data: { environment?: string; enabled?: boolean; config?: Record<string, any> }) =>
      client.put<PaymentIntegrationConfig>(`/v1/payment-integrations/${provider}`, data),
  },
  labelPrinting: {
    getPrinterConfig: (tipo: "pantum_rollo" | "zebra_zpl") => client.get<any | null>(`/v1/label-printing/printer-config/${tipo}`),
    updatePrinterConfig: (tipo: "pantum_rollo" | "zebra_zpl", data: Record<string, any>) => client.put<any>(`/v1/label-printing/printer-config/${tipo}`, data),
    listTemplates: (tipoImpresora?: string) => client.get<any[]>("/v1/label-printing/templates", tipoImpresora ? { tipo_impresora: tipoImpresora } : undefined),
    createTemplate: (data: Record<string, any>) => client.post<any>("/v1/label-printing/templates", data),
    deleteTemplate: (id: string) => client.delete<void>(`/v1/label-printing/templates/${id}`),
    resolve: (filtro: Record<string, any>) => client.post<any[]>("/v1/label-printing/resolve", filtro),
    printZebra: (data: { items: any[]; template_id?: string }) => client.post<{ zpl: string; enviado_por_red: boolean }>("/v1/label-printing/print/zebra", data),
  },
  intelifact: {
    getConfig: () => client.get<any | null>("/v1/intelifact/config"),
    updateConfig: (data: Record<string, any>) => client.put<any>("/v1/intelifact/config", data),
    previewInvoice: (data: Record<string, any>) => client.post<any>("/v1/intelifact/invoices/preview", data),
    telemetryStatus: () => client.get<{ disponible: boolean; detalle?: any; error?: string }>("/v1/intelifact/telemetry/status"),
  },
  plugpay: {
    compliance: (cpf: string) => client.get<{ ok: boolean; data?: any; error_message?: string }>(`/v1/plugpay/compliance/${cpf}`),
    createPix: (data: { monto: number; moneda?: string; customer_cpf?: string; customer_cpf_cnpj?: string; sale_id?: string; customer_id?: string }) =>
      client.post<{ ok: boolean; data?: any; error_message?: string; transaction_log_id?: string }>("/v1/plugpay/pix/create", data),
    pixStatus: (referenciaInterna: string) =>
      client.get<{ ok: boolean; data?: any; error_message?: string }>(`/v1/plugpay/pix/status/${referenciaInterna}`),
    pixQrcode: (referenciaInterna: string) =>
      client.get<{ ok: boolean; data?: any; error_message?: string }>(`/v1/plugpay/pix/qrcode/${referenciaInterna}`),
    quotePix: (data: { monto: number; moneda?: string }) =>
      client.post<{ ok: boolean; data?: any; error_message?: string }>("/v1/plugpay/pix/quote", data),
    calcularParcelado: (data: { monto: number; moneda?: string; cuotas: number }) =>
      client.post<{ ok: boolean; data?: any; error_message?: string }>("/v1/plugpay/credito-parcelado/calcular", data),
    startParcelado: (data: { monto: number; moneda?: string; cuotas: number; customer_cpf: string; customer_phone: string; sale_id?: string; customer_id?: string }) =>
      client.post<{ ok: boolean; data?: any; error_message?: string; transaction_log_id?: string }>("/v1/plugpay/credito-parcelado/start", data),
    parceladoStatus: (referenciaInterna: string) =>
      client.get<{ ok: boolean; data?: any; error_message?: string }>(`/v1/plugpay/credito-parcelado/${referenciaInterna}`),
    cancelParcelado: (referenciaInterna: string) =>
      client.post<{ ok: boolean; data?: any; error_message?: string }>(`/v1/plugpay/credito-parcelado/cancel/${referenciaInterna}`, {}),
    linkSale: (txnId: string, saleId: string) => client.patch<{ message: string }>(`/v1/plugpay/transactions/${txnId}/link-sale/${saleId}`, {}),
    getTransactions: (params?: { fecha_desde?: string; fecha_hasta?: string; tipo_operacion?: string; exitosa?: boolean; limit?: number; offset?: number }) =>
      client.get<{ ok: boolean; items: any[]; total: number; limit: number; offset: number }>("/v1/plugpay/transactions", params),
    getSummary: (params?: { fecha_desde?: string; fecha_hasta?: string }) =>
      client.get<{
        ok: boolean;
        total_transacciones: number;
        total_exitosas: number;
        total_fallidas: number;
        tasa_exito_pct: number;
        volumen_pix_brl: number;
        volumen_pix_pyg: number;
        volumen_parcelado_brl: number;
        volumen_parcelado_pyg: number;
        total_volumen_brl: number;
        total_volumen_pyg: number;
        transacciones_con_venta: number;
      }>("/v1/plugpay/summary", params),
  },
  integrations: {
    configs: () => client.get<IntegrationConfig[]>("/api/integrations/configs"),
    getConfig: (id: string) => client.get<IntegrationConfig>(`/api/integrations/configs/${id}`),
    createConfig: (data: Partial<IntegrationConfig>) => client.post<IntegrationConfig>("/api/integrations/configs", data),
    updateConfig: (id: string, data: Partial<IntegrationConfig>) => client.patch<IntegrationConfig>(`/api/integrations/configs/${id}`, data),
    deleteConfig: (id: string) => client.delete<void>(`/api/integrations/configs/${id}`),
    testConfig: (id: string) => client.post<any>(`/api/integrations/configs/${id}/test`),
    deliveries: () => client.get<IntegrationDelivery[]>("/api/integrations/deliveries"),
    getDelivery: (id: string) => client.get<IntegrationDelivery>(`/api/integrations/deliveries/${id}`),
    retryDelivery: (id: string) => client.post<IntegrationDelivery>(`/api/integrations/deliveries/${id}/retry`),
    posKpis: () => client.get<any>("/v1/integrations/pos/kpis"),
    posTransactions: (params?: { limit?: number; procesador?: string }) => client.get<any[]>("/v1/integrations/pos/transactions", params),
    posMatch: (data: any) => client.post<any[]>("/v1/integrations/pos/match", data),
    posClaim: (data: any) => client.post<any>("/v1/integrations/pos/claim", data),
  },
  intelicont: {
    syncConfig: () => client.get<any>("/v1/intelicont/sync-config"),
    updateSyncConfig: (data: unknown) => client.put<any>("/v1/intelicont/sync-config", data),
    entries: () => client.get<InteliContEntry[]>("/v1/intelicont/entries"),
    generate: () => client.post<any>("/v1/intelicont/generate"),
    sync: () => client.post<any>("/v1/intelicont/sync"),
    pending: () => client.get<any[]>("/v1/intelicont/pending"),
    bulkSync: () => client.post<any>("/v1/intelicont/bulk-sync"),
  },
  inteliaudit: {
    syncConfig: () => client.get<any>("/v1/inteliaudit/sync-config"),
    createSyncConfig: (data: unknown) => client.post<any>("/v1/inteliaudit/sync-config", data),
    updateSyncConfig: (data: unknown) => client.put<any>("/v1/inteliaudit/sync-config", data),
    logs: (params?: { accion?: string; entidad?: string; limit?: number; offset?: number }) => client.get<InteliAuditEvent[]>("/v1/inteliaudit/logs", { ...params }),
    events: () => client.get<string[]>("/v1/inteliaudit/events"),
    recordEvent: (data: Partial<InteliAuditEvent>) => client.post<InteliAuditEvent>("/v1/inteliaudit/audit-event", data),
    syncAll: () => client.post<any>("/v1/inteliaudit/sync-all"),
    pushAnomalies: () => client.post<any>("/v1/inteliaudit/push-anomalies"),
  },
  sueldok: {
    getSSOUrl: (redirect?: string, companyId?: string) => client.get<any>("/v1/sueldok/sso-url", { redirect, company_id: companyId }),
    getSummary: (companyId?: string) => client.get<any>("/v1/sueldok/summary", { company_id: companyId }),
    getShifts: (companyId?: string) => client.get<any>("/v1/sueldok/shifts", { company_id: companyId }),
    syncShifts: (data: any) => client.post<any>("/v1/sueldok/sync-shifts", data),
    getProductivityBonuses: (companyId?: string) => client.get<any[]>("/v1/sueldok/productivity-bonuses", { company_id: companyId }),
    exportBonuses: (data: any) => client.post<any>("/v1/sueldok/export-bonuses", data),
    syncConfig: () => client.get<any>("/v1/sueldok/sync-config"),
    createSyncConfig: (data: unknown) => client.post<any>("/v1/sueldok/sync-config", data),
    updateSyncConfig: (data: unknown) => client.put<any>("/v1/sueldok/sync-config", data),
    syncPayroll: (data: unknown) => client.post<any>("/v1/sueldok/sync/payroll", data),
    syncCommissions: (companyId: string, periodo: string) => client.post<any>("/v1/sueldok/sync/sales-commissions", { company_id: companyId, periodo }),
    events: () => client.get<string[]>("/v1/sueldok/events"),
  },
  security: {
    apiKeys: () => client.get<SecurityApiKey[]>("/v1/security/api-keys"),
    createApiKey: (data: { nombre: string; scopes?: string[] }) => client.post<SecurityApiKey>("/v1/security/api-keys", data),
    revokeApiKey: (id: string) => client.delete<void>(`/v1/security/api-keys/${id}`),
  },
  email: {
    config: () => client.get<EmailConfig>("/v1/email/config"),
    updateConfig: (data: Partial<EmailConfig>) => client.put<EmailConfig>("/v1/email/config", data),
    test: (data: { to: string; subject: string; body: string }) => client.post<any>("/v1/email/test", data),
  },
  events: {
    stream: () => new EventSource(`${API_BASE}/v1/events/stream`),
  },
  bancard: {
    payments: (companyId: string) => client.get<BancardTransaction[]>("/v1/bancard/payments", { company_id: companyId }),
    getPayment: (paymentId: string) => client.get<BancardTransaction>(`/v1/bancard/payments/${paymentId}`),
    checkout: (amount: number, description: string, order_id: string) => client.post<BancardCheckoutResponse>("/v1/bancard/checkout", { amount, description, order_id }),
    verify: (processId: string) => client.get<{ status: string; process_id: string; authorization_code: string; card_last4: string; card_brand: string }>(`/v1/bancard/verify/${processId}`),
  },
  spi: {
    checkout: (data: { amount: number; order_id: string; description?: string; customer_email?: string; customer_name?: string }) => client.post<SpiQr>("/v1/spi/checkout", data),
    generateQr: (amount: number, order_id: string, description?: string) => client.post<SpiQr>("/v1/spi/checkout", { amount, order_id, description }),
    verify: (orderId: string) => client.post<SpiQr>(`/v1/spi/verify/${orderId}`),
    transactions: () => client.get<SpiQr[]>("/v1/spi/transactions"),
    getTransaction: (id: string) => client.get<SpiQr>(`/v1/spi/transactions/${id}`),
    config: () => client.get<{ configured: boolean }>("/v1/spi/config"),
    qr: (amount: number, order_id: string, description?: string) => client.get<SpiQr>(`/v1/spi/qr?amount=${amount}&order_id=${order_id}&description=${description ?? ""}`),
  },
  dinelco: {
    payments: (companyId: string) => client.get<DinelcoTransaction[]>("/v1/dinelco/payments", { company_id: companyId }),
    getPayment: (paymentId: string) => client.get<DinelcoTransaction>(`/v1/dinelco/payments/${paymentId}`),
    checkout: (amount: number, description: string, order_id: string, customer_email?: string, customer_name?: string) => client.post<DinelcoCheckoutResponse>("/v1/dinelco/checkout", { amount, description, order_id, customer_email: customer_email || "", customer_name: customer_name || "" }),
    verify: (paymentId: string) => client.get<{ payment_id: string; status: string; card_brand: string; card_last4: string; installments: number; authorization_code: string }>(`/v1/dinelco/verify/${paymentId}`),
  },
  portal: {
    customerSales: (customerId: string) => client.get<Sale[]>(`/api/public/portal/customers/${customerId}/sales`),
    customerBalance: (customerId: string) => client.get<{ saldo: number; limite_credito: number }>(`/api/public/portal/customers/${customerId}/balance`),
    customerInfo: (customerId: string) => client.get<PortalCustomer>(`/api/public/portal/customers/${customerId}`),
  },
  commercialAgreements: {
    list: (companyId: string, params?: { supplier_id?: string; estado?: string; vigentes?: boolean; limit?: number; offset?: number }) => client.get<CommercialAgreement[]>(`/v1/companies/${companyId}/commercial-agreements`, params as any),
    get: (id: string) => client.get<CommercialAgreement>(`/v1/commercial-agreements/${id}`),
    create: (data: any) => client.post<CommercialAgreement>("/v1/commercial-agreements", data),
    update: (id: string, data: any) => client.put<CommercialAgreement>(`/v1/commercial-agreements/${id}`, data),
    approve: (id: string, aprobado_por: string) => client.post<any>(`/v1/commercial-agreements/${id}/approve?aprobado_por=${aprobado_por}`),
    activate: (id: string) => client.post<any>(`/v1/commercial-agreements/${id}/activate`),
    renew: (id: string) => client.post<any>(`/v1/commercial-agreements/${id}/renew`),
    cancel: (id: string, motivo?: string) => client.post<any>(`/v1/commercial-agreements/${id}/cancel${motivo ? `?motivo=${motivo}` : ""}`),
    expiring: (companyId: string, dias?: number) => client.get<CommercialAgreement[]>(`/v1/companies/${companyId}/commercial-agreements/expiring${dias ? `?dias=${dias}` : ""}`),
    summary: (id: string) => client.get<any>(`/v1/commercial-agreements/${id}/summary`),
    items: {
      add: (agreementId: string, data: any) => client.post<any>(`/v1/commercial-agreements/${agreementId}/items`, data),
      remove: (itemId: string) => client.delete<any>(`/v1/commercial-agreements/items/${itemId}`),
    },
    rebates: {
      pending: (companyId: string) => client.get<any[]>(`/v1/companies/${companyId}/rebates/pending`),
      liquidate: (rebateId: string, aprobado_por: string) => client.post<any>(`/v1/rebates/${rebateId}/liquidate?aprobado_por=${aprobado_por}`),
    },
    negotiations: {
      list: (companyId: string, params?: { supplier_id?: string; estado?: string }) => client.get<any[]>(`/v1/companies/${companyId}/supplier-negotiations`, params as any),
      create: (data: any) => client.post<any>("/v1/supplier-negotiations", data),
      close: (id: string, estado: string, precio_final?: number) => client.post<any>(`/v1/supplier-negotiations/${id}/close?estado=${estado}${precio_final !== undefined ? `&precio_final=${precio_final}` : ""}`),
    },
    bySupplier: (companyId: string) => client.get<any>(`/v1/companies/${companyId}/agreements/by-supplier`),
  },
  kits: {
    list: () => client.get<any[]>("/v1/kits"),
    get: (id: string) => client.get<any>(`/v1/kits/${id}`),
    create: (data: any) => client.post<any>("/v1/kits", { ...data, company_id: COMPANY_ID }),
    update: (id: string, data: any) => client.put<any>(`/v1/kits/${id}`, data),
    delete: (id: string) => client.delete<void>(`/v1/kits/${id}`),
    calculatePrice: (id: string) => client.get<any>(`/v1/kits/${id}/price`),
  },
  loyalty: {
    getConfig: (companyId: string) => client.get<LoyaltyConfig>(`/v1/loyalty/config/${companyId}`),
    updateConfig: (companyId: string, data: Partial<LoyaltyConfig>) => client.put<LoyaltyConfig>(`/v1/loyalty/config/${companyId}`, data),
    addPoints: (data: { company_id: string; customer_id: string; tipo: string; puntos: number; referencia_tipo?: string; referencia_id?: string; descripcion?: string }) => client.post<LoyaltyPoints>("/v1/loyalty/points", data),
    balance: (customerId: string, companyId: string) => client.get<{ customer_id: string; total_puntos: number; puntos_por_vencer: number }>(`/v1/loyalty/balance/${customerId}`, { company_id: companyId }),
    history: (customerId: string, companyId: string, limit?: number) => client.get<LoyaltyPoints[]>(`/v1/loyalty/history/${customerId}`, { company_id: companyId, limit: limit || 50 }),
    rewards: (companyId: string, activo?: boolean) => client.get<LoyaltyReward[]>("/v1/loyalty/rewards", { company_id: companyId, ...(activo !== undefined ? { activo: String(activo) } : {}) }),
    createReward: (data: { company_id: string; nombre: string; puntos_requeridos: number; tipo_recompensa: string; descripcion?: string; valor_recompensa?: number; stock?: number; imagen_url?: string }) => client.post<LoyaltyReward>("/v1/loyalty/rewards", data),
    updateReward: (rewardId: string, data: Partial<LoyaltyReward>) => client.put<LoyaltyReward>(`/v1/loyalty/rewards/${rewardId}`, data),
    deleteReward: (rewardId: string) => client.delete<void>(`/v1/loyalty/rewards/${rewardId}`),
  },
  imports: {
    templates: () => client.get<ImportTemplate[]>("/v1/imports/templates"),
    upload: (data: FormData) => client.post<ImportResult>("/v1/imports/upload", data),
    preview: (data: unknown) => client.post<any>("/v1/imports/preview", data),
    process: (importId: string) => client.post<ImportResult>(`/v1/imports/${importId}/process`),
  },
  receipts: {
    generate: (saleId: string) => client.get<Blob>(`/v1/receipts/${saleId}`, undefined),
    get: (saleId: string) => client.get<{ pdf_url: string; qr_url: string }>(`/v1/receipts/${saleId}/info`),
  },
  supermer: {
    dashboard: () => client.get<SupermerDashboard>("/v1/supermer/dashboard"),
    productionByArea: (params?: { desde?: string; hasta?: string }) => client.get<SupermerProductionByArea[]>("/v1/supermer/production-by-area", params as any),
    recipes: {
      list: (params?: { area?: string; activa?: boolean }) => client.get<SupermerRecipe[]>("/v1/supermer/recipes", params as any),
      get: (id: string) => client.get<SupermerRecipe>(`/v1/supermer/recipes/${id}`),
      create: (data: any) => client.post<SupermerRecipe>("/v1/supermer/recipes", data),
      update: (id: string, data: any) => client.put<SupermerRecipe>(`/v1/supermer/recipes/${id}`, data),
      delete: (id: string) => client.delete<void>(`/v1/supermer/recipes/${id}`),
    },
    orders: {
      list: (params?: { area?: string; estado?: string; desde?: string; hasta?: string }) => client.get<SupermerOrder[]>("/v1/supermer/orders", params as any),
      get: (id: string) => client.get<SupermerOrder>(`/v1/supermer/orders/${id}`),
      create: (data: any) => client.post<SupermerOrder>("/v1/supermer/orders", data),
      update: (id: string, data: any) => client.put<SupermerOrder>(`/v1/supermer/orders/${id}`, data),
      complete: (id: string, data: { producto_obtenido: number; costo_unitario?: number; fecha_vencimiento?: string; lote_codigo?: string }) => client.post<SupermerOrder>(`/v1/supermer/orders/${id}/complete`, data),
    },
    batches: {
      list: (params?: { producto_id?: string; vencimiento_antes?: string }) => client.get<SupermerBatch[]>("/v1/supermer/batches", params as any),
    },
    waste: {
      list: (params?: { area?: string; tipo_merma?: string; desde?: string; hasta?: string }) => client.get<SupermerWaste[]>("/v1/supermer/waste", params as any),
      byArea: (params?: { desde?: string; hasta?: string }) => client.get<SupermerWasteByArea[]>("/v1/supermer/waste/by-area", params as any),
      create: (data: any) => client.post<SupermerWaste>("/v1/supermer/waste", data),
      update: (id: string, data: any) => client.put<SupermerWaste>(`/v1/supermer/waste/${id}`, data),
    },
    perishableConfigs: {
      list: (params?: { categoria?: string }) => client.get<SupermerPerishableConfig[]>("/v1/supermer/perishable-configs", params as any),
      upsert: (data: any) => client.put<SupermerPerishableConfig>("/v1/supermer/perishable-configs", data),
    },
    markdowns: {
      list: () => client.get<SupermerMarkdown[]>("/v1/supermer/markdowns"),
      create: (data: any) => client.post<SupermerMarkdown>("/v1/supermer/markdowns", data),
      deactivate: (id: string) => client.post<{ detail: string }>(`/v1/supermer/markdowns/${id}/deactivate`),
      autoApply: () => client.post<{ detail: string }>("/v1/supermer/auto-markdowns"),
    },
    forecasts: {
      list: (params?: { producto_id?: string; desde?: string; hasta?: string }) => client.get<SupermerForecast[]>("/v1/supermer/forecasts", params as any),
      generate: (lookbackDays?: number) => client.post<{ detail: string }>("/v1/supermer/forecasts/generate", { lookback_days: lookbackDays || 90 }),
    },
    suggestions: {
      list: (params?: { estado?: string }) => client.get<SupermerSuggestion[]>("/v1/supermer/suggestions", params as any),
      generate: () => client.post<{ detail: string }>("/v1/supermer/suggestions/generate"),
      update: (id: string, data: any) => client.put<SupermerSuggestion>(`/v1/supermer/suggestions/${id}`, data),
    },
    butchery: {
      templates: {
        list: (params?: { activa?: boolean }) => client.get<ButcheryTemplate[]>("/v1/supermer/butchery/templates", params as any),
        get: (id: string) => client.get<ButcheryTemplate>(`/v1/supermer/butchery/templates/${id}`),
        create: (data: any) => client.post<ButcheryTemplate>("/v1/supermer/butchery/templates", data),
      },
      desposte: (data: DesposteInput) => client.post<DesposteResponse>("/v1/supermer/butchery/desposte", data),
      orders: (params?: { limit?: number; offset?: number }) => client.get<SupermerOrder[]>("/v1/supermer/butchery/orders", params as any),
      yieldReport: (params?: { desde?: string; hasta?: string }) => client.get<any[]>("/v1/supermer/butchery/yield-report", params as any),
    },
    bakery: {
      plans: (params?: { dia_semana?: number }) => client.get<BakeryPlan[]>("/v1/supermer/bakery/plans", params as any),
      getPlan: (id: string) => client.get<BakeryPlan>(`/v1/supermer/bakery/plans/${id}`),
      createPlan: (data: any) => client.post<BakeryPlan>("/v1/supermer/bakery/plans", data),
      deletePlan: (id: string) => client.delete(`/v1/supermer/bakery/plans/${id}`),
      scaleRecipe: (data: ScaleRecipeInput) => client.post<ScaleRecipeResult>("/v1/supermer/bakery/scale-recipe", data),
      executePlan: (data: any) => client.post<ExecutePlanResult>("/v1/supermer/bakery/execute-plan", data),
    },
    produce: {
      receiveBatches: {
        list: (params?: { producto_id?: string; proveedor_id?: string; limit?: number; offset?: number }) => client.get<ProduceReceiveBatch[]>("/v1/supermer/produce/receive", params as any),
        get: (id: string) => client.get<ProduceReceiveBatch>(`/v1/supermer/produce/receive/${id}`),
        create: (data: any) => client.post<ProduceReceiveBatch>("/v1/supermer/produce/receive", data),
      },
      freshness: {
        list: (params?: { producto_id?: string; limit?: number; offset?: number }) => client.get<ProduceFreshnessAudit[]>("/v1/supermer/produce/freshness", params as any),
        create: (data: any) => client.post<ProduceFreshnessAudit>("/v1/supermer/produce/freshness", data),
      },
      scorecards: {
        list: (params?: { proveedor_id?: string; limit?: number; offset?: number }) => client.get<ProduceSupplierScorecard[]>("/v1/supermer/produce/scorecards", params as any),
        generate: () => client.post<{ detail: string }>("/v1/supermer/produce/scorecards/generate"),
      },
      markdownByBatch: (data?: AutoApplyMarkdownByBatchInput) => client.post<AutoApplyMarkdownResult>("/v1/supermer/produce/markdown-by-batch", data || {}),
      enhancedForecast: (data?: ForecastEnhanceInput) => client.post<ProduceReceiveBatch[]>("/v1/supermer/produce/enhanced-forecast", data || {}),
      dashboard: () => client.get<ProduceDashboard>("/v1/supermer/produce/dashboard"),
    },
  },
  promotions: {
    list: (params?: { activo?: boolean; tipo?: string; estado?: string; origen_fuente?: string; limit?: number; offset?: number }) => client.get<Promotion[]>("/v1/promotions", params as any),
    get: (id: string) => client.get<Promotion>(`/v1/promotions/${id}`),
    create: (data: any) => client.post<Promotion>("/v1/promotions", data),
    update: (id: string, data: any) => client.put<Promotion>(`/v1/promotions/${id}`, data),
    delete: (id: string) => client.delete(`/v1/promotions/${id}`),
    toggle: (id: string) => client.post<Promotion>(`/v1/promotions/${id}/toggle`),
    reactivate: (id: string, data: any) => client.post<Promotion>(`/v1/promotions/${id}/reactivate`, data),
    approveLoss: (id: string, data?: any) => client.post<Promotion>(`/v1/promotions/${id}/approve-loss`, data || {}),
    sellOutClaim: (id: string) => client.get<any>(`/v1/promotions/${id}/sell-out-claim`),
    recordVendorCreditNote: (id: string, data: any) => client.post<Promotion>(`/v1/promotions/${id}/vendor-credit-note`, data),
    syncNemuha: () => client.post<any>("/v1/promotions/sync-nemuha"),
    expiringAlerts: () => client.get<any[]>("/v1/promotions/expiring-alerts"),
    resolveProduct: (productId: string, precio: number, cantidad?: number) => client.get<any>(`/v1/promotions/resolve-product/${productId}`, { precio, cantidad: cantidad || 1 }),
    authorizeFlashGrace: (data: any) => client.post<any>("/v1/promotions/authorize-flash-grace", data),
    calculate: (data: any) => client.post<any>("/v1/promotions/calculate", data),
    usage: (id: string, params?: { limit?: number; offset?: number }) => client.get<PromotionUsage[]>(`/v1/promotions/${id}/usage`, params as any),
  },
  expenses: {
    categories: {
      list: () => client.get<ExpenseCategory[]>("/v1/expenses/categories"),
      create: (data: any) => client.post<ExpenseCategory>("/v1/expenses/categories", data),
    },
    costCenters: {
      list: () => client.get<CostCenter[]>("/v1/expenses/cost-centers"),
      create: (data: any) => client.post<CostCenter>("/v1/expenses/cost-centers", data),
    },
    list: (params?: { branch_id?: string; category_id?: string; estado?: string; desde?: string; hasta?: string; limit?: number; offset?: number }) => client.get<Expense[]>("/v1/expenses", params as any),
    get: (id: string) => client.get<Expense>(`/v1/expenses/${id}`),
    create: (data: any) => client.post<Expense>("/v1/expenses", data),
    update: (id: string, data: any) => client.put<Expense>(`/v1/expenses/${id}`, data),
    delete: (id: string) => client.delete(`/v1/expenses/${id}`),
    approve: (id: string) => client.post<Expense>(`/v1/expenses/${id}/approve`),
    reject: (id: string, motivo: string) => client.post<Expense>(`/v1/expenses/${id}/reject`, { motivo }),
    void: (id: string, motivo: string) => client.post<Expense>(`/v1/expenses/${id}/void`, { motivo }),
    uploadComprobante: (file: File) => {
      const fd = new FormData()
      fd.append("file", file)
      return requestMultipart<{ url: string; filename: string }>("/v1/expenses/upload-comprobante", fd)
    },
    summary: () => client.get<ExpenseSummary>("/v1/expenses/summary"),
    dashboard: (params?: { fecha_desde?: string; fecha_hasta?: string }) => client.get<ExpenseDashboard>("/v1/expenses/dashboard", params as any),
    approvalConfig: {
      get: () => client.get<{ umbral_aprobacion: number; tolerancia_arqueo: number }>("/v1/expenses/config/approval"),
      update: (data: { umbral_aprobacion: number; tolerancia_arqueo: number }) => client.patch<{ umbral_aprobacion: number; tolerancia_arqueo: number }>("/v1/expenses/config/approval", data),
    },
    funds: {
      list: (params?: { activo?: boolean }) => client.get<PettyCashFund[]>("/v1/petty-cash-funds", params as any),
      create: (data: { branch_id?: string; nombre: string; custodio_id?: string; monto_autorizado: number }) => client.post<PettyCashFund>("/v1/petty-cash-funds", data),
      update: (id: string, data: { nombre?: string; custodio_id?: string; activo?: boolean }) => client.patch<PettyCashFund>(`/v1/petty-cash-funds/${id}`, data),
      movements: (id: string, limit?: number) => client.get<PettyCashFundMovement[]>(`/v1/petty-cash-funds/${id}/movements`, limit ? { limit } : undefined),
      replenish: (id: string, data: { monto: number; bank_account_id?: string; referencia?: string; observaciones?: string }) => client.post<PettyCashFund>(`/v1/petty-cash-funds/${id}/replenish`, data),
      counts: {
        pendingAll: () => client.get<PettyCashFundCount[]>("/v1/petty-cash-funds/counts/pending"),
        create: (fundId: string, data: { monto_contado: number; observaciones?: string }) => client.post<PettyCashFundCount>(`/v1/petty-cash-funds/${fundId}/counts`, data),
        list: (fundId: string, limit?: number) => client.get<PettyCashFundCount[]>(`/v1/petty-cash-funds/${fundId}/counts`, limit ? { limit } : undefined),
        confirm: (countId: string, data: { ajustar: boolean; observaciones?: string }) => client.post<PettyCashFundCount>(`/v1/petty-cash-funds/counts/${countId}/confirm`, data),
      },
    },
  },
  financial: {
    invoices: {
      list: (params?: { estado?: string; supplier_id?: string; vencidas?: boolean; desde?: string; hasta?: string; limit?: number; offset?: number }) => client.get<SupplierInvoice[]>("/v1/financial/invoices", { company_id: COMPANY_ID, ...params } as any),
      get: (id: string) => client.get<SupplierInvoice>(`/v1/financial/invoices/${id}`),
      create: (data: any) => client.post<SupplierInvoice>("/v1/financial/invoices", { company_id: COMPANY_ID, ...data }),
      approve: (id: string) => client.post<{ detail: string }>(`/v1/financial/invoices/${id}/approve`),
      pay: (id: string, data: any) => client.post<{ pending_approval: boolean; request_id?: string; id?: string; monto: number; estado?: string }>(`/v1/financial/invoices/${id}/pay`, data),
      byReceipt: (receiptId: string) => client.get<{ found: boolean; id?: string; numero_factura?: string; total?: number; estado?: string }>(`/v1/financial/invoices/by-receipt/${receiptId}`),
      downloadStatementPdf: (supplierId: string) => downloadAuthenticated(`/v1/financial/suppliers/${supplierId}/statement.pdf`, { company_id: COMPANY_ID }, `estado_cuenta_proveedor_${supplierId.slice(0, 8)}.pdf`),
    },
    aging: () => client.get<any[]>("/v1/financial/aging", { company_id: COMPANY_ID } as any),
    apDashboard: () => client.get<APDashboard>("/v1/financial/dashboard", { company_id: COMPANY_ID } as any),
    paymentQueue: () => client.get<any>("/v1/financial/ap/payment-queue", { company_id: COMPANY_ID } as any),
    apApprovals: {
      list: (estado: string = "pendiente") => client.get<any[]>("/v1/financial/ap/approvals", { company_id: COMPANY_ID, estado } as any),
      approve: (id: string) => client.post<{ success: boolean; completo: boolean }>(`/v1/financial/ap/approvals/${id}/approve`),
      reject: (id: string, motivo?: string) => client.post<{ success: boolean }>(`/v1/financial/ap/approvals/${id}/reject`, { motivo }),
    },
    creditNotes: (params?: { supplier_id?: string }) => client.get<{ id: string; supplier_id: string; supplier_nombre: string; numero: string; numero_factura_origen: string; fecha: string; motivo: string; monto: number; moneda: string; observaciones: string }[]>("/v1/financial/supplier-credit-notes", { company_id: COMPANY_ID, ...params } as any),
    supplierReturns: (params?: { supplier_id?: string }) => client.get<{ id: string; supplier_id: string; supplier_nombre: string; numero_factura_origen: string; numero_nota_credito: string; fecha: string; monto: number; moneda: string; observaciones: string }[]>("/v1/financial/supplier-returns", { company_id: COMPANY_ID, ...params } as any),
    payrollByConcepto: (params?: { fecha_desde?: string; fecha_hasta?: string }) => client.get<{ concepto: string; es_credito: boolean; cantidad: number; monto: number; porcentaje: number | null }[]>("/v1/financial/payroll/by-concepto", { company_id: COMPANY_ID, ...params } as any),
    payrollMovements: (params?: { empleado_nombre?: string }) => client.get<{ id: string; empleado_nombre: string; concepto: string; es_credito: boolean; monto: number; fecha: string; cerrado: boolean; observaciones: string }[]>("/v1/financial/payroll-movements", { company_id: COMPANY_ID, ...params } as any),
    banks: {
      list: () => client.get<BankAccount[]>("/v1/financial/banks", { company_id: COMPANY_ID } as any),
      create: (data: any) => client.post<BankAccount>("/v1/financial/banks", { company_id: COMPANY_ID, ...data }),
      update: (id: string, data: any) => client.put<BankAccount>(`/v1/financial/banks/${id}`, data),
      delete: (id: string) => client.delete(`/v1/financial/banks/${id}`),
      transactions: (id: string, params?: { conciliado?: boolean; desde?: string; hasta?: string; categoria?: string; limit?: number }) => client.get<BankTransaction[]>(`/v1/financial/banks/${id}/transactions`, { company_id: COMPANY_ID, ...params } as any),
      allTransactions: (params?: { conciliado?: boolean; desde?: string; hasta?: string; categoria?: string; limit?: number }) => client.get<BankTransaction[]>("/v1/financial/banks/transactions", { company_id: COMPANY_ID, ...params } as any),
      import: (id: string, data: any) => client.post<{ detail: string }>(`/v1/financial/banks/${id}/import`, data),
      verifyBalance: (id: string) => client.post<BankAccount>(`/v1/financial/banks/${id}/verify-balance`),
      requestCorrection: (id: string, data: { saldo_propuesto: number; motivo: string }) => client.post<{ success: boolean; request_id: string }>(`/v1/financial/banks/${id}/request-correction`, data),
      previewImportFile: (id: string, file: File, mes: number, anio: number) => {
        const fd = new FormData()
        fd.append("file", file); fd.append("mes", String(mes)); fd.append("anio", String(anio))
        return requestMultipart<{ sheet_matched: string; saldo_anterior: number | null; closing_from_totals: number | null; total_detectadas: number; nuevas: number; duplicadas: number; transacciones: any[] }>(`/v1/financial/banks/${id}/import-file/preview`, fd)
      },
      importFile: (id: string, file: File, mes: number, anio: number) => {
        const fd = new FormData()
        fd.append("file", file); fd.append("mes", String(mes)); fd.append("anio", String(anio)); fd.append("company_id", COMPANY_ID)
        return requestMultipart<{ sheet_matched: string; total_detectadas: number; nuevas: number; duplicadas: number; saldo_actual: number }>(`/v1/financial/banks/${id}/import-file`, fd)
      },
    },
    balanceCorrections: {
      list: (estado: string = "pendiente") => client.get<BankBalanceCorrection[]>("/v1/financial/banks/balance-corrections", { company_id: COMPANY_ID, estado } as any),
      approve: (id: string) => client.post<{ success: boolean; completo: boolean }>(`/v1/financial/banks/balance-corrections/${id}/approve`),
      reject: (id: string, motivo?: string) => client.post<{ success: boolean }>(`/v1/financial/banks/balance-corrections/${id}/reject`, { motivo }),
    },
    reconcile: (id: string, data: { matched_type: string; matched_id?: string }) => client.post<any>(`/v1/financial/transactions/${id}/reconcile`, data),
    unreconcile: (id: string) => client.post<any>(`/v1/financial/transactions/${id}/unreconcile`),
    bulkReconcile: (matches: { transaction_id: string; matched_type: string; matched_id?: string }[]) => client.post<{ conciliadas: number; fallidas: string[] }>("/v1/financial/transactions/bulk-reconcile", { matches }),
    suggestions: (id: string) => client.get<any[]>(`/v1/financial/transactions/${id}/suggestions`, { company_id: COMPANY_ID }),
    banksDashboard: () => client.get<any>("/v1/financial/banks/dashboard", { company_id: COMPANY_ID } as any),
    cashPosition: () => client.get<any>("/v1/financial/banks/cash-position", { company_id: COMPANY_ID } as any),
    outstandingItems: () => client.get<any>("/v1/financial/banks/outstanding-items", { company_id: COMPANY_ID } as any),
    downloadCashPositionPdf: () => downloadAuthenticated("/v1/financial/banks/export/cash-position.pdf", { company_id: COMPANY_ID }, "posicion_de_caja.pdf"),
    downloadReconciliationPdf: (accountId: string, params?: { desde?: string; hasta?: string }) =>
      downloadAuthenticated(`/v1/financial/banks/${accountId}/export/reconciliation.pdf`, { company_id: COMPANY_ID, ...params }, `conciliacion_bancaria_${accountId.slice(0, 8)}.pdf`),
    downloadApAgingPdf: () => downloadAuthenticated("/v1/financial/ap/export/aging.pdf", { company_id: COMPANY_ID }, "antiguedad_saldos_ap.pdf"),
    downloadTopSuppliersPdf: (params?: { desde?: string; hasta?: string }) =>
      downloadAuthenticated("/v1/financial/ap/export/top-suppliers.pdf", { company_id: COMPANY_ID, ...params }, "top_proveedores_dpo.pdf"),
    cashFlow: {
      list: (params?: { desde?: string; hasta?: string }) => client.get<CashFlowProjection[]>("/v1/financial/cash-flow", { company_id: COMPANY_ID, ...params } as any),
      generate: () => client.post<CashFlowProjection[]>(`/v1/financial/cash-flow/generate?company_id=${COMPANY_ID}`),
      update: (id: string, data: any) => client.post<CashFlowProjection>(`/v1/financial/cash-flow/${id}`, data),
      dashboard: () => client.get<CashFlowDashboard>("/v1/financial/cash-flow/dashboard", { company_id: COMPANY_ID } as any),
      alertConfig: {
        get: () => client.get<{ activo: boolean; dias_horizonte: number; telefono: string | null }>("/v1/financial/cash-flow/alert-config", { company_id: COMPANY_ID } as any),
        update: (data: { activo: boolean; dias_horizonte: number; telefono?: string | null }) =>
          client.put<{ activo: boolean; dias_horizonte: number; telefono: string | null }>(`/v1/financial/cash-flow/alert-config?company_id=${COMPANY_ID}`, data),
      },
    },
    budgets: {
      list: (params?: { periodo?: string; area?: string }) => client.get<Budget[]>("/v1/financial/budgets", { company_id: COMPANY_ID, ...params } as any),
      create: (data: any) => client.post<Budget>("/v1/financial/budgets", { company_id: COMPANY_ID, ...data }),
      update: (id: string, data: any) => client.put<Budget>(`/v1/financial/budgets/${id}`, data),
      delete: (id: string) => client.delete(`/v1/financial/budgets/${id}`),
      vsActual: (params?: { periodo?: string }) => client.get<Budget[]>("/v1/financial/budgets/vs-actual", { company_id: COMPANY_ID, ...params } as any),
    },
    paymentRuns: {
      list: () => client.get<PaymentRun[]>("/v1/financial/payment-runs", { company_id: COMPANY_ID } as any),
      get: (id: string) => client.get<any>(`/v1/financial/payment-runs/${id}`),
      create: (data: any) => client.post<PaymentRun>("/v1/financial/payment-runs", { company_id: COMPANY_ID, ...data }),
      execute: (id: string) => client.post<{ pending_approval: boolean; request_id?: string; id?: string; estado?: string; monto: number }>(`/v1/financial/payment-runs/${id}/execute`),
    },
    payableInvoices: (params?: { supplier_id?: string; hasta?: string }) =>
      client.get<any[]>("/v1/financial/ap/payable-invoices", { company_id: COMPANY_ID, ...params } as any),
    dashboard: () => client.get<FinancialDashboard>("/v1/financial/financial-dashboard", { company_id: COMPANY_ID } as any),
    ratios: () => client.get<FinancialRatios>("/v1/financial/ratios", { company_id: COMPANY_ID } as any),
  },
  cheques: {
    list: (params?: { estado?: string; supplier_id?: string; vencidos?: boolean; fecha_desde?: string; fecha_hasta?: string }) => client.get<any[]>("/v1/cheques", params as any),
    dashboard: () => client.get<any>("/v1/cheques/dashboard"),
    create: (data: any) => client.post<any>("/v1/cheques", data),
    updateEstado: (id: string, data: { estado: string; notas?: string }) => client.patch<any>(`/v1/cheques/${id}/estado`, data),
    historial: (id: string) => client.get<any[]>(`/v1/cheques/${id}/historial`),
    downloadExcel: (params?: { estado?: string; fecha_desde?: string; fecha_hasta?: string }) => downloadAuthenticated("/v1/cheques/export/excel", params as any, "cheques.xlsx"),
    downloadPdf: (params?: { estado?: string; fecha_desde?: string; fecha_hasta?: string }) => downloadAuthenticated("/v1/cheques/export/pdf", params as any, "cheques.pdf"),
  },
  gerencial: {
    dashboard: (params?: { desde?: string; hasta?: string }) => client.get<GerencialDashboard>("/v1/gerencial/dashboard", params as any),
    deptos: (params?: { desde?: string; hasta?: string }) => client.get<GerencialDeptoPyl[]>("/v1/gerencial/deptos", params as any),
    ranking: (params?: { desde?: string; hasta?: string; limit?: number }) => client.get<GerencialProductoRanking[]>("/v1/gerencial/ranking", params as any),
    alertasNegocio: (margenUmbral?: number) => client.get<GerencialAlertasNegocio>("/v1/gerencial/alertas-negocio", margenUmbral ? { margen_umbral: margenUmbral } : undefined),
    exportExcel: async (reportType: string, params?: { desde?: string; hasta?: string }) => {
      await downloadAuthenticated(`/v1/gerencial/export/${reportType}`, params as any, `${reportType}.xlsx`)
    },
    exportPnlPdf: async (params?: { desde?: string; hasta?: string }) => {
      await downloadAuthenticated("/v1/gerencial/export/pnl.pdf", params as any, "estado_resultados.pdf")
    },
  },
  scales: {
    configs: {
      list: () => client.get<ScaleConfig[]>("/v1/scales/configs"),
      get: (id: string) => client.get<ScaleConfig>(`/v1/scales/configs/${id}`),
      create: (data: any) => client.post<ScaleConfig>("/v1/scales/configs", data),
      update: (id: string, data: any) => client.put<ScaleConfig>(`/v1/scales/configs/${id}`, data),
      delete: (id: string) => client.delete<void>(`/v1/scales/configs/${id}`),
    },
    readWeight: (id: string) => client.post<ScaleWeightResult>(`/v1/scales/${id}/weight`),
    tare: (id: string) => client.post<any>(`/v1/scales/${id}/tare`),
    zero: (id: string) => client.post<any>(`/v1/scales/${id}/zero`),
    test: (id: string) => client.post<ConnectionTestResult>(`/v1/scales/${id}/test`),
    detectProtocol: (data: ProtocolDetectInput) => client.post<any>("/v1/scales/detect-protocol", data),
    syncPLU: (id: string, data: ScalePLUSyncInput) => client.post<ScalePLUSyncResult>(`/v1/scales/${id}/plu-sync`, data),
    pluSyncs: (id: string, params?: { limit?: number; offset?: number }) => client.get<any[]>(`/v1/scales/${id}/plu-syncs`, params as any),
    weightLogs: (params?: { scale_id?: string; limit?: number; offset?: number }) => client.get<any[]>("/v1/scales/-/weight-logs", { ...params }),
    printLabel: (data: PrintLabelInput) => client.post<any>("/v1/scales/print-label", data),
    weighProduct: (scaleId: string, data: { producto_id: string; precio_unitario?: number }) =>
      client.post<{ escala_id: string; escala_nombre: string; peso_kg: number; unidad: string; estable: boolean; producto_id: string; producto_nombre: string; precio_unitario: number; subtotal: number }>(`/v1/scales/${scaleId}/weigh-product`, data),
    labelTemplates: {
      list: () => client.get<ScaleLabelTemplate[]>("/v1/scales/label-templates"),
      create: (data: any) => client.post<ScaleLabelTemplate>("/v1/scales/label-templates", data),
      delete: (id: string) => client.delete<void>(`/v1/scales/label-templates/${id}`),
    },
  },
  mobile: {
    dashboard: () => client.get<MobileDashboard>("/v1/mobile/dashboard"),
    inventoryCount: (data: InventoryCountInput) => client.post<InventoryCountResult>("/v1/mobile/inventory-count", data),
    receiveRemit: (data: ReceiveRemitInput) => client.post<ReceiveRemitResult>("/v1/mobile/receive-remit", data),
    approveSuggestions: (data: ApproveSuggestionInput) => client.post<{ aprobadas: number; total: number }>("/v1/mobile/approve-suggestions", data),
  },
  ecommerce: {
    triggerSync: (tipo: string) => client.post<EcommerceSyncResult>(`/v1/ecommerce/sync/${tipo}`),
    syncLogs: () => client.get<EcommerceSyncLog[]>("/v1/ecommerce/sync-logs"),
    catalog: () => client.get<{ generated_at: string; company_id: string; categories: any[]; products: any[] }>("/v1/ecommerce/catalog"),
  },
  fiscal: {
    config: {
      get: (companyId: string) => client.get<FiscalConfig | null>(`/v1/fiscal/config/${companyId}`),
      upsert: (companyId: string, data: any) => client.put<FiscalConfig>(`/v1/fiscal/config/${companyId}`, data),
    },
    status: (companyId: string) => client.get<{
      modo_emision: string
      punto_emision_default: string | null
      puntos_emision: { punto_emision: string; establecimiento: string; tipo_documento: string; numero_actual: number; numero_final: number; disponibles: number; timbrado_numero: string; timbrado_fecha_fin: string; timbrado_vencido: boolean }[]
    }>(`/v1/fiscal/status/${companyId}`),
    timbrados: {
      list: (companyId: string, tipo_comprobante?: string) => client.get<any[]>(`/v1/fiscal/timbrados/${companyId}`, { tipo_comprobante } as any),
      create: (data: any) => client.post<any>("/v1/fiscal/timbrados", data),
      usage: (timbradoId: string) => client.get<TimbradoUsage[]>(`/v1/fiscal/timbrados/${timbradoId}/usage`),
    },
    notas: {
      list: (companyId: string, params?: { tipo?: string; sale_id?: string; limit?: number; offset?: number }) => client.get<NotaCreditoDebito[]>(`/v1/fiscal/notas/${companyId}`, params as any),
      create: (data: { sale_id: string; tipo: string; motivo: string; total?: number }) => client.post<NotaCreditoDebito>("/v1/fiscal/notas", data),
      emitir: (notaId: string) => client.post<NotaCreditoDebito>(`/v1/fiscal/notas/${notaId}/emitir`),
    },
    secuencias: {
      list: (companyId?: string) => client.get<any[]>(`/v1/fiscal/secuencias`, { company_id: companyId || COMPANY_ID }),
      create: (data: any) => client.post<any>("/v1/fiscal/secuencias", { company_id: COMPANY_ID, ...data }),
      update: (id: string, data: any) => client.put<any>(`/v1/fiscal/secuencias/${id}`, data),
      delete: (id: string) => client.delete<void>(`/v1/fiscal/secuencias/${id}`),
    },
  },
  distribuidora: {
    dashboard: (companyId: string) => client.get<DistribuidoraDashboard>(`/v1/distribuidora/dashboard/${companyId}`),
    containers: {
      list: (companyId: string, estado?: string) => client.get<ImportContainer[]>(`/v1/distribuidora/containers/${companyId}`, { estado } as any),
      get: (id: string) => client.get<ImportContainer>(`/v1/distribuidora/containers/detail/${id}`),
      create: (companyId: string, data: any) => client.post<ImportContainer>(`/v1/distribuidora/containers/${companyId}`, data),
      update: (id: string, data: any) => client.put<ImportContainer>(`/v1/distribuidora/containers/${id}`, data),
      calculateLanded: (id: string) => client.post<any[]>(`/v1/distribuidora/containers/${id}/calculate-landed`),
      addItem: (containerId: string, data: any) => client.post<any>(`/v1/distribuidora/containers/${containerId}/items`, data),
      removeItem: (itemId: string) => client.delete(`/v1/distribuidora/containers/items/${itemId}`),
    },
    customerAgreements: {
      list: (companyId: string, params?: { customer_id?: string; estado?: string }) => client.get<CustomerAgreement[]>(`/v1/distribuidora/customer-agreements/${companyId}`, params as any),
      get: (id: string) => client.get<CustomerAgreement>(`/v1/distribuidora/customer-agreements/detail/${id}`),
      create: (companyId: string, data: any) => client.post<CustomerAgreement>(`/v1/distribuidora/customer-agreements/${companyId}`, data),
      update: (id: string, data: any) => client.put<CustomerAgreement>(`/v1/distribuidora/customer-agreements/${id}`, data),
    },
    routes: {
      list: (companyId: string, user_id?: string) => client.get<SalesRoute[]>(`/v1/distribuidora/routes/${companyId}`, { user_id } as any),
      get: (id: string) => client.get<SalesRoute>(`/v1/distribuidora/routes/detail/${id}`),
      create: (companyId: string, data: any) => client.post<SalesRoute>(`/v1/distribuidora/routes/${companyId}`, data),
      customers: {
        list: (routeId: string) => client.get<any[]>(`/v1/distribuidora/routes/${routeId}/customers`),
        add: (routeId: string, data: any) => client.post<any>(`/v1/distribuidora/routes/${routeId}/customers`, data),
        remove: (rcId: string) => client.delete(`/v1/distribuidora/routes/customers/${rcId}`),
      },
    },
    visits: {
      list: (companyId: string, params?: { route_id?: string; fecha?: string }) => client.get<RouteVisit[]>(`/v1/distribuidora/visits/${companyId}`, params as any),
      create: (routeId: string, data: any) => client.post<RouteVisit>(`/v1/distribuidora/routes/${routeId}/visits`, data),
      complete: (visitId: string, data: any) => client.post<RouteVisit>(`/v1/distribuidora/visits/${visitId}/complete`, data),
    },
    credit: {
      get: (companyId: string, customerId: string) => client.get<CustomerCreditLimit>(`/v1/distribuidora/credit/${companyId}/${customerId}`),
      update: (companyId: string, customerId: string, data: any) => client.put<CustomerCreditLimit>(`/v1/distribuidora/credit/${companyId}/${customerId}`, data),
      authorizations: {
        list: (companyId: string, customer_id?: string) => client.get<CreditAuthorization[]>(`/v1/distribuidora/credit-authorizations/${companyId}`, { customer_id } as any),
        create: (companyId: string, data: any) => client.post<CreditAuthorization>(`/v1/distribuidora/credit-authorizations/${companyId}`, data),
        approve: (authId: string, monto: number, userId: string) => client.post<CreditAuthorization>(`/v1/distribuidora/credit-authorizations/${authId}/approve?monto=${monto}&user_id=${userId}`),
        reject: (authId: string) => client.post<CreditAuthorization>(`/v1/distribuidora/credit-authorizations/${authId}/reject`),
      },
    },
    tracking: {
      sellers: {
        list: (companyId: string) => client.get<any[]>(`/v1/distribuidora/sellers/${companyId}`),
        get: (id: string) => client.get<any>(`/v1/distribuidora/sellers/detail/${id}`),
        create: (companyId: string, data: any) => client.post<any>(`/v1/distribuidora/sellers/${companyId}`, data),
        update: (id: string, data: any) => client.put<any>(`/v1/distribuidora/sellers/${id}`, data),
      },
      tracking: {
        ping: (sellerId: string, data: any) => client.post<any>(`/v1/distribuidora/tracking/${sellerId}/ping`, data),
        trail: (sellerId: string, limit?: number) => client.get<any[]>(`/v1/distribuidora/tracking/${sellerId}/trail`, { limit } as any),
      },
      routeInstances: {
        list: (companyId: string, params?: { seller_id?: string; fecha?: string }) => client.get<any[]>(`/v1/distribuidora/route-instances/${companyId}`, params as any),
        get: (id: string) => client.get<any>(`/v1/distribuidora/route-instances/detail/${id}`),
        create: (companyId: string, data: any) => client.post<any>(`/v1/distribuidora/route-instances/${companyId}`, data),
        start: (id: string) => client.post<any>(`/v1/distribuidora/route-instances/${id}/start`),
        end: (id: string) => client.post<any>(`/v1/distribuidora/route-instances/${id}/end`),
        stops: {
          list: (instanceId: string) => client.get<any[]>(`/v1/distribuidora/route-stops/${instanceId}`),
          create: (instanceId: string, data: any) => client.post<any>(`/v1/distribuidora/route-stops/${instanceId}`, data),
          complete: (stopId: string, data: any) => client.post<any>(`/v1/distribuidora/route-stops/${stopId}/complete`, data),
        },
      },
      geofence: {
        zones: {
          list: (companyId: string) => client.get<any[]>(`/v1/distribuidora/geofence-zones/${companyId}`),
          get: (id: string) => client.get<any>(`/v1/distribuidora/geofence-zones/detail/${id}`),
          create: (companyId: string, data: any) => client.post<any>(`/v1/distribuidora/geofence-zones/${companyId}`, data),
          update: (id: string, data: any) => client.put<any>(`/v1/distribuidora/geofence-zones/${id}`, data),
          delete: (id: string) => client.delete(`/v1/distribuidora/geofence-zones/${id}`),
        },
        alerts: {
          list: (companyId: string, status?: string) => client.get<any[]>(`/v1/distribuidora/geofence-alerts/${companyId}`, { status } as any),
          acknowledge: (alertId: string, data: any) => client.post<any>(`/v1/distribuidora/geofence-alerts/${alertId}/acknowledge`, data),
          resolve: (alertId: string) => client.post<any>(`/v1/distribuidora/geofence-alerts/${alertId}/resolve`),
        },
      },
      performance: {
        calculate: (sellerId: string, periodType?: string) => client.post<any>(`/v1/distribuidora/performance/${sellerId}/calculate?period_type=${periodType || 'monthly'}`),
        history: (sellerId: string, periodType?: string, limit?: number) => client.get<any[]>(`/v1/distribuidora/performance/${sellerId}/history`, { period_type: periodType, limit } as any),
        ranking: (companyId: string, periodType?: string) => client.get<any[]>(`/v1/distribuidora/performance/ranking/${companyId}`, { period_type: periodType } as any),
      },
      liveMap: (companyId: string) => client.get<any>(`/v1/distribuidora/live-map/${companyId}`),
    },
  },
  intellizapp: {
    listCampaigns: (params?: { status?: string }) => client.get<IntelliZappCampaign[]>("/v1/intellizapp/campaigns", params),
    createCampaign: (data: Partial<IntelliZappCampaign>) => client.post<IntelliZappCampaign>("/v1/intellizapp/campaigns", data),
    getCampaign: (id: string) => client.get<IntelliZappCampaign>(`/v1/intellizapp/campaigns/${id}`),
    updateCampaign: (id: string, data: Partial<IntelliZappCampaign>) => client.put<IntelliZappCampaign>(`/v1/intellizapp/campaigns/${id}`, data),
    deleteCampaign: (id: string) => client.delete<void>(`/v1/intellizapp/campaigns/${id}`),
    launchCampaign: (id: string) => client.post<{ status: string; total_recipients: number }>(`/v1/intellizapp/campaigns/${id}/launch`),
    sendBatch: (id: string, batchSize?: number) => {
      let url = `/v1/intellizapp/campaigns/${id}/send-batch`
      if (batchSize) url += `?batch_size=${batchSize}`
      return client.post<{ sent: number; failed: number; remaining: number }>(url)
    },
    listRecipients: (id: string, params?: { status?: string; limit?: number }) => client.get<IntelliZappCampaignRecipient[]>(`/v1/intellizapp/campaigns/${id}/recipients`, params),
    listRules: (activeOnly?: boolean) => client.get<IntelliZappAutomationRule[]>("/v1/intellizapp/automation-rules", { active_only: activeOnly?.toString() }),
    createRule: (data: Partial<IntelliZappAutomationRule>) => client.post<IntelliZappAutomationRule>("/v1/intellizapp/automation-rules", data),
    getRule: (id: string) => client.get<IntelliZappAutomationRule>(`/v1/intellizapp/automation-rules/${id}`),
    updateRule: (id: string, data: Partial<IntelliZappAutomationRule>) => client.put<IntelliZappAutomationRule>(`/v1/intellizapp/automation-rules/${id}`, data),
    deleteRule: (id: string) => client.delete<void>(`/v1/intellizapp/automation-rules/${id}`),
    getAnalytics: () => client.get<IntelliZappAnalytics>("/v1/intellizapp/analytics"),
    triggerAutomation: (data: { event: string; customer_id: string; customer_phone: string; customer_name?: string; context?: any }) => client.post<{ triggered_rules: number; messages_sent: number }>("/v1/intellizapp/trigger", data),
    chatbotTest: (data: { message: string; conversation_id?: string; reset?: boolean }) => client.post<ChatbotTestResponse>("/v1/intellizapp/chatbot/test", data),
  },
  migration: {
    preview: (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      return request<MigrationPreview>("/v1/migration/preview", { method: "POST", body: formData })
    },
    import: (file: File, tipo: string, column_mapping: Record<string, string>, skip_header = true) => {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("tipo", tipo)
      formData.append("column_mapping", JSON.stringify(column_mapping))
      formData.append("skip_header", String(skip_header))
      return request<MigrationImportResult>("/v1/migration/import", { method: "POST", body: formData })
    },
    logs: () => client.get<MigrationLog[]>("/v1/migration/logs"),
  },
  fixedAssets: {
    list: (estado?: string) => client.get<{ id: string; nombre: string; categoria: string | null; fecha_adquisicion: string; valor_adquisicion: number; valor_residual: number; vida_util_meses: number; meses_depreciados: number; depreciacion_acumulada: number; valor_libros: number; estado: string; fecha_baja: string | null; motivo_baja: string | null; created_at: string }[]>("/v1/fixed-assets", estado ? { estado } : undefined),
    create: (data: { nombre: string; categoria?: string; fecha_adquisicion: string; valor_adquisicion: number; valor_residual?: number; vida_util_meses: number }) =>
      client.post<any>("/v1/fixed-assets", data),
    retire: (id: string, motivo: string, fecha_baja?: string) => client.post<any>(`/v1/fixed-assets/${id}/retire`, { motivo, fecha_baja }),
    postDepreciation: (periodo: string) => client.post<{ periodo: string; posteados: number; omitidos: number; total_activos: number }>(`/v1/fixed-assets/post-depreciation?periodo=${periodo}`),
  },
  integratedFinance: {
    getDashboard: (companyId: string) => client.get<any>(`/v1/integrated-finance/dashboard`, { company_id: companyId }),
    // Withholding
    listWithholdingConfigs: (companyId: string, tipo?: string) => client.get<any[]>("/v1/integrated-finance/withholding/configs", { company_id: companyId, tipo }),
    createWithholdingConfig: (data: any) => client.post<any>("/v1/integrated-finance/withholding/configs", data),
    updateWithholdingConfig: (id: string, data: any) => client.put<any>(`/v1/integrated-finance/withholding/configs/${id}`, data),
    getWithholdingDashboard: (companyId: string) => client.get<any>("/v1/integrated-finance/withholding/dashboard", { company_id: companyId }),
    listWithholdingDocuments: (companyId: string, params?: any) => client.get<any[]>("/v1/integrated-finance/withholding/documents", { company_id: companyId, ...params }),
    createWithholdingDocument: (data: any) => client.post<any>("/v1/integrated-finance/withholding/documents", data),
    approveWithholdingDocument: (id: string) => client.post<any>(`/v1/integrated-finance/withholding/documents/${id}/approve`),
    // Accounting
    listAccountPlan: (companyId: string) => client.get<any[]>("/v1/integrated-finance/account-plan", { company_id: companyId }),
    createAccountPlan: (data: any) => client.post<any>("/v1/integrated-finance/account-plan", data),
    listAccountingPeriods: (companyId: string) => client.get<any[]>("/v1/integrated-finance/accounting/periods", { company_id: companyId }),
    openAccountingPeriod: (data: any) => client.post<any>("/v1/integrated-finance/accounting/periods", data),
    closeAccountingPeriod: (id: string) => client.post<any>(`/v1/integrated-finance/accounting/periods/${id}/close`),
    reopenAccountingPeriod: (id: string, motivo: string) => client.post<any>(`/v1/integrated-finance/accounting/periods/${id}/reopen`, { motivo }),
    listAccountingEntries: (companyId: string, periodId: string) => client.get<any[]>("/v1/integrated-finance/accounting/entries", { company_id: companyId, period_id: periodId }),
    postAccountingEntry: (data: any) => client.post<any>("/v1/integrated-finance/accounting/entries", data),
    createManualEntry: (companyId: string, data: { fecha: string; concepto: string; lines: { account_id: string; tipo: string; monto: number; concepto?: string }[] }) =>
      client.post<{ asiento_numero: string; fecha: string; concepto: string; total_debe: number; total_haber: number; lines: any[] }>(`/v1/integrated-finance/accounting/entries/manual?company_id=${companyId}`, data),
    reverseAccountingEntry: (companyId: string, asientoNumero: string, motivo: string) =>
      client.post<{ asiento_numero_original: string; asiento_numero_reversa: string; fecha: string; motivo: string; lines: any[] }>(`/v1/integrated-finance/accounting/entries/${asientoNumero}/reverse?company_id=${companyId}`, { motivo }),
    getTrialBalance: (companyId: string, periodId: string) => client.get<any>("/v1/integrated-finance/accounting/trial-balance", { company_id: companyId, period_id: periodId }),
    getPnl: (companyId: string, periodId: string) => client.get<any>("/v1/integrated-finance/accounting/pnl", { company_id: companyId, period_id: periodId }),
    // Collections
    listCollectionActions: (companyId: string, customerId?: string) => client.get<any[]>("/v1/integrated-finance/collection", { company_id: companyId, customer_id: customerId }),
    createCollectionAction: (data: any) => client.post<any>("/v1/integrated-finance/collection", data),
    getCollectionDashboard: (companyId: string) => client.get<any>("/v1/integrated-finance/collection/dashboard", { company_id: companyId }),
    // Scoring
    listCustomerScores: (companyId: string, minScore?: number) => client.get<any[]>("/v1/integrated-finance/scoring", { company_id: companyId, min_score: minScore }),
    getCustomerScore: (companyId: string, customerId: string) => client.get<any>("/v1/integrated-finance/scoring", { company_id: companyId, customer_id: customerId }),
    recalculateScore: (companyId: string, customerId: string) => client.post<any>(`/v1/integrated-finance/scoring/${customerId}/recalculate?company_id=${companyId}`),
    recalculateAllScores: (companyId: string) => client.post<{ clientes_recalculados: number }>(`/v1/integrated-finance/scoring/recalculate-all?company_id=${companyId}`),
    // EBITDA
    getEbitda: (companyId: string, periodo?: string) => client.get<any>("/v1/integrated-finance/ebitda", { company_id: companyId, periodo }),
    // Auto Reconciliation
    autoReconcile: (companyId: string, bankAccountId: string) => client.post<any>("/v1/integrated-finance/reconciliation/auto", { company_id: companyId, bank_account_id: bankAccountId }),
    getCashReconciliation: (companyId: string) => client.get<any>("/v1/integrated-finance/reconciliation/cash", { company_id: companyId }),
    getPnlReconciliation: (companyId: string, periodId: string) => client.get<any>("/v1/integrated-finance/reconciliation/pnl", { company_id: companyId, period_id: periodId }),
  },

  // ===== Smart Pricing =====
  smartPricing: {
    getDashboard: (companyId: string) => client.get<any>("/v1/smart-pricing/dashboard", { company_id: companyId }),

    listAssignments: (companyId: string, priceListId?: string) => client.get<any[]>("/v1/smart-pricing/assignments", { company_id: companyId, price_list_id: priceListId }),
    createAssignment: (data: any) => client.post<any>("/v1/smart-pricing/assignments", data),
    deleteAssignment: (id: string) => client.delete<any>(`/v1/smart-pricing/assignments/${id}`),

    listTieredPrices: (companyId: string, productId?: string, priceListId?: string) => client.get<any[]>("/v1/smart-pricing/tiered-prices", { company_id: companyId, product_id: productId, price_list_id: priceListId }),
    createTieredPrice: (data: any) => client.post<any>("/v1/smart-pricing/tiered-prices", data),
    updateTieredPrice: (id: string, data: any) => client.patch<any>(`/v1/smart-pricing/tiered-prices/${id}`, data),
    deleteTieredPrice: (id: string) => client.delete<any>(`/v1/smart-pricing/tiered-prices/${id}`),
    calculateTieredPrice: (productId: string, quantity: number, priceListId?: string) => client.get<any>("/v1/smart-pricing/tiered-prices/calculate", { product_id: productId, quantity, price_list_id: priceListId }),

    listPromotions: (companyId: string, activo?: boolean) => client.get<any[]>("/v1/smart-pricing/promotions", { company_id: companyId, activo }),
    createPromotion: (data: any) => client.post<any>("/v1/smart-pricing/promotions", data),
    getPromotion: (id: string) => client.get<any>(`/v1/smart-pricing/promotions/${id}`),
    updatePromotion: (id: string, data: any) => client.patch<any>(`/v1/smart-pricing/promotions/${id}`, data),
    deletePromotion: (id: string) => client.delete<any>(`/v1/smart-pricing/promotions/${id}`),

    listSuggestions: (companyId: string, estado?: string) => client.get<any[]>("/v1/smart-pricing/suggestions", { company_id: companyId, estado }),
    createSuggestion: (data: any) => client.post<any>("/v1/smart-pricing/suggestions", data),
    reviewSuggestion: (id: string, data: any) => client.patch<any>(`/v1/smart-pricing/suggestions/${id}`, data),
    generateDynamicPrice: (data: any) => client.post<any>("/v1/smart-pricing/suggestions/dynamic-price", data),

    listChangeRequests: (companyId: string, status?: string) => client.get<any[]>("/v1/smart-pricing/change-requests", { company_id: companyId, status }),
    createChangeRequest: (data: any) => client.post<any>("/v1/smart-pricing/change-requests", data),
    reviewChangeRequest: (id: string, data: any) => client.post<any>(`/v1/smart-pricing/change-requests/${id}/review`, data),

    listPriceHistory: (companyId: string, productId?: string, limit?: number) => client.get<any[]>("/v1/smart-pricing/history", { company_id: companyId, product_id: productId, limit }),
  },

  // ===== Demand Forecast =====
  demandForecast: {
    getDashboard: (companyId: string) => client.get<any>("/v1/demand-forecast/dashboard", { company_id: companyId }),

    getPredictionsSummary: (companyId: string) => client.get<any>("/v1/demand-forecast/predictions/summary", { company_id: companyId }),

    generateForecast: (data: any) => client.post<any>("/v1/demand-forecast/generate", data),
    listPredictions: (companyId: string, params?: any) => client.get<any[]>("/v1/demand-forecast/predictions", { company_id: companyId, ...params }),

    createOverride: (data: any) => client.post<any>("/v1/demand-forecast/overrides", data),
    listOverrides: (companyId: string, productId?: string) => client.get<any[]>("/v1/demand-forecast/overrides", { company_id: companyId, product_id: productId }),

    detectAnomalies: (companyId: string) => client.post<any>("/v1/demand-forecast/anomalies/detect", { company_id: companyId }),
    listAnomalies: (companyId: string, severity?: string, tipo?: string) => client.get<any[]>("/v1/demand-forecast/anomalies", { company_id: companyId, severity, tipo }),
    reviewAnomaly: (id: string, data: any) => client.patch<any>(`/v1/demand-forecast/anomalies/${id}`, data),

    generatePurchaseSuggestions: (companyId: string) => client.post<any>("/v1/demand-forecast/purchase-suggestions/generate", { company_id: companyId }),
    listPurchaseSuggestions: (companyId: string, status?: string, limit?: number) => client.get<any[]>("/v1/demand-forecast/purchase-suggestions", { company_id: companyId, status, limit }),
    updatePurchaseSuggestion: (id: string, data: any) => client.patch<any>(`/v1/demand-forecast/purchase-suggestions/${id}`, data),

    recordAccuracy: (companyId: string) => client.post<any>("/v1/demand-forecast/accuracy/record", { company_id: companyId }),
    getAccuracySummary: (companyId: string) => client.get<any>("/v1/demand-forecast/accuracy/summary", { company_id: companyId }),
  },

  // ===== Intelligent Routing =====
  intelligentRouting: {
    getDashboard: (companyId: string) => client.get<any>("/v1/intelligent-routing/efficiency", { company_id: companyId }),

    optimizeTsp: (data: any) => client.post<any>("/v1/intelligent-routing/tsp/optimize", data),

    getLoadConfig: (companyId: string, vehicleId: string) => client.get<any>(`/v1/intelligent-routing/load/config/${vehicleId}`, { company_id: companyId }),
    optimizeLoad: (data: any) => client.post<any>("/v1/intelligent-routing/load/optimize", data),

    reroute: (data: any) => client.post<any>("/v1/intelligent-routing/reroute", data),

    predictEta: (data: any) => client.post<any>("/v1/intelligent-routing/eta/predict", data),
  },

  // ===== Credit Scoring =====
  creditScoring: {
    getSummary: (companyId: string) => client.get<any>("/v1/credit-scoring/summary", { company_id: companyId }),

    evaluate: (companyId: string, customerId: string) => client.post<any>(`/v1/credit-scoring/evaluate/${customerId}`, { company_id: companyId }),
    bulkEvaluate: (companyId: string) => client.post<any>("/v1/credit-scoring/evaluate-bulk", { company_id: companyId }),

    getScore: (companyId: string, customerId: string) => client.get<any>(`/v1/credit-scoring/scores/${customerId}`, { company_id: companyId }),
    listScores: (companyId: string, riskLevel?: string, status?: string) => client.get<any[]>("/v1/credit-scoring/scores", { company_id: companyId, risk_level: riskLevel, status }),

    listAlerts: (companyId: string, alertType?: string, severity?: string) => client.get<any[]>("/v1/credit-scoring/alerts", { company_id: companyId, alert_type: alertType, severity }),
    resolveAlert: (companyId: string, alertId: string) => client.post<any>(`/v1/credit-scoring/alerts/${alertId}/resolve`, { company_id: companyId }),
    resolveAlertsBulk: (companyId: string, alertIds: string[]) => client.post<any>("/v1/credit-scoring/alerts/resolve-bulk", { company_id: companyId, alert_ids: alertIds }),

    updateLimit: (companyId: string, data: any) => client.patch<any>("/v1/credit-scoring/limit", { company_id: companyId, ...data }),
    block: (companyId: string, customerId: string, reason: string) => client.post<any>("/v1/credit-scoring/block", { company_id: companyId, customer_id: customerId, reason }),
    unblock: (companyId: string, customerId: string, reason: string) => client.post<any>("/v1/credit-scoring/unblock", { company_id: companyId, customer_id: customerId, reason }),

    listEvents: (companyId: string, customerId?: string, eventType?: string) => client.get<any[]>("/v1/credit-scoring/events", { company_id: companyId, customer_id: customerId, event_type: eventType }),

    getDashboard: (companyId: string) => client.get<any>("/v1/credit-scoring/dashboard", { company_id: companyId }),
  },

  // ===== Oportunidades Comerciales =====
  oportunidades: {
    getDashboard: (companyId: string) => client.get<any>("/v1/comerciales/dashboard", { company_id: companyId }),

    detectAll: (companyId: string) => client.post<any>("/v1/comerciales/detect-all", { company_id: companyId }),
    detect: (companyId: string, type: string) => client.post<any>(`/v1/comerciales/detect-${type}`, { company_id: companyId }),

    list: (companyId: string, opportunityType?: string, status?: string) => client.get<any[]>("/v1/comerciales/opportunities", { company_id: companyId, opportunity_type: opportunityType, status }),
    update: (companyId: string, oppId: string, status: string) => client.patch<any>(`/v1/comerciales/opportunities/${oppId}`, { company_id: companyId, status }),

    getAffinity: (companyId: string, productId: string) => client.get<any[]>("/v1/comerciales/affinity", { company_id: companyId, product_id: productId }),
    computeAffinity: (companyId: string) => client.post<any>("/v1/comerciales/affinity/compute", { company_id: companyId }),
  },

  // ===== IoT Cold Chain =====
  coldChain: {
    getDashboard: (companyId: string) => client.get<any>("/v1/cold-chain/dashboard", { company_id: companyId }),

    listSensors: (companyId: string) => client.get<any[]>("/v1/cold-chain/sensors", { company_id: companyId }),
    createSensor: (companyId: string, data: any) => client.post<any>("/v1/cold-chain/sensors", { company_id: companyId, ...data }),
    updateSensor: (companyId: string, sensorId: string, data: any) => client.patch<any>(`/v1/cold-chain/sensors/${sensorId}`, { company_id: companyId, ...data }),

    getReadings: (companyId: string, sensorId: string, hoursBack?: number) => client.get<any[]>(`/v1/cold-chain/readings/${sensorId}`, { company_id: companyId, hours_back: hoursBack }),

    listAlerts: (companyId: string) => client.get<any[]>("/v1/cold-chain/alerts", { company_id: companyId }),
    resolveAlert: (companyId: string, alertId: string) => client.post<any>(`/v1/cold-chain/alerts/${alertId}/resolve`, { company_id: companyId }),
    notifyWhatsApp: (companyId: string, alertId: string) => client.post<any>(`/v1/cold-chain/alerts/${alertId}/notify-whatsapp`, { company_id: companyId }),

    listCompliance: (companyId: string) => client.get<any[]>("/v1/cold-chain/compliance", { company_id: companyId }),
    startCompliance: (companyId: string, data: any) => client.post<any>("/v1/cold-chain/compliance/start", { company_id: companyId, ...data }),
    closeCompliance: (companyId: string, logId: string) => client.post<any>(`/v1/cold-chain/compliance/${logId}/close`, { company_id: companyId }),
  },

  // ===== Asistente Virtual IA =====
  asistenteVirtual: {
    sendMessage: (companyId: string, data: any) => client.post<any>("/v1/asistente-virtual/message", { company_id: companyId, ...data }),

    listConversations: (companyId: string) => client.get<any[]>("/v1/asistente-virtual/conversations", { company_id: companyId }),
    getMessages: (companyId: string, convId: string) => client.get<any[]>(`/v1/asistente-virtual/conversations/${convId}`, { company_id: companyId }),
    endConversation: (companyId: string, convId: string, resolved: boolean) => client.post<any>(`/v1/asistente-virtual/conversations/${convId}/end`, { company_id: companyId, resolved }),

    listTickets: (companyId: string) => client.get<any[]>("/v1/asistente-virtual/tickets", { company_id: companyId }),
    updateTicket: (companyId: string, ticketId: string, status: string) => client.patch<any>(`/v1/asistente-virtual/tickets/${ticketId}`, { company_id: companyId, status }),

    getTemplates: (companyId: string) => client.get<any[]>("/v1/asistente-virtual/templates", { company_id: companyId }),
    seedTemplates: (companyId: string) => client.post<any>("/v1/asistente-virtual/templates/seed", { company_id: companyId }),

    getDashboard: (companyId: string) => client.get<any>("/v1/asistente-virtual/dashboard", { company_id: companyId }),
  },

  // ===== Clientes — Fidelización & Segmentación =====
  clientes: {
    getDashboard: (companyId: string) => client.get<any>("/v1/clientes/dashboard", { company_id: companyId }),

    evaluateRfm: (companyId: string, customerId: string) => client.post<any>(`/v1/clientes/rfm/evaluate/${customerId}`, { company_id: companyId }),
    bulkEvaluateRfm: (companyId: string) => client.post<any>("/v1/clientes/rfm/evaluate-bulk", { company_id: companyId }),
    listRfmScores: (companyId: string, segment?: string, rfmMin?: number) => client.get<any[]>("/v1/clientes/rfm/scores", { company_id: companyId, segment, rfm_min: rfmMin }),
    getRfmSummary: (companyId: string) => client.get<any>("/v1/clientes/rfm/summary", { company_id: companyId }),

    listSegments: (companyId: string) => client.get<any[]>("/v1/clientes/segments", { company_id: companyId }),
    createSegment: (companyId: string, data: any) => client.post<any>("/v1/clientes/segments", { company_id: companyId, ...data }),
    updateSegment: (companyId: string, segId: string, data: any) => client.put<any>(`/v1/clientes/segments/${segId}`, { company_id: companyId, ...data }),

    getLoyaltyProgram: (companyId: string) => client.get<any>("/v1/clientes/loyalty/program", { company_id: companyId }),
    updateLoyaltyProgram: (companyId: string, data: any) => client.put<any>("/v1/clientes/loyalty/program", { company_id: companyId, ...data }),
    listLoyaltyTransactions: (companyId: string, customerId?: string, tipo?: string) => client.get<any[]>("/v1/clientes/loyalty/transactions", { company_id: companyId, customer_id: customerId, tipo }),
    createLoyaltyTransaction: (companyId: string, data: any) => client.post<any>("/v1/clientes/loyalty/transactions", { company_id: companyId, ...data }),
    getLoyaltySummary: (companyId: string, customerId: string) => client.get<any>(`/v1/clientes/loyalty/summary/${customerId}`, { company_id: companyId }),

    listOffers: (companyId: string, offerType?: string, targetType?: string, activo?: boolean) => client.get<any[]>("/v1/clientes/offers", { company_id: companyId, offer_type: offerType, target_type: targetType, activo }),
    createOffer: (companyId: string, data: any) => client.post<any>("/v1/clientes/offers", { company_id: companyId, ...data }),
    updateOffer: (companyId: string, offerId: string, data: any) => client.put<any>(`/v1/clientes/offers/${offerId}`, { company_id: companyId, ...data }),

    generateCoupons: (companyId: string, data: any) => client.post<any>("/v1/clientes/coupons/generate", { company_id: companyId, ...data }),
    listCoupons: (companyId: string, isActive?: boolean, customerId?: string) => client.get<any[]>("/v1/clientes/coupons", { company_id: companyId, is_active: isActive, customer_id: customerId }),
    validateCoupon: (companyId: string, data: any) => client.post<any>("/v1/clientes/coupons/validate", { company_id: companyId, ...data }),
    redeemCoupon: (companyId: string, code: string) => client.post<any>(`/v1/clientes/coupons/${code}/redeem`, { company_id: companyId }),
  },

  // ===== FASE 1 SUPERMER — Rotisería =====
  rotiseria: {
    recipes: {
      list: (params?: { activa?: boolean }) => client.get<any[]>("/v1/supermer/rotiseria/recipes", params),
      get: (id: string) => client.get<any>(`/v1/supermer/rotiseria/recipes/${id}`),
      create: (data: any) => client.post<any>("/v1/supermer/rotiseria/recipes", data),
      update: (id: string, data: any) => client.put<any>(`/v1/supermer/rotiseria/recipes/${id}`, data),
      delete: (id: string) => client.delete(`/v1/supermer/rotiseria/recipes/${id}`),
    },
    plans: {
      list: (params?: { fecha?: string; estado?: string }) => client.get<any[]>("/v1/supermer/rotiseria/plans", params),
      get: (id: string) => client.get<any>(`/v1/supermer/rotiseria/plans/${id}`),
      create: (data: any) => client.post<any>("/v1/supermer/rotiseria/plans", data),
      update: (id: string, data: any) => client.put<any>(`/v1/supermer/rotiseria/plans/${id}`, data),
      complete: (id: string, data: any) => client.post<any>(`/v1/supermer/rotiseria/plans/${id}/complete`, data),
      tempLogs: {
        list: (planId: string) => client.get<any[]>(`/v1/supermer/rotiseria/plans/${planId}/temp-logs`),
        create: (planId: string, data: any) => client.post<any>(`/v1/supermer/rotiseria/plans/${planId}/temp-log`, data),
      },
      labels: {
        list: (planId: string) => client.get<any[]>(`/v1/supermer/rotiseria/plans/${planId}/labels`),
        generate: (planId: string, data: any[]) => client.post<any[]>(`/v1/supermer/rotiseria/plans/${planId}/labels`, data),
      },
    },
    autoMarkdown: (data?: any) => client.post<any[]>("/v1/supermer/rotiseria/auto-markdown", data || {}),
    dashboard: () => client.get<any>("/v1/supermer/rotiseria/dashboard"),
  },

  // ===== FASE 1 SUPERMER — HACCP =====
  haccp: {
    plans: {
      list: (params?: { activo?: boolean }) => client.get<any[]>("/v1/supermer/haccp/plans", params),
      get: (id: string) => client.get<any>(`/v1/supermer/haccp/plans/${id}`),
      create: (data: any) => client.post<any>("/v1/supermer/haccp/plans", data),
      update: (id: string, data: any) => client.put<any>(`/v1/supermer/haccp/plans/${id}`, data),
    },
    criticalPoints: {
      list: (planId: string) => client.get<any[]>(`/v1/supermer/haccp/plans/${planId}/critical-points`),
      create: (planId: string, data: any) => client.post<any>(`/v1/supermer/haccp/plans/${planId}/critical-points`, data),
      update: (cpId: string, data: any) => client.put<any>(`/v1/supermer/haccp/critical-points/${cpId}`, data),
      delete: (cpId: string) => client.delete(`/v1/supermer/haccp/critical-points/${cpId}`),
    },
    monitoringLogs: {
      list: (cpId: string) => client.get<any[]>(`/v1/supermer/haccp/critical-points/${cpId}/logs`),
      create: (cpId: string, data: any) => client.post<any>(`/v1/supermer/haccp/critical-points/${cpId}/logs`, data),
    },
    correctiveActions: {
      list: (params?: { resuelto?: boolean }) => client.get<any[]>("/v1/supermer/haccp/corrective-actions", params),
      create: (data: any) => client.post<any>("/v1/supermer/haccp/corrective-actions", data),
      resolve: (caId: string) => client.post<any>(`/v1/supermer/haccp/corrective-actions/${caId}/resolve`),
    },
    complianceReport: (periodo?: string) => client.get<any>("/v1/supermer/haccp/compliance-report", { periodo }),
    dashboard: () => client.get<any>("/v1/supermer/haccp/dashboard"),
  },

  // ===== FASE 1 SUPERMER — Auditorías =====
  audits: {
    templates: {
      list: (params?: { area?: string; activo?: boolean }) => client.get<any[]>("/v1/supermer/audit/templates", params),
      get: (id: string) => client.get<any>(`/v1/supermer/audit/templates/${id}`),
      create: (data: any) => client.post<any>("/v1/supermer/audit/templates", data),
      update: (id: string, data: any) => client.put<any>(`/v1/supermer/audit/templates/${id}`, data),
      delete: (id: string) => client.delete(`/v1/supermer/audit/templates/${id}`),
      items: {
        add: (templateId: string, data: any) => client.post<any>(`/v1/supermer/audit/templates/${templateId}/items`, data),
        update: (itemId: string, data: any) => client.put<any>(`/v1/supermer/audit/templates/items/${itemId}`, data),
        delete: (itemId: string) => client.delete(`/v1/supermer/audit/templates/items/${itemId}`),
      },
    },
    executions: {
      list: (params?: { area?: string; fecha?: string; estado?: string }) => client.get<any[]>("/v1/supermer/audit/executions", params),
      get: (id: string) => client.get<any>(`/v1/supermer/audit/executions/${id}`),
      start: (data: any) => client.post<any>("/v1/supermer/audit/executions", data),
      submitAnswers: (executionId: string, data: any[]) => client.post<any>(`/v1/supermer/audit/executions/${executionId}/answers`, data),
      complete: (executionId: string) => client.post<any>(`/v1/supermer/audit/executions/${executionId}/complete`),
    },
    dashboard: () => client.get<any>("/v1/supermer/audit/dashboard"),
  },

  // ===== FASE 1 SUPERMER — Mantenimiento de Equipos =====
  equipment: {
    list: (params?: { categoria?: string; activo?: boolean }) => client.get<any[]>("/v1/supermer/equipment", params),
    get: (id: string) => client.get<any>(`/v1/supermer/equipment/${id}`),
    create: (data: any) => client.post<any>("/v1/supermer/equipment", data),
    update: (id: string, data: any) => client.put<any>(`/v1/supermer/equipment/${id}`, data),
    delete: (id: string) => client.delete(`/v1/supermer/equipment/${id}`),
    schedules: {
      list: (params?: { equipo_id?: string }) => client.get<any[]>("/v1/supermer/equipment/schedules", params),
      create: (data: any) => client.post<any>("/v1/supermer/equipment/schedules", data),
      update: (id: string, data: any) => client.put<any>(`/v1/supermer/equipment/schedules/${id}`, data),
      delete: (id: string) => client.delete(`/v1/supermer/equipment/schedules/${id}`),
    },
    workOrders: {
      list: (params?: { estado?: string; equipo_id?: string }) => client.get<any[]>("/v1/supermer/equipment/work-orders", params),
      get: (id: string) => client.get<any>(`/v1/supermer/equipment/work-orders/${id}`),
      create: (data: any) => client.post<any>("/v1/supermer/equipment/work-orders", data),
      update: (id: string, data: any) => client.put<any>(`/v1/supermer/equipment/work-orders/${id}`, data),
      start: (id: string) => client.post<any>(`/v1/supermer/equipment/work-orders/${id}/start`),
      complete: (id: string, data: any) => client.post<any>(`/v1/supermer/equipment/work-orders/${id}/complete`, data),
    },
    alerts: {
      list: (params?: { resuelta?: boolean }) => client.get<any[]>("/v1/supermer/equipment/alerts", params),
      resolve: (alertId: string) => client.post<any>(`/v1/supermer/equipment/alerts/${alertId}/resolve`),
    },
    checkAlerts: () => client.post<any[]>("/v1/supermer/equipment/check-alerts"),
    dashboard: () => client.get<any>("/v1/supermer/equipment/dashboard"),
  },

  // ===== FASE 2 SUPERMER — DSD Receiving =====
  dsd: {
    schedules: {
      list: (params?: { fecha?: string; proveedor_id?: string }) => client.get<any[]>("/v1/supermer/dsd/schedules", params),
      get: (id: string) => client.get<any>(`/v1/supermer/dsd/schedules/${id}`),
      create: (data: any) => client.post<any>("/v1/supermer/dsd/schedules", data),
      update: (id: string, data: any) => client.put<any>(`/v1/supermer/dsd/schedules/${id}`, data),
    },
    receivings: {
      list: (params?: { fecha?: string; estado?: string }) => client.get<any[]>("/v1/supermer/dsd/receivings", params),
      get: (id: string) => client.get<any>(`/v1/supermer/dsd/receivings/${id}`),
      create: (data: any) => client.post<any>("/v1/supermer/dsd/receivings", data),
      update: (id: string, data: any) => client.put<any>(`/v1/supermer/dsd/receivings/${id}`, data),
      items: {
        list: (receivingId: string) => client.get<any[]>(`/v1/supermer/dsd/receivings/${receivingId}/items`),
        create: (receivingId: string, data: any) => client.post<any>(`/v1/supermer/dsd/receivings/${receivingId}/items`, data),
        batchCreate: (receivingId: string, data: any[]) => client.post<any[]>(`/v1/supermer/dsd/receivings/${receivingId}/items/batch`, data),
      },
      rejections: {
        list: (receivingId: string) => client.get<any[]>(`/v1/supermer/dsd/receivings/${receivingId}/rejections`),
        create: (receivingId: string, data: any) => client.post<any>(`/v1/supermer/dsd/receivings/${receivingId}/rejections`, data),
      },
    },
    dashboard: () => client.get<any>("/v1/supermer/dsd/dashboard"),
  },

  // ===== PORTAL DE PROVEEDORES (ADMIN & AUTOSERVICIO) =====
  supplierPortal: {
    admin: {
      users: {
        list: () => client.get<any[]>("/v1/supplier-portal/admin/users"),
        create: (data: any) => client.post<any>("/v1/supplier-portal/admin/users", data),
        toggle: (userId: string) => client.put<any>(`/v1/supplier-portal/admin/users/${userId}/toggle`, {}),
      },
      documents: {
        list: (params?: { tipo?: string }) => client.get<any[]>("/v1/supplier-portal/admin/documents", params),
      },
    },
  },

  // ===== FASE 2 SUPERMER — Auto Replenishment =====
  replenishment: {
    rules: {
      list: (params?: { activa?: boolean; producto_id?: string }) => client.get<any[]>("/v1/supermer/replenishment/rules", params),
      get: (id: string) => client.get<any>(`/v1/supermer/replenishment/rules/${id}`),
      create: (data: any) => client.post<any>("/v1/supermer/replenishment/rules", data),
      update: (id: string, data: any) => client.put<any>(`/v1/supermer/replenishment/rules/${id}`, data),
    },
    suggestions: {
      list: (params?: { estado?: string }) => client.get<any[]>("/v1/supermer/replenishment/suggestions", params),
      review: (id: string, data: any) => client.post<any>(`/v1/supermer/replenishment/suggestions/${id}/review`, data),
    },
    generate: (data?: any) => client.post<any[]>("/v1/supermer/replenishment/generate", data || {}),
    crossdock: {
      list: (params?: { fecha?: string; estado?: string }) => client.get<any[]>("/v1/supermer/crossdock/orders", params),
      create: (data: any) => client.post<any>("/v1/supermer/crossdock/orders", data),
      complete: (id: string) => client.post<any>(`/v1/supermer/crossdock/orders/${id}/complete`),
    },
    dashboard: () => client.get<any>("/v1/supermer/replenishment/dashboard"),
  },

  // ===== FASE 2 SUPERMER — Supplier Returns =====
  supplierReturns: {
    list: (params?: { estado?: string; proveedor_id?: string }) => client.get<any[]>("/v1/supermer/returns", params),
    get: (id: string) => client.get<any>(`/v1/supermer/returns/${id}`),
    create: (data: any) => client.post<any>("/v1/supermer/returns", data),
    update: (id: string, data: any) => client.put<any>(`/v1/supermer/returns/${id}`, data),
    authorize: (id: string) => client.post<any>(`/v1/supermer/returns/${id}/authorize`),
    complete: (id: string) => client.post<any>(`/v1/supermer/returns/${id}/complete`),
    items: {
      create: (returnId: string, data: any) => client.post<any>(`/v1/supermer/returns/${returnId}/items`, data),
    },
    authorizations: {
      list: (returnId: string) => client.get<any[]>(`/v1/supermer/returns/${returnId}/authorizations`),
      create: (returnId: string, data: any) => client.post<any>(`/v1/supermer/returns/${returnId}/authorizations`, data),
    },
    dashboard: () => client.get<any>("/v1/supermer/returns/dashboard"),
  },

  // ===== FASE 2 SUPERMER — Backhaul =====
  backhaul: {
    list: (params?: { estado?: string }) => client.get<any[]>("/v1/supermer/backhauls", params),
    get: (id: string) => client.get<any>(`/v1/supermer/backhauls/${id}`),
    create: (data: any) => client.post<any>("/v1/supermer/backhauls", data),
    update: (id: string, data: any) => client.put<any>(`/v1/supermer/backhauls/${id}`, data),
  },

  // ===== FASE 3 SUPERMER — Pricing Multicanal =====
  pricing: {
    zones: {
      list: (params?: { activa?: boolean }) => client.get<any[]>("/v1/supermer/price-zones", params),
      create: (data: any) => client.post<any>("/v1/supermer/price-zones", data),
      update: (id: string, data: any) => client.put<any>(`/v1/supermer/price-zones/${id}`, data),
    },
    competitorPrices: {
      list: (params?: { producto_id?: string; competidor?: string }) => client.get<any[]>("/v1/supermer/competitor-prices", params),
      create: (data: any) => client.post<any>("/v1/supermer/competitor-prices", data),
      latest: (productoId: string) => client.get<any[]>(`/v1/supermer/competitor-prices/${productoId}/latest`),
    },
    auditLogs: {
      list: (params?: { producto_id?: string; estado?: string }) => client.get<any[]>("/v1/supermer/price-audit-logs", params),
      create: (data: any) => client.post<any>("/v1/supermer/price-audit-logs", data),
      approve: (logId: string) => client.post<any>(`/v1/supermer/price-audit-logs/${logId}/approve`),
    },
    psychologicalRules: {
      list: (params?: { activa?: boolean }) => client.get<any[]>("/v1/supermer/psychological-rules", params),
      create: (data: any) => client.post<any>("/v1/supermer/psychological-rules", data),
      applyToProduct: (productoId: string, ruleId: string) => client.post<any>(`/v1/supermer/psychological-rules/apply/${productoId}?rule_id=${ruleId}`),
    },
    dashboard: () => client.get<any>("/v1/supermer/pricing/dashboard"),
  },

  // ===== FASE 3 SUPERMER — ESL =====
  esl: {
    zones: {
      list: () => client.get<any[]>("/v1/supermer/esl/zones"),
      create: (data: any) => client.post<any>("/v1/supermer/esl/zones", data),
    },
    devices: {
      list: (params?: { zona_id?: string; estado?: string }) => client.get<any[]>("/v1/supermer/esl/devices", params),
      create: (data: any) => client.post<any>("/v1/supermer/esl/devices", data),
      update: (id: string, data: any) => client.put<any>(`/v1/supermer/esl/devices/${id}`, data),
    },
    syncs: {
      create: (data: any) => client.post<any>("/v1/supermer/esl/sync", data),
      confirm: (syncId: string) => client.post<any>(`/v1/supermer/esl/sync/${syncId}/confirm`),
      list: (params?: { estado?: string }) => client.get<any[]>("/v1/supermer/esl/syncs", params),
    },
    dashboard: () => client.get<any>("/v1/supermer/esl/dashboard"),
  },

  // ===== FASE 3 SUPERMER — Promociones =====
  promos: {
    list: (params?: { tipo?: string; estado?: string; desde?: string; hasta?: string }) => client.get<any[]>("/v1/supermer/promos", params),
    create: (data: any) => client.post<any>("/v1/supermer/promos", data),
    update: (id: string, data: any) => client.put<any>(`/v1/supermer/promos/${id}`, data),
    budgets: {
      list: (promoId: string) => client.get<any[]>(`/v1/supermer/promos/${promoId}/budgets`),
      create: (data: any) => client.post<any>("/v1/supermer/promos/budgets", data),
    },
    effectiveness: {
      list: (params?: { promo_id?: string }) => client.get<any[]>("/v1/supermer/promos/effectiveness", params),
      create: (data: any) => client.post<any>("/v1/supermer/promos/effectiveness", data),
    },
    dashboard: () => client.get<any>("/v1/supermer/promos/dashboard"),
  },

  // ===== Customer 360 Analytics =====
  customer360: {
    getDashboard: (companyId: string) => client.get<any>("/v1/customer360/dashboard", { company_id: companyId }),
    getProfile: (customerId: string) => client.get<any>(`/v1/customer360/profile/${customerId}`),
    computeBasket: (companyId: string, customerId: string) => client.post<any>(`/v1/customer360/basket/compute/${customerId}`, { company_id: companyId }),
    getBasket: (companyId: string, customerId: string) => client.get<any>(`/v1/customer360/basket/${customerId}`, { company_id: companyId }),
    computePenetration: (companyId: string, customerId: string) => client.post<any>(`/v1/customer360/penetration/compute/${customerId}`, { company_id: companyId }),
    getPenetration: (companyId: string, customerId: string) => client.get<any[]>(`/v1/customer360/penetration/${customerId}`, { company_id: companyId }),
    predictChurn: (companyId: string, customerId: string) => client.post<any>(`/v1/customer360/churn/predict/${customerId}`, { company_id: companyId }),
    getChurn: (companyId: string, customerId: string) => client.get<any>(`/v1/customer360/churn/${customerId}`, { company_id: companyId }),
    listHighRiskChurn: (companyId: string, minScore?: number, limit?: number) => client.get<any[]>("/v1/customer360/churn/high-risk", { company_id: companyId, min_score: minScore, limit }),
    computeLifecycle: (companyId: string, customerId: string) => client.post<any>(`/v1/customer360/lifecycle/compute/${customerId}`, { company_id: companyId }),
    getLifecycle: (companyId: string, customerId: string) => client.get<any>(`/v1/customer360/lifecycle/${customerId}`, { company_id: companyId }),
    listRecovery: (companyId: string, status?: string, limit?: number) => client.get<any[]>("/v1/customer360/recovery", { company_id: companyId, status, limit }),
    notifyRecovery: (companyId: string, campaignId: string) => client.post<any>(`/v1/customer360/recovery/${campaignId}/notify`, { company_id: companyId }),
    redeemRecovery: (companyId: string, campaignId: string, data: any) => client.post<any>(`/v1/customer360/recovery/${campaignId}/redeem`, { ...data, company_id: companyId }),
    bulkCompute: (companyId: string) => client.post<any>("/v1/customer360/bulk-compute", { company_id: companyId }),
  },

  // ===== Scan&Go =====
  scanandgo: {
    getDashboard: (companyId: string) => client.get<any>("/v1/scanandgo/dashboard", { company_id: companyId }),
    createSession: (data?: any) => client.post<any>("/v1/scanandgo/sessions", data || {}),
    getActiveSession: () => client.get<any>("/v1/scanandgo/sessions/active"),
    getSession: (id: string) => client.get<any>(`/v1/scanandgo/sessions/${id}`),
    listSessions: (params?: { status?: string; limit?: number; offset?: number }) => client.get<any[]>("/v1/scanandgo/sessions", params as any),
    addItem: (data: any) => client.post<any>("/v1/scanandgo/items", data),
    removeItem: (sessionId: string, itemId: string) => client.delete<any>(`/v1/scanandgo/items/${sessionId}/${itemId}`),
    processPayment: (data: any) => client.post<any>("/v1/scanandgo/payments", data),
    listPendingAudits: (limit?: number) => client.get<any[]>("/v1/scanandgo/audits/pending", { limit }),
    getAudit: (id: string) => client.get<any>(`/v1/scanandgo/audits/${id}`),
    checkAudit: (data: any) => client.post<any>("/v1/scanandgo/audits/check", data),
    resolveAudit: (data: any) => client.post<any>("/v1/scanandgo/audits/resolve", data),
    lookupProduct: (barcode: string) => client.get<any>(`/v1/scanandgo/products/lookup/${encodeURIComponent(barcode)}`),
    sendDigitalTicket: (data: any) => client.post<any>("/v1/scanandgo/digital-ticket", data),
  },

  // ===== FASE 3 SUPERMER — Dynamic Markdown =====
  dynamicMarkdown: {
    rules: {
      list: (params?: { activa?: boolean }) => client.get<any[]>("/v1/supermer/dynamic-markdown/rules", params),
      create: (data: any) => client.post<any>("/v1/supermer/dynamic-markdown/rules", data),
      update: (id: string, data: any) => client.put<any>(`/v1/supermer/dynamic-markdown/rules/${id}`, data),
    },
    recommendations: {
      list: (params?: { aplicada?: boolean; solo_urgentes?: boolean }) => client.get<any[]>("/v1/supermer/dynamic-markdown/recommendations", params),
    },
    generate: (data?: any) => client.post<any[]>("/v1/supermer/dynamic-markdown/generate", data || {}),
    apply: (data: any) => client.post<any[]>("/v1/supermer/dynamic-markdown/apply", data),
    dashboard: () => client.get<any>("/v1/supermer/dynamic-markdown/dashboard"),
  },

  // ===== Gestión de Turnos =====
  schedule: {
    listTemplates: (companyId: string, params?: { area?: string; activo?: boolean }) =>
      client.get<any[]>("/v1/schedule/templates", { company_id: companyId, ...params }),
    createTemplate: (data: any) => client.post<any>("/v1/schedule/templates", data),
    updateTemplate: (id: string, data: any) => client.put<any>(`/v1/schedule/templates/${id}`, data),
    listPlans: (companyId: string, params?: { area?: string; fecha?: string; employee_id?: string; status?: string; limit?: number; offset?: number }) =>
      client.get<any[]>("/v1/schedule/plans", { company_id: companyId, ...params }),
    createPlan: (data: any) => client.post<any>("/v1/schedule/plans", data),
    updatePlanStatus: (id: string, status: string) => client.patch<any>(`/v1/schedule/plans/${id}/status`, { status }),
    generateWeekly: (data: any) => client.post<any>("/v1/schedule/plans/generate-weekly", data),
    clockInOut: (data: any) => client.post<any>("/v1/schedule/clock", data),
    getTodayEntries: (companyId: string, employeeId: string) =>
      client.get<any[]>(`/v1/schedule/clock/today/${employeeId}`, { company_id: companyId }),
    listSwaps: (companyId: string, params?: { status?: string; limit?: number }) =>
      client.get<any[]>("/v1/schedule/swaps", { company_id: companyId, ...params }),
    requestSwap: (data: any) => client.post<any>("/v1/schedule/swaps", data),
    approveSwap: (id: string, data: any) => client.post<any>(`/v1/schedule/swaps/${id}/approve`, data),
    getCostConfigs: (companyId: string) => client.get<any[]>("/v1/schedule/cost-configs", { company_id: companyId }),
    updateCostConfig: (id: string, data: any) => client.put<any>(`/v1/schedule/cost-configs/${id}`, data),
    getDashboard: (companyId: string, fecha_desde: string, fecha_hasta: string) =>
      client.get<any>("/v1/schedule/dashboard", { company_id: companyId, fecha_desde, fecha_hasta }),
    getHoursSummary: (companyId: string, fecha_desde: string, fecha_hasta: string) =>
      client.get<any>("/v1/schedule/hours-summary", { company_id: companyId, fecha_desde, fecha_hasta }),
  },

  // ===== Productividad Laboral por Área =====
  productividad: {
    createRecord: (data: any) => client.post<any>("/v1/productividad/records", data),
    listRecords: (companyId: string, params?: { area?: string; employee_id?: string; fecha_desde?: string; fecha_hasta?: string; limit?: number; offset?: number }) =>
      client.get<any[]>("/v1/productividad/records", { company_id: companyId, ...params }),
    setTarget: (data: any) => client.post<any>("/v1/productividad/targets", data),
    listTargets: (companyId: string, params?: { area?: string }) =>
      client.get<any[]>("/v1/productividad/targets", { company_id: companyId, ...params }),
    computeEfficiency: (data: any) => client.post<any>("/v1/productividad/efficiency/compute", data),
    computeAllEfficiencies: (data: any) => client.post<any[]>("/v1/productividad/efficiency/compute-all", data),
    getRanking: (companyId: string, params?: { area?: string; limit?: number; order_by?: string }) =>
      client.get<any[]>("/v1/productividad/efficiency/ranking", { company_id: companyId, ...params }),
    getAreaMetrics: (companyId: string, fecha_desde: string, fecha_hasta: string) =>
      client.get<any[]>("/v1/productividad/area-metrics", { company_id: companyId, fecha_desde, fecha_hasta }),
    getWeeklyTrends: (companyId: string, weeks?: number) =>
      client.get<any[]>("/v1/productividad/weekly-trends", { company_id: companyId, weeks }),
    getDashboard: (companyId: string, fecha_desde: string, fecha_hasta: string) =>
      client.get<any>("/v1/productividad/dashboard", { company_id: companyId, fecha_desde, fecha_hasta }),
  },

  // ===== Capacitación & Onboarding Digital =====
  capacitacion: {
    ensurePreloaded: () => client.post<any>("/v1/capacitacion/ensure-preloaded"),
    listCourses: (companyId: string, params?: { category?: string; area?: string; position?: string; include_preloaded?: boolean; limit?: number }) =>
      client.get<any[]>("/v1/capacitacion/courses", { company_id: companyId, ...params }),
    getCourse: (companyId: string, courseId: string) =>
      client.get<any>(`/v1/capacitacion/courses/${courseId}`, { company_id: companyId }),
    createCourse: (data: any) => client.post<any>("/v1/capacitacion/courses", data),
    addModule: (courseId: string, data: any) => client.post<any>(`/v1/capacitacion/courses/${courseId}/modules`, data),
    assignCourse: (data: any) => client.post<any>("/v1/capacitacion/assign", data),
    bulkAssign: (data: any) => client.post<any[]>("/v1/capacitacion/bulk-assign", data),
    listAssignments: (companyId: string, params?: { employee_id?: string; course_id?: string; status?: string; limit?: number; offset?: number }) =>
      client.get<any[]>("/v1/capacitacion/assignments", { company_id: companyId, ...params }),
    getProgress: (companyId: string, assignmentId: string) =>
      client.get<any>(`/v1/capacitacion/assignments/${assignmentId}/progress`, { company_id: companyId }),
    updateModuleProgress: (assignmentId: string, moduleId: string, data: any) =>
      client.patch<any>(`/v1/capacitacion/assignments/${assignmentId}/modules/${moduleId}`, data),
    listCertificates: (companyId: string, params?: { employee_id?: string; is_valid?: boolean; limit?: number }) =>
      client.get<any[]>("/v1/capacitacion/certificates", { company_id: companyId, ...params }),
    recertify: (companyId: string, certificateId: string) =>
      client.post<any>(`/v1/capacitacion/certificates/${certificateId}/recertify`, { company_id: companyId }),
    getDashboard: (companyId: string) =>
      client.get<any>("/v1/capacitacion/dashboard", { company_id: companyId }),
  },

  // ===== PyG Diario por Departamento =====
  pygDiario: {
    compute: (data: any) => client.post<any[]>("/v1/pyg-diario/compute", data),
    listEntries: (companyId: string, fecha_desde: string, fecha_hasta: string, department?: string) =>
      client.get<any[]>("/v1/pyg-diario/entries", { company_id: companyId, fecha_desde, fecha_hasta, department }),
    createEntry: (data: any) => client.post<any>("/v1/pyg-diario/entries", data),
    addAdjustment: (data: any) => client.post<any>("/v1/pyg-diario/adjustments", data),
    listAdjustments: (companyId: string, pnl_id?: string) =>
      client.get<any[]>("/v1/pyg-diario/adjustments", { company_id: companyId, pnl_id }),
    setBudget: (data: any) => client.post<any>("/v1/pyg-diario/budgets", data),
    listBudgets: (companyId: string, department?: string) =>
      client.get<any[]>("/v1/pyg-diario/budgets", { company_id: companyId, department }),
    getDashboard: (companyId: string, fecha: string) =>
      client.get<any>("/v1/pyg-diario/dashboard", { company_id: companyId, fecha }),
  },

  // ===== Shrinkage Analysis =====
  shrinkage: {
    compute: (data: any) => client.post<any[]>("/v1/shrinkage/compute", data),
    listRecords: (companyId: string, fecha_desde: string, fecha_hasta: string, category?: string) =>
      client.get<any[]>("/v1/shrinkage/records", { company_id: companyId, fecha_desde, fecha_hasta, category }),
    listAlerts: (companyId: string, params?: { category?: string; is_resolved?: boolean; min_severity?: string }) =>
      client.get<any[]>("/v1/shrinkage/alerts", { company_id: companyId, ...params }),
    resolveAlert: (companyId: string, alertId: string) =>
      client.post<any>(`/v1/shrinkage/alerts/${alertId}/resolve`, { resolved_by: companyId }),
    listRecommendations: (companyId: string, params?: { category?: string; is_applied?: boolean }) =>
      client.get<any[]>("/v1/shrinkage/recommendations", { company_id: companyId, ...params }),
    applyRecommendation: (companyId: string, recId: string) =>
      client.post<any>(`/v1/shrinkage/recommendations/${recId}/apply`),
    getDashboard: (companyId: string, fecha: string) =>
      client.get<any>("/v1/shrinkage/dashboard", { company_id: companyId, fecha }),
  },

  // ===== Forecasting Avanzado =====
  forecastAvanzado: {
    calibrate: (data: any) => client.post<any>("/v1/forecast-avanzado/calibrate", data),
    generateForecast: (data: any) => client.post<any>("/v1/forecast-avanzado/forecast", data),
    listHolidays: (companyId: string, params?: { year?: number; category?: string }) =>
      client.get<any[]>("/v1/forecast-avanzado/holidays", { company_id: companyId, ...params }),
    createHoliday: (data: any) => client.post<any>("/v1/forecast-avanzado/holidays", data),
    listFactors: (companyId: string, params?: { factor_type?: string; fecha_desde?: string; fecha_hasta?: string }) =>
      client.get<any[]>("/v1/forecast-avanzado/factors", { company_id: companyId, ...params }),
    createFactor: (data: any) => client.post<any>("/v1/forecast-avanzado/factors", data),
    listConfigs: (companyId: string) => client.get<any[]>("/v1/forecast-avanzado/configs", { company_id: companyId }),
    getDashboard: (companyId: string) => client.get<any>("/v1/forecast-avanzado/dashboard", { company_id: companyId }),
  },

  // ===== Store Benchmarking =====
  benchmarking: {
    listConfigs: (companyId: string) =>
      client.get<any[]>("/v1/benchmarking/configs", { company_id: companyId }),
    upsertConfig: (data: any) => client.post<any>("/v1/benchmarking/configs", data),
    deleteConfig: (configId: string) => client.delete<any>(`/v1/benchmarking/configs/${configId}`),
    listRegions: (companyId: string) =>
      client.get<any[]>("/v1/benchmarking/regions", { company_id: companyId }),
    createRegion: (data: any) => client.post<any>("/v1/benchmarking/regions", data),
    updateRegion: (regionId: string, data: any) => client.put<any>(`/v1/benchmarking/regions/${regionId}`, data),
    deleteRegion: (regionId: string) => client.delete<any>(`/v1/benchmarking/regions/${regionId}`),
    listRecords: (companyId: string, params?: { branch_id?: string; period_type?: string; limit?: number; offset?: number }) =>
      client.get<any[]>("/v1/benchmarking/records", { company_id: companyId, ...params }),
    createRecord: (data: any) => client.post<any>("/v1/benchmarking/records", data),
    updateRecord: (recordId: string, data: any) => client.put<any>(`/v1/benchmarking/records/${recordId}`, data),
    deleteRecord: (recordId: string) => client.delete<any>(`/v1/benchmarking/records/${recordId}`),
    getRankings: (companyId: string, params?: { period_start?: string; period_type?: string }) =>
      client.get<any>("/v1/benchmarking/rankings", { company_id: companyId, ...params }),
    getScores: (companyId: string, params?: { period_start?: string; period_type?: string }) =>
      client.get<any>("/v1/benchmarking/scores", { company_id: companyId, ...params }),
    getDashboard: (companyId: string, period_type?: string) =>
      client.get<any>("/v1/benchmarking/dashboard", { company_id: companyId, period_type }),
    getComparison: (companyId: string, params?: { period_start?: string; period_type?: string }) =>
      client.get<any[]>("/v1/benchmarking/comparison", { company_id: companyId, ...params }),
    getScoresHistory: (companyId: string, branchId: string, period_type?: string, limit?: number) =>
      client.get<any[]>(`/v1/benchmarking/scores/${branchId}/history`, { company_id: companyId, period_type, limit }),
  },
  // ===== E-commerce Supermercado =====
  ecommerceSm: {
    catalog: {
      list: (companyId: string, params?: { branch_id?: string; category?: string; search?: string; limit?: number; offset?: number }) =>
        client.get<any[]>("/v1/ecommerce-sm/catalog", { company_id: companyId, ...params }),
      upsert: (data: any) => client.post<any>("/v1/ecommerce-sm/catalog", data),
      update: (productId: string, data: any) => client.put<any>(`/v1/ecommerce-sm/catalog/${productId}`, data),
    },
    orders: {
      create: (data: any) => client.post<any>("/v1/ecommerce-sm/orders", data),
      list: (companyId: string, params?: { status?: string; order_type?: string; branch_id?: string; limit?: number; offset?: number }) =>
        client.get<any[]>("/v1/ecommerce-sm/orders", { company_id: companyId, ...params }),
      get: (orderId: string) => client.get<any>(`/v1/ecommerce-sm/orders/${orderId}`),
      updateStatus: (orderId: string, data: any) => client.patch<any>(`/v1/ecommerce-sm/orders/${orderId}/status`, data),
    },
    pickupSlots: {
      list: (companyId: string, params?: { branch_id?: string; slot_date?: string }) =>
        client.get<any[]>("/v1/ecommerce-sm/pickup-slots", { company_id: companyId, ...params }),
      create: (data: any) => client.post<any>("/v1/ecommerce-sm/pickup-slots", data),
    },
    deliveryZones: {
      list: (companyId: string) => client.get<any[]>("/v1/ecommerce-sm/delivery-zones", { company_id: companyId }),
      create: (data: any) => client.post<any>("/v1/ecommerce-sm/delivery-zones", data),
      calculateShipping: (data: any) => client.post<any>("/v1/ecommerce-sm/delivery-zones/calculate-shipping", data),
    },
    deliverySlots: {
      list: (companyId: string, params?: { zone_id?: string; slot_date?: string }) =>
        client.get<any[]>("/v1/ecommerce-sm/delivery-slots", { company_id: companyId, ...params }),
      create: (data: any) => client.post<any>("/v1/ecommerce-sm/delivery-slots", data),
    },
    slots: {
      bulkGenerate: (data: any) => client.post<any>("/v1/ecommerce-sm/slots/bulk-generate", data),
    },
    picking: {
      generate: (orderId: string) => client.post<any>(`/v1/ecommerce-sm/picking/generate/${orderId}`),
      list: (companyId: string, params?: { status?: string; branch_id?: string; limit?: number; offset?: number }) =>
        client.get<any[]>("/v1/ecommerce-sm/picking", { company_id: companyId, ...params }),
      get: (pickingListId: string) => client.get<any>(`/v1/ecommerce-sm/picking/${pickingListId}`),
      assign: (pickingListId: string, data: any) => client.post<any>(`/v1/ecommerce-sm/picking/${pickingListId}/assign`, data),
      scan: (data: any) => client.post<any>("/v1/ecommerce-sm/picking/scan", data),
    },
    payments: {
      record: (data: any) => client.post<any>("/v1/ecommerce-sm/payments", data),
    },
    getDashboard: (companyId: string) => client.get<any>("/v1/ecommerce-sm/dashboard", { company_id: companyId }),
  },
  // ===== Delivery App Integrations =====
  deliveryIntegrations: {
    getDashboard: (companyId?: string) => client.get<any>("/v1/delivery-integrations/dashboard", { company_id: companyId }),
    config: {
      list: (companyId?: string) => client.get<any[]>("/v1/delivery-integrations/config", { company_id: companyId }),
      get: (platform: string) => client.get<any>(`/v1/delivery-integrations/config/${platform}`),
      upsert: (platform: string, data: any) => client.put<any>(`/v1/delivery-integrations/config/${platform}`, data),
      update: (platform: string, data: any) => client.patch<any>(`/v1/delivery-integrations/config/${platform}`, data),
    },
    orders: {
      list: (companyId?: string, params?: { platform?: string; status?: string; limit?: number; offset?: number }) =>
        client.get<any[]>("/v1/delivery-integrations/orders", { company_id: companyId, ...params }),
      get: (orderId: string) => client.get<any>(`/v1/delivery-integrations/orders/${orderId}`),
      updateStatus: (orderId: string, data: any) => client.patch<any>(`/v1/delivery-integrations/orders/${orderId}/status`, data),
    },
    sync: {
      trigger: (platform: string, syncType?: string) => client.post<any>(`/v1/delivery-integrations/sync-menu/${platform}?sync_type=${syncType || "full"}`),
      list: (companyId?: string, params?: { platform?: string; limit?: number }) =>
        client.get<any[]>("/v1/delivery-integrations/menu-syncs", { company_id: companyId, ...params }),
    },
    logs: {
      list: (companyId?: string, params?: { platform?: string; event_type?: string; limit?: number; offset?: number }) =>
        client.get<any[]>("/v1/delivery-integrations/logs", { company_id: companyId, ...params }),
    },
    webhook: {
      send: (platform: string, data: any) => client.post<any>(`/v1/delivery-integrations/webhook/${platform}`, data),
    },
  },
  // ===== Suscripciones & Órdenes Recurrentes =====
  suscripciones: {
    getDashboard: (companyId?: string) => client.get<any>("/v1/suscripciones/dashboard", { company_id: companyId }),
    plans: {
      list: (companyId?: string, params?: { status?: string; customer_id?: string; limit?: number; offset?: number }) =>
        client.get<any[]>("/v1/suscripciones/plans", { company_id: companyId, ...params }),
      create: (data: any) => client.post<any>("/v1/suscripciones/plans", data),
      get: (planId: string) => client.get<any>(`/v1/suscripciones/plans/${planId}`),
      update: (planId: string, data: any) => client.put<any>(`/v1/suscripciones/plans/${planId}`, data),
      delete: (planId: string) => client.delete<any>(`/v1/suscripciones/plans/${planId}`),
      skip: (planId: string) => client.post<any>(`/v1/suscripciones/plans/${planId}/skip`),
      pause: (planId: string, reason?: string) => client.post<any>(`/v1/suscripciones/plans/${planId}/pause${reason ? `?reason=${reason}` : ""}`),
      resume: (planId: string) => client.post<any>(`/v1/suscripciones/plans/${planId}/resume`),
      generateOrder: (planId: string) => client.post<any>(`/v1/suscripciones/plans/${planId}/generate-order`),
    },
    generatedOrders: {
      list: (companyId?: string, params?: { plan_id?: string; status?: string; limit?: number; offset?: number }) =>
        client.get<any[]>("/v1/suscripciones/generated-orders", { company_id: companyId, ...params }),
    },
    generateDue: (companyId?: string) => client.post<any>("/v1/suscripciones/generate-due", { company_id: companyId }),
    availableProducts: (companyId?: string) => client.get<any[]>("/v1/suscripciones/available-products", { company_id: companyId }),
  },
  retail: {
    getDashboard: (branchId?: string) => client.get<any>("/v1/retail/dashboard", branchId ? { branch_id: branchId } : undefined),
    getKpi: (periodo: "dia" | "semana" | "mes", branchId?: string) => client.get<any>(`/v1/retail/kpi/${periodo}`, branchId ? { branch_id: branchId } : undefined),
    getHeatmap: (branchId?: string, dias = 7) => client.get<any>("/v1/retail/heatmap", { branch_id: branchId, dias }),
    storeConfig: {
      get: (branchId: string) => client.get<any>(`/v1/retail/store-config/${branchId}`),
      upsert: (data: any) => client.post<any>("/v1/retail/store-config", data),
    },
    coupons: {
      list: (estado?: string) => client.get<any[]>("/v1/retail/coupons", estado ? { estado } : undefined),
      create: (data: any) => client.post<any>("/v1/retail/coupons", data),
      get: (couponId: string) => client.get<any>(`/v1/retail/coupons/${couponId}`),
      update: (couponId: string, data: any) => client.patch<any>(`/v1/retail/coupons/${couponId}`, data),
      delete: (couponId: string) => client.delete<any>(`/v1/retail/coupons/${couponId}`),
      validate: (data: any) => client.post<any>("/v1/retail/coupons/validate", data),
      redeem: (couponId: string, data: any) => client.post<any>(`/v1/retail/coupons/${couponId}/redeem`, data),
      stats: () => client.get<any>("/v1/retail/coupons-stats"),
    },
    calendar: {
      seedPy: () => client.post<any>("/v1/retail/calendar/seed-py", {}),
      events: {
        list: (year?: number) => client.get<any[]>("/v1/retail/calendar/events", year ? { year } : undefined),
        create: (data: any) => client.post<any>("/v1/retail/calendar/events", data),
        update: (eventId: string, data: any) => client.patch<any>(`/v1/retail/calendar/events/${eventId}`, data),
        suggest: (eventId: string) => client.get<any>(`/v1/retail/calendar/events/${eventId}/suggest`),
      },
      promos: {
        list: (eventId?: string, estado?: string) =>
          client.get<any[]>("/v1/retail/calendar/promos", { event_id: eventId, estado }),
        create: (data: any) => client.post<any>("/v1/retail/calendar/promos", data),
        update: (promoId: string, data: any) => client.patch<any>(`/v1/retail/calendar/promos/${promoId}`, data),
      },
    },
    pos: {
      openSession: (data: any) => client.post<any>("/v1/retail/pos/sessions/open", data),
      closeSession: (sessionId: string, data: any) => client.post<any>(`/v1/retail/pos/sessions/${sessionId}/close`, data),
      getActive: (branchId?: string) => client.get<any>("/v1/retail/pos/sessions/active", { branch_id: branchId }),
    },
    quickCustomer: {
      lookup: (data: any) => client.post<any>("/v1/retail/quick-customer/lookup", data),
    },
    storefront: {
      get: (branchId: string) => client.get<any>(`/v1/retail/storefront/${branchId}`),
      upsert: (data: any) => client.post<any>("/v1/retail/storefront", data),
      update: (storefrontId: string, data: any) => client.patch<any>(`/v1/retail/storefront/${storefrontId}`, data),
      publicBySlug: (slug: string) => client.get<any>(`/v1/retail/public/storefront/${slug}`),
    },
  },
  supplierKpis: {
    listPeriods: (supplierId: string) => client.get<any[]>(`/v1/supplier-kpis/periods?supplier_id=${supplierId}`),
    createPeriod: (data: any) => client.post<any>("/v1/supplier-kpis/periods", data),
    getSummary: (periodId: string, branchId?: string) => client.get<any>(`/v1/supplier-kpis/periods/${periodId}/summary`, { branch_id: branchId }),
    getDashboard: (companyId?: string) => client.get<any>("/v1/supplier-kpis/dashboard", { company_id: companyId || COMPANY_ID }),
    updateIndicator: (id: string, data: any) => client.put<any>(`/v1/supplier-kpis/indicators/${id}`, data),
    bulkUpdateIndicators: (periodId: string, data: any) => client.put<any>(`/v1/supplier-kpis/periods/${periodId}/indicators/bulk`, data),
    deleteIndicator: (id: string) => client.delete<void>(`/v1/supplier-kpis/indicators/${id}`),
    addIndicator: (periodId: string, data: any) => client.post<any>(`/v1/supplier-kpis/periods/${periodId}/indicators`, data),
  },
  supplierRebates: {
    getDashboard: (mes?: string, branchId?: string) => client.get<any>("/v1/supplier-kpis/dashboard", { mes, branch_id: branchId }),
  },
  cupones: {
    registrar: (data: any) => client.post<any>("/v1/cupones/registrar", data),
    registrarMultiple: (data: any) => client.post<any>("/v1/cupones/registrar-multiple", data),
    evaluarCarrito: (data: any) => client.post<any>("/v1/cupones/evaluar-carrito", data),
    listCampanas: (params?: any) => client.get<any[]>("/v1/cupones/campanas", params),
    getCampana: (id: string) => client.get<any>(`/v1/cupones/campanas/${id}`),
    createCampana: (data: any) => client.post<any>("/v1/cupones/campanas", data),
    updateCampana: (id: string, data: any) => client.put<any>(`/v1/cupones/campanas/${id}`, data),
    deleteCampana: (id: string) => client.delete<any>(`/v1/cupones/campanas/${id}`),
    tickets: (params?: any) => client.get<any[]>("/v1/cupones/tickets", params),
    listarTickets: (params?: any) => client.get<any[]>("/v1/cupones/tickets", params),
    clientes: (params?: any) => client.get<any[]>("/v1/cupones/clientes", params),
    listarClientes: (params?: any) => client.get<any[]>("/v1/cupones/clientes", params),
    lookupCliente: (doc: string) => client.get<any>(`/v1/cupones/clientes/${encodeURIComponent(doc)}`),
    buscarDocumento: (doc: string) => client.get<{ encontrado: boolean; origen?: string; documento: string; nombre?: string; telefono?: string; direccion?: string; barrio?: string; ciudad?: string }>(`/v1/cupones/buscar-documento/${encodeURIComponent(doc)}`),
    stats: (params?: any) => client.get<any>("/v1/cupones/stats", params),
    getConfig: () => client.get<any>("/v1/cupones/config"),
    updateConfig: (data: any) => client.put<any>("/v1/cupones/config", data),
    syncTicket: (id: string) => client.post<any>(`/v1/cupones/sync/${id}`),
    syncBatch: (data?: any) => client.post<any>("/v1/cupones/sync-batch", data || {}),
    getSyncBatchProgress: () => client.get<any>("/v1/cupones/sync-batch/progress"),
    analizarIA: (data: any) => client.post<any>("/v1/cupones/analisis-ia", data),
    generarCampana: (data: any) => client.post<any>("/v1/cupones/generar-campana", data),
  },
  posTerminals: {
    list: () => client.get<any[]>(`/v1/pos-terminals`, { company_id: COMPANY_ID }),
    getByHostname: (hostname: string) => client.get<any>(`/v1/pos-terminals/by-hostname/${encodeURIComponent(hostname)}`, { company_id: COMPANY_ID }),
    getByIp: (ip: string) => client.get<any>(`/v1/pos-terminals/by-ip/${encodeURIComponent(ip)}`, { company_id: COMPANY_ID }),
    detect: (params?: { hostname?: string; ip?: string }) => client.get<any>(`/v1/pos-terminals/detect`, { company_id: COMPANY_ID, ...params }),
    create: (data: any) => client.post<any>("/v1/pos-terminals", { company_id: COMPANY_ID, ...data }),
    update: (id: string, data: any) => client.put<any>(`/v1/pos-terminals/${id}`, data),
    delete: (id: string) => client.delete<void>(`/v1/pos-terminals/${id}`),
  },
  supervisorRequests: {
    list: (params?: any) => client.get<any[]>("/v1/supervisor-requests", { company_id: COMPANY_ID, ...params }),
    get: (id: string) => client.get<any>(`/v1/supervisor-requests/${id}`),
    create: (data: any) => client.post<any>("/v1/supervisor-requests", { company_id: COMPANY_ID, ...data }),
    resolve: (id: string, data?: any) => client.post<any>(`/v1/supervisor-requests/${id}/resolve`, data),
  },
  kiosk: {
    lookup: (code: string) => client.get<KioskProductLookup>("/v1/kiosk/lookup", { code, company_id: COMPANY_ID }),
    banners: {
      active: () => client.get<KioskBanner[]>("/v1/kiosk/banners/active", { company_id: COMPANY_ID }),
      list: () => client.get<KioskBanner[]>("/v1/kiosk/banners"),
      create: (data: Partial<KioskBanner>) => client.post<KioskBanner>("/v1/kiosk/banners", data),
      update: (id: string, data: Partial<KioskBanner>) => client.patch<KioskBanner>(`/v1/kiosk/banners/${id}`, data),
      delete: (id: string) => client.delete<void>(`/v1/kiosk/banners/${id}`),
      uploadImage: (id: string, file: File) => {
        const fd = new FormData()
        fd.append("file", file)
        return requestMultipart<KioskBanner>(`/v1/kiosk/banners/${id}/image`, fd)
      },
    },
  },
  donaciones: {
    getCampanaActiva: (companyId?: string) => client.get<DonationCampaign>("/v1/donaciones/campana-activa", { company_id: companyId || COMPANY_ID }),
    updateCampana: (id: string, data: any) => client.put<DonationCampaign>(`/v1/donaciones/campana/${id}`, data),
    registrar: (data: any) => client.post<DonationRecord>("/v1/donaciones/registrar", data),
    getStats: (params?: any) => client.get<DonationStats>("/v1/donaciones/stats", { company_id: COMPANY_ID, ...params }),
    getRankingCajeros: (params?: any) => client.get<CajeroSolidarioRankingItem[]>("/v1/donaciones/ranking-cajeros", { company_id: COMPANY_ID, ...params }),
    getHistorial: (params?: any) => client.get<DonationRecord[]>("/v1/donaciones/historial", { company_id: COMPANY_ID, ...params }),
    getLiquidaciones: (companyId?: string) => client.get<DonationLiquidation[]>("/v1/donaciones/liquidaciones", { company_id: companyId || COMPANY_ID }),
    liquidar: (data: any) => client.post<DonationLiquidation>("/v1/donaciones/liquidar", data),
  },
}

export interface DonationCampaign {
  id: string
  company_id: string
  nombre: string
  ong_nombre: string
  ong_ruc?: string | null
  ong_web: string
  slogan?: string | null
  mensaje_ticket: string
  meta_recaudacion_pyg: number
  fecha_inicio: string
  fecha_fin?: string | null
  activa: boolean
  created_at: string
  updated_at?: string | null
}

export interface DonationRecord {
  id: string
  company_id: string
  branch_id?: string | null
  sale_id?: string | null
  session_id?: string | null
  user_id?: string | null
  cajero_nombre?: string | null
  campana_id: string
  monto_pyg: number
  monto_total_venta_pyg: number
  numero_comprobante?: string | null
  tipo_origen: string
  estado: string
  created_at: string
}

export interface DonationLiquidation {
  id: string
  company_id: string
  campana_id: string
  monto_total_pyg: number
  cantidad_donaciones: number
  fecha_desde: string
  fecha_hasta: string
  numero_acta: string
  entregado_por_nombre?: string | null
  recibido_por_nombre?: string | null
  recibido_por_ci?: string | null
  comprobante_transferencia?: string | null
  observaciones?: string | null
  estado: string
  created_at: string
}

export interface DonationStats {
  total_recaudado_pyg: number
  total_mes_pyg: number
  total_hoy_pyg: number
  total_liquidado_pyg: number
  total_pendiente_pyg: number
  cantidad_donaciones: number
  ticket_promedio_donacion: number
  meta_pyg: number
  progreso_meta_pct: number
  campana_activa?: DonationCampaign | null
}

export interface CajeroSolidarioRankingItem {
  user_id?: string | null
  cajero_nombre: string
  total_recaudado_pyg: number
  cantidad_donaciones: number
  total_ventas_atendidas: number
  tasa_adhesion_pct: number
}

export type CuponTicket = any
export type CuponCliente = any
export type CuponStats = any
export type SupplierKpiPeriod = any
export type SupplierKpiSummary = any
export type SupplierKpiIndicator = any

