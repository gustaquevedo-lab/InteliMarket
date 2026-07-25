export interface SellerUser {
  id: string
  email: string
  nombre: string
  telefono: string
  photo_url: string | null
  company_id: string
  tenant_id: string
}

export interface SellerProfile {
  id: string
  user_id: string
  company_id: string
  photo_url: string | null
  phone_battery_level: number
  status: "online" | "offline" | "busy" | "idle"
  last_lat: number | null
  last_lng: number | null
  last_location_updated: string | null
  last_speed_kmh: number | null
  is_active: boolean
  telefono: string | null
  zona_asignada: string | null
  codigo_vendedor: string | null
}

export interface RouteInstance {
  id: string
  route_id: string
  seller_id: string
  company_id: string
  fecha: string
  status: "planned" | "in_progress" | "completed" | "cancelled"
  started_at: string | null
  ended_at: string | null
  total_traveled_km: number
  notas: string | null
  stops: RouteStop[]
}

export interface RouteStop {
  id: string
  instance_id: string
  customer_id: string
  customer_name?: string
  customer_address?: string
  customer_lat?: number
  customer_lng?: number
  planned_order: number
  planned_arrival: string | null
  actual_arrival: string | null
  actual_departure: string | null
  status: "pending" | "in_progress" | "completed" | "missed" | "cancelled" | "rescheduled"
  result: string | null
  order_amount: number
  products_count: number
  payment_collected: number
  checkin_lat: number | null
  checkin_lng: number | null
  checkout_lat: number | null
  checkout_lng: number | null
  distance_from_customer_meters: number | null
  customer_rating: number | null
  notas: string | null
  fotos_url: string[]
  firma_url: string | null
}

export interface Customer {
  id: string
  nombre: string
  razon_social: string
  ruc: string
  telefono: string
  direccion: string
  latitud: number | null
  longitud: number | null
  email: string
  limite_credito: number
  saldo_pendiente: number
  dias_credito: number
  agreement?: CustomerAgreement
}

export interface CustomerAgreement {
  id: string
  customer_id: string
  nombre: string
  tipo: string
  descuento_general_pct: number
  plazo_pago_dias: number
  limite_credito: number
  estado: string
  items: AgreementItem[]
}

export interface AgreementItem {
  id: string
  product_id: string
  precio_especial: number | null
  descuento_pct: number
}

export interface Product {
  id: string
  nombre: string
  sku: string
  precio_venta: number
  costo_promedio: number
  stock_actual: number
  category_name?: string
  image_url?: string
  unidad_medida: string
  tipo_venta: string
  peso_kg?: number
}

export interface OrderItem {
  product_id: string
  product_name: string
  sku: string
  cantidad: number
  precio_unitario: number
  descuento_pct: number
  subtotal: number
}

export interface Order {
  id: string
  customer_id: string
  visit_id: string
  items: OrderItem[]
  total: number
  descuento_total: number
  estado: "draft" | "confirmed" | "cancelled"
  created_at: string
}

export interface VisitResult {
  visit_id: string
  stop_id: string
  result:
    | "order_taken"
    | "payment_collected"
    | "delivery"
    | "no_answer"
    | "rescheduled"
    | "no_sale"
    | "visit_only"
  order_amount: number
  products_count: number
  payment_collected: number
  customer_rating: number
  notas: string
  firma_base64: string | null
  fotos: string[]
}

export interface GPSPoint {
  lat: number
  lng: number
  battery_level: number
  speed_kmh: number
  accuracy_meters: number
  altitude_meters: number
  recorded_at: string
}

export interface GeofenceZone {
  id: string
  nombre: string
  zone_type: "restricted" | "preferred" | "watch" | "off_limits"
  geometry_type: "polygon" | "circle"
  coordinates: number[][] | { lat: number; lng: number; radius_m: number }
  color: string
  active_start_time: string
  active_end_time: string
  active_days: number[]
  alert_on_entry: boolean
}

export interface SyncQueueItem {
  id: string
  type: "gps_ping" | "visit_complete" | "order_create" | "route_start" | "route_end"
  payload: any
  status: "pending" | "syncing" | "done" | "error"
  created_at: string
  retry_count: number
}

export interface DashboardData {
  today_visits: number
  today_completed: number
  today_orders: number
  today_amount: number
  route: RouteInstance | null
  sellers: any[]
  geofence_zones: any[]
}
