import { client } from "./index"

// ==================== Shared ====================
export interface PaginatedRes<T> { items: T[]; total: number; page: number; page_size: number }

// ==================== Verticales/Skills ====================
export interface SvcVertical { id?: string; codigo?: string; nombre?: string; descripcion?: string; icono?: string; color?: string; activo?: boolean }
export interface SvcSkill { id?: string; codigo: string; nombre: string; categoria?: string; descripcion?: string; nivel_maximo?: number; activo?: boolean; created_at?: string }

// ==================== Técnicos ====================
export interface SvcTechnician {
  id?: string; company_id?: string; nombre: string; vertical_codigo?: string
  ci?: string; telefono?: string; email?: string; tipo?: string; modalidad?: string
  tarifa_hora_pyg?: number; tarifa_visita_pyg?: number; comision_pct?: number
  zonas_cobertura?: string[]; biografia?: string; color_calendario?: string
  rating_promedio?: number; total_servicios?: number; total_clientes?: number
  primera_visita_pct?: number; activo?: boolean; disponible?: boolean; created_at?: string
  skills?: SvcTechSkill[]; certifications?: SvcCertification[]
}
export interface SvcTechSkill {
  id?: string; technician_id?: string; skill_id?: string; nivel?: number
  certificado?: boolean; skill_nombre?: string; skill_codigo?: string
}
export interface SvcCertification {
  id?: string; company_id?: string; technician_id?: string
  tipo: string; nombre: string; institucion?: string; numero?: string
  fecha_emision?: string; fecha_vencimiento?: string; alerta_dias?: number
  dias_para_vencer?: number; alerta_enviada?: boolean; archivo_url?: string
  notas?: string; created_at?: string
}

// ==================== Propiedades/Equipos ====================
export interface SvcProperty {
  id?: string; company_id?: string; customer_id: string; nombre: string
  tipo?: string; direccion: string; ciudad?: string; departamento?: string
  lat?: number; lng?: number; zona_id?: string; activo?: boolean; equipo_count?: number
  created_at?: string
}
export interface SvcEquipment {
  id?: string; company_id?: string; property_id: string; customer_id?: string
  tipo: string; marca?: string; modelo?: string; numero_serie?: string
  estado?: string; requiere_mantenimiento?: boolean; activo?: boolean; created_at?: string
}

// ==================== Cotizaciones ====================
export interface SvcQuoteItem {
  id?: string; tipo?: string; codigo?: string; descripcion: string; detalle?: string
  cantidad?: number; unidad?: string; precio_unitario?: number; descuento_pct?: number
  iva_incluido?: boolean; orden?: number; subtotal?: number
}
export interface SvcQuote {
  id?: string; company_id?: string; numero?: string; customer_id: string; customer_nombre?: string
  property_id?: string; property_nombre?: string; technician_id?: string; technician_nombre?: string
  vertical_codigo?: string; titulo: string; descripcion?: string; estado?: string
  fecha_cotizacion?: string; fecha_validez?: string; duracion_estimada_horas?: number
  subtmano_obra?: number; subtotal_materiales?: number; descuento_pct?: number; iva_pct?: number
  total?: number; pdf_url?: string; items?: SvcQuoteItem[]; created_at?: string
}

// ==================== Agenda ====================
export interface SvcAppointment {
  id?: string; company_id?: string; customer_id: string; customer_nombre?: string; customer_telefono?: string
  property_id?: string; property_direccion?: string; technician_id?: string; technician_nombre?: string; technician_color?: string
  quote_id?: string; tipo?: string; estado?: string; prioridad?: string
  titulo?: string; descripcion?: string; fecha?: string; hora_desde?: string; hora_hasta?: string
  duracion_estimada_minutos?: number; direccion?: string; lat?: number; lng?: number
  recordatorio_enviado?: boolean; confirmada?: boolean; color?: string; created_at?: string
}

// ==================== Dispatch ====================
export interface SvcDispatchRanking {
  technician_id: string; nombre: string; vertical_codigo?: string; score: number
  distancia_km?: number; rating?: number; skills_match?: string[]; disponible?: boolean
}

// ==================== Work Orders ====================
export interface SvcWOItem {
  id?: string; tipo?: string; codigo?: string; descripcion: string; cantidad?: number
  precio_unitario?: number; subtotal?: number
}
export interface SvcWorkOrder {
  id?: string; company_id?: string; numero?: string
  customer_id: string; customer_nombre?: string; property_id?: string; equipment_id?: string
  technician_id?: string; technician_nombre?: string; quote_id?: string; appointment_id?: string
  vertical_codigo?: string; tipo?: string; estado?: string; prioridad?: string
  titulo?: string; problema_reportado?: string; fecha_programada?: string
  fecha_checkin?: string; fecha_inicio?: string; fecha_fin?: string; duracion_real_minutos?: number
  subtmano_obra?: number; subtotal_materiales?: number; descuento?: number; iva?: number; total?: number
  invoice_id?: string; satisfaccion_nps?: number; items?: SvcWOItem[]; created_at?: string
  timer_id?: string; timer_start?: string
}

