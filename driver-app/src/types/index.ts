export interface DriverUser {
  id: string
  email: string
  nombre: string
  telefono: string
  photo_url: string | null
  tenant_id: string
}

export interface DriverProfile {
  id: string
  user_id: string
  tenant_id: string
  photo_url: string | null
  telefono: string | null
  licencia: string | null
  licencia_vencimiento: string | null
  status: "online" | "offline" | "busy" | "idle"
  is_active: boolean
}

export interface Vehicle {
  id: string
  tenant_id: string
  driver_id: string | null
  tipo: string
  marca: string
  modelo: string
  patente: string
  capacidad_kg: number
  caja_termica: boolean
  ano: number
  color: string
}

export interface Delivery {
  id: string
  tenant_id: string
  driver_id: string | null
  vehicle_id: string | null
  route_id: string | null
  customer_name: string
  customer_address: string
  customer_phone: string
  customer_lat: number | null
  customer_lng: number | null
  status: "pending" | "assigned" | "in_progress" | "delivered" | "failed" | "cancelled"
  priority: "low" | "medium" | "high" | "urgent"
  scheduled_date: string | null
  delivery_window_start: string | null
  delivery_window_end: string | null
  notes: string | null
  package_desc: string | null
  package_count: number
  total_amount: number
  confirmation_pin: string | null
  delivered_at: string | null
  created_at: string
}

export interface Route {
  id: string
  tenant_id: string
  driver_id: string | null
  vehicle_id: string | null
  name: string
  status: "planned" | "in_progress" | "completed" | "cancelled"
  fecha: string
  started_at: string | null
  ended_at: string | null
  total_km: number
  optimized_order: number[] | null
  stops: RouteStop[]
}

export interface RouteStop {
  id: string
  route_id: string
  delivery_id: string
  delivery?: Delivery
  planned_order: number
  status: "pending" | "in_progress" | "completed" | "missed" | "cancelled"
  arrival_time: string | null
  departure_time: string | null
  distance_from_prev_km: number
  estimated_duration_min: number
  result: string | null
  notas: string | null
  fotos_url: string[]
  firma_url: string | null
}

export interface GPSPoint {
  lat: number
  lng: number
  speed_kmh: number
  heading: number
  accuracy_meters: number
  altitude_meters: number
  battery_level: number
  recorded_at: string
}

export interface DeliveryProof {
  id: string
  delivery_id: string
  foto_antes_url: string | null
  foto_despues_url: string | null
  firma_url: string | null
  pin_confirmado: string | null
  observaciones: string | null
  created_at: string
}

export interface IncidentReport {
  id: string
  delivery_id: string
  tipo: "customer_absent" | "wrong_address" | "damaged_package" | "rejected" | "other"
  descripcion: string
  fotos_url: string[]
  created_at: string
}

export interface FleetChecklistItem {
  id: string
  nombre: string
  categoria: string
  obligatorio: boolean
}

export interface DashboardData {
  today_deliveries: number
  today_completed: number
  today_pending: number
  today_amount: number
  active_route: Route | null
  assigned_vehicle: Vehicle | null
  checklists: FleetChecklistItem[]
}

export interface SyncQueueItem {
  id: string
  type: "gps_ping" | "delivery_complete" | "route_start" | "route_end" | "incident_report" | "checklist_submit"
  payload: any
  status: "pending" | "syncing" | "done" | "error"
  created_at: string
  retry_count: number
}