// ==================== Contratos ====================
export interface SvcContract {
  id?: string; company_id?: string; numero?: string
  customer_id: string; customer_nombre?: string; titulo?: string; estado?: string
  fecha_inicio?: string; fecha_fin?: string; duracion_meses?: number; renovacion_auto?: boolean
  frecuencia_visitas?: string; visitas_incluidas_anio?: number; visitas_realizadas?: number
  visitas_restantes?: number; monto_mensual_pyg?: number; fecha_proximo_cobro?: string
  created_at?: string
}
export interface SvcContractVisit {
  id?: string; contract_id?: string; fecha_programada?: string; fecha_realizada?: string
  technician_id?: string; estado?: string; observaciones?: string
}

// ==================== Inventario Móvil ====================
export interface SvcTruckItem {
  id?: string; company_id?: string; technician_id: string; producto_id: string
  producto_nombre?: string; cantidad: number; stock_minimo?: number; created_at?: string
}
export interface SvcInvMovement {
  id?: string; company_id?: string; technician_id: string; producto_id: string
  tipo: string; cantidad: number; motivo?: string; work_order_id?: string; created_at?: string
}

// ==================== Facturas ====================
export interface SvcInvoicePayment {
  id?: string; invoice_id: string; fecha?: string; monto: number; metodo_pago?: string
  referencia?: string; banco?: string; notas?: string
}
export interface SvcInvoice {
  id?: string; company_id?: string; numero?: string
  customer_id: string; customer_nombre?: string; work_order_id?: string; contract_id?: string
  estado?: string; fecha_emision?: string; fecha_vencimiento?: string
  subtotal?: number; descuento?: number; iva?: number; total?: number
  monto_pagado?: number; saldo?: number; dias_mora?: number; sifen_cdc?: string; pdf_url?: string
  payments?: SvcInvoicePayment[]; created_at?: string
}

// ==================== Quote Requests (Lead Capture) ====================
export interface SvcQuoteRequest {
  id?: string; company_id?: string; customer_nombre: string; customer_telefono?: string
  customer_email?: string; vertical_codigo?: string; descripcion?: string; estado?: string
  direccion?: string; fecha_preferida?: string; franja_horaria?: string; created_at?: string
}

// ==================== Reviews ====================
export interface SvcReview {
  id?: string; technician_id: string; customer_id: string; customer_nombre?: string
  puntuacion: number; comentario?: string; work_order_id?: string; created_at?: string
}

// ==================== Time Tracking ====================
export interface SvcTimer {
  id?: string; work_order_id: string; technician_id: string; inicio?: string; fin?: string
  duracion_minutos?: number; facturable?: boolean; created_at?: string
}

// ==================== Dashboard ====================
export interface SvcDashboard {
  kpis_principales?: Record<string, any>
  agenda_hoy?: SvcAppointment[]
  wo_en_progreso?: SvcWorkOrder[]
  alertas_certificaciones?: any[]
  top_tecnicos?: any[]
  revenue_mes?: Record<string, any>
  aging_facturas?: Record<string, any>
  contratos_por_vencer?: SvcContract[]
  queue_quote_requests?: SvcQuoteRequest[]
}

// ==================== API ====================
const BASE = "/v1/servicios"

export const serviciosApi = {
  // === Dashboard ===
  getDashboard: () => client.get<SvcDashboard>(`${BASE}/dashboard`),

  // === Verticales / Skills ===
  listVerticals: () => client.get<SvcVertical[]>(`${BASE}/verticals`),
  listSkills: (categoria?: string) => client.get<SvcSkill[]>(`${BASE}/skills`, categoria ? { categoria } as any : undefined),
  createSkill: (data: any) => client.post<SvcSkill>(`${BASE}/skills`, data),

  // === Técnicos ===
  listTechnicians: (params?: { vertical?: string; active_only?: boolean }) =>
    client.get<SvcTechnician[]>(`${BASE}/technicians`, params as any),
  getTechnician: (id: string) => client.get<SvcTechnician>(`${BASE}/technicians/${id}`),
  createTechnician: (data: any) => client.post<SvcTechnician>(`${BASE}/technicians`, data),
  updateTechnician: (id: string, data: any) => client.patch<SvcTechnician>(`${BASE}/technicians/${id}`, data),
  addTechSkill: (techId: string, data: any) => client.post<SvcTechSkill>(`${BASE}/technicians/${techId}/skills`, data),
  listTechSkills: (techId: string) => client.get<SvcTechSkill[]>(`${BASE}/technicians/${techId}/skills`),
  addCertification: (techId: string, data: any) => client.post<SvcCertification>(`${BASE}/technicians/${techId}/certifications`, data),
  listCertifications: (techId: string) => client.get<SvcCertification[]>(`${BASE}/technicians/${techId}/certifications`),
  addReview: (techId: string, data: any) => client.post<SvcReview>(`${BASE}/technicians/${techId}/reviews`, data),

  // === Propiedades / Equipos ===
  listProperties: (customerId?: string) => client.get<SvcProperty[]>(`${BASE}/properties`, customerId ? { customer_id: customerId } as any : undefined),
  createProperty: (data: any) => client.post<SvcProperty>(`${BASE}/properties`, data),
  listEquipment: (propertyId?: string) => client.get<SvcEquipment[]>(`${BASE}/equipment`, propertyId ? { property_id: propertyId } as any : undefined),
  createEquipment: (data: any) => client.post<SvcEquipment>(`${BASE}/equipment`, data),

  // === Cotizaciones ===
  listQuotes: (params?: { estado?: string; customer_id?: string; limit?: number }) =>
    client.get<SvcQuote[]>(`${BASE}/quotes`, params as any),
  getQuote: (id: string) => client.get<SvcQuote>(`${BASE}/quotes/${id}`),
  createQuote: (data: any) => client.post<SvcQuote>(`${BASE}/quotes`, data),
  updateQuote: (id: string, data: any) => client.patch<SvcQuote>(`${BASE}/quotes/${id}`, data),
  convertQuoteToWO: (id: string) => client.post<any>(`${BASE}/quotes/${id}/convert-to-wo`, {}),

  // === Agenda ===
  listAppointments: (params?: { fecha_desde?: string; fecha_hasta?: string; technician_id?: string; estado?: string }) =>
    client.get<SvcAppointment[]>(`${BASE}/appointments`, params as any),
  getAppointment: (id: string) => client.get<SvcAppointment>(`${BASE}/appointments/${id}`),
  createAppointment: (data: any) => client.post<SvcAppointment>(`${BASE}/appointments`, data),
  updateAppointment: (id: string, data: any) => client.patch<SvcAppointment>(`${BASE}/appointments/${id}`, data),

  // === Dispatch ===
  getDispatchRanking: (params: { lat: number; lng: number; fecha: string; hora_desde: string; duracion_min: number; skill_id?: string }) =>
    client.get<SvcDispatchRanking[]>(`${BASE}/dispatch`, params as any),

  // === Work Orders ===
  listWorkOrders: (params?: { estado?: string; technician_id?: string; customer_id?: string; fecha_desde?: string; fecha_hasta?: string; limit?: number }) =>
    client.get<SvcWorkOrder[]>(`${BASE}/work-orders`, params as any),
  getWorkOrder: (id: string) => client.get<SvcWorkOrder>(`${BASE}/work-orders/${id}`),
  createWorkOrder: (data: any) => client.post<SvcWorkOrder>(`${BASE}/work-orders`, data),
  updateWorkOrder: (id: string, data: any) => client.patch<SvcWorkOrder>(`${BASE}/work-orders/${id}`, data),

  // === Time Tracking ===
  startTimer: (woId: string) => client.post<SvcTimer>(`${BASE}/work-orders/${woId}/time/start`, {}),
  stopTimer: (timerId: string, facturable?: boolean) =>
    client.post<SvcTimer>(`${BASE}/time/${timerId}/stop${facturable != null ? `?facturable=${facturable}` : ""}`, {}),

  // === Contratos ===
  listContracts: (estado?: string) => client.get<SvcContract[]>(`${BASE}/contracts`, estado ? { estado } as any : undefined),
  getContract: (id: string) => client.get<SvcContract>(`${BASE}/contracts/${id}`),
  createContract: (data: any) => client.post<SvcContract>(`${BASE}/contracts`, data),
  generateVisits: (contractId: string) => client.post<{ visitas_creadas: number }>(`${BASE}/contracts/${contractId}/generate-visits`, {}),
  listContractVisits: (contractId: string) => client.get<SvcContractVisit[]>(`${BASE}/contracts/${contractId}/visits`),

  // === Inventario Móvil ===
  listTruckInventory: (technicianId?: string) =>
    client.get<SvcTruckItem[]>(`${BASE}/truck-inventory`, technicianId ? { technician_id: technicianId } as any : undefined),
  createInventoryMovement: (data: any) =>
    client.post<SvcInvMovement>(`${BASE}/inventory-movements`, data),
  listInventoryMovements: (params?: { technician_id?: string; product_id?: string; limit?: number }) =>
    client.get<SvcInvMovement[]>(`${BASE}/inventory-movements`, params as any),

  // === Facturas ===
  listInvoices: (params?: { estado?: string; customer_id?: string; limit?: number }) =>
    client.get<SvcInvoice[]>(`${BASE}/invoices`, params as any),
  getInvoice: (id: string) => client.get<SvcInvoice>(`${BASE}/invoices/${id}`),
  addInvoicePayment: (invoiceId: string, data: any) =>
    client.post<SvcInvoicePayment>(`${BASE}/invoices/${invoiceId}/payments`, data),

  // === Quote Requests (Lead Capture) ===
  listQuoteRequests: (estado?: string) =>
    client.get<SvcQuoteRequest[]>(`${BASE}/quote-requests`, estado ? { estado } as any : undefined),
  createQuoteRequest: (data: any) =>
    client.post<SvcQuoteRequest>(`${BASE}/quote-requests`, data),
}
