const API_BASE = import.meta.env.VITE_API_URL || "/api"

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("access_token")
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  if (token) headers["Authorization"] = `Bearer ${token}`
  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Error desconocido" }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

// ========== PHARMA INTERFACES ==========
export interface PharmaActiveIngredient {
  id: string; company_id: string; nombre: string; nombre_comun: string | null;
  categoria: string | null; descripcion: string | null; dosis_maxima_diaria: string | null;
  contraindicaciones: string | null; interactua_con: string[] | null;
  embarazo_categoria: string | null; requiere_receta: boolean; activo: boolean;
  created_at: string;
}

export interface PharmaMedication {
  id: string; company_id: string; product_id: string; principio_activo_id: string;
  concentracion: string; concentracion_numerica: number | null; concentracion_unidad: string | null;
  forma_farmaceutica: string; via_administracion: string | null;
  registro_sanitario: string | null; laboratorio: string | null; marca_comercial: string | null;
  es_generico: boolean; es_referencia: boolean; es_controlado: boolean;
  categoria_controlado: string | null; requiere_receta_retencion: boolean;
  requiere_cadena_frio: boolean; temp_min: number | null; temp_max: number | null;
  protege_luz: boolean; posologia_habitual: string | null; contraindicaciones: string | null;
  efectos_adversos: string | null; interactua_con: string[] | null;
  necesita_autorizacion_obra_social: boolean; activo: boolean;
  created_at: string; updated_at: string;
}

export interface PharmaExpirationAlert {
  id: string; company_id: string; product_id: string; medication_id: string | null;
  warehouse_id: string | null; lote: string; fecha_vencimiento: string;
  cantidad: number; alerta_tipo: string; dias_restantes: number | null;
  notificado: boolean; resuelto: boolean; created_at: string;
}

export interface PharmaControlledLog {
  id: string; medication_id: string; product_id: string; lote: string | null;
  cantidad: number; tipo_movimiento: string; patient_nombre: string | null;
  patient_ci: string | null; receta_numero: string | null;
  receta_medico_nombre: string | null; receta_medico_matricula: string | null;
  created_at: string;
}

export interface PharmaPrescription {
  id: string; customer_id: string; medico_nombre: string; medico_matricula: string | null;
  fecha_emision: string; fecha_vencimiento: string | null; numero_receta: string | null;
  es_controlada: boolean; items: PharmaPrescriptionItem[]; estado: string;
  created_at: string;
}

export interface PharmaPrescriptionItem {
  medication_id: string; cantidad: number; posologia: string | null; duracion: number | null;
}

export interface PharmaInsuranceCoverage {
  id: string; medication_id: string; obra_social_nombre: string; cobertura_pct: number;
  copago_fijo: number | null; requiere_autorizacion: boolean;
  limite_mensual: number | null; activo: boolean;
}

export interface PharmaInsurancePrice {
  covered: boolean; cobertura_pct: number; copago: number;
  obra_social_paga: number; requiere_autorizacion: boolean;
}

export interface PharmaColdChainLog {
  id: string; product_id: string; medication_id: string | null; lote: string | null;
  temperatura: number; temp_min_esperada: number | null; temp_max_esperada: number | null;
  fuera_rango: boolean; tipo_registro: string; created_at: string;
}

export interface PharmaPatientHistoryEntry {
  id: string; customer_id: string; medication_id: string; product_id: string;
  sale_id: string | null; cantidad: number; posologia: string | null;
  duracion_dias: number | null; medico_nombre: string | null; created_at: string;
}

export interface PharmaStats {
  total_medications: number; total_genericos: number; total_controlados: number;
  total_cadena_frio: number; vencidos_sin_resolver: number; criticos_sin_resolver: number;
}

// ========== PHARMA API ==========
export const pharmaApi = {
  activeIngredients: {
    list: (params?: { search?: string }) =>
      request<PharmaActiveIngredient[]>(`/v1/pharma/active-ingredients?${new URLSearchParams(params as Record<string, string>)}`),
    get: (id: string) => request<PharmaActiveIngredient>(`/v1/pharma/active-ingredients/${id}`),
    create: (data: Partial<PharmaActiveIngredient>) => request<PharmaActiveIngredient>("/v1/pharma/active-ingredients", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<PharmaActiveIngredient>) => request<PharmaActiveIngredient>(`/v1/pharma/active-ingredients/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/v1/pharma/active-ingredients/${id}`, { method: "DELETE" }),
  },
  medications: {
    list: (params?: { search?: string; principio_activo_id?: string; es_generico?: boolean; es_controlado?: boolean; requiere_cadena_frio?: boolean; laboratorio?: string; limit?: number }) =>
      request<PharmaMedication[]>(`/v1/pharma/medications?${new URLSearchParams(params as Record<string, string>)}`),
    get: (id: string) => request<PharmaMedication>(`/v1/pharma/medications/${id}`),
    byActiveIngredient: (id: string) => request<PharmaMedication[]>(`/v1/pharma/medications/by-active-ingredient/${id}`),
    equivalents: (id: string) => request<PharmaMedication[]>(`/v1/pharma/medications/${id}/equivalents`),
    searchByIngredient: (params: { principio_activo_id: string; concentracion?: string }) =>
      request<PharmaMedication[]>(`/v1/pharma/medications/search-by-ingredient?${new URLSearchParams(params)}`),
    genericSubstitute: (id: string) => request<PharmaMedication | null>(`/v1/pharma/medications/${id}/generic-substitute`),
    create: (data: Partial<PharmaMedication>) => request<PharmaMedication>("/v1/pharma/medications", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<PharmaMedication>) => request<PharmaMedication>(`/v1/pharma/medications/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  },
  equivalents: {
    create: (data: { medication_id: string; equivalent_medication_id: string; tipo?: string; diferencia_precio_pct?: number }) =>
      request<any>("/v1/pharma/equivalents", { method: "POST", body: JSON.stringify(data) }),
  },
  expirationAlerts: {
    list: (params?: { tipo?: string; resueltos?: boolean }) =>
      request<PharmaExpirationAlert[]>(`/v1/pharma/expiration-alerts?${new URLSearchParams(params as Record<string, string>)}`),
    scan: () => request<{ alerts_created: number }>("/v1/pharma/expiration-alerts/scan", { method: "POST" }),
    resolve: (id: string, motivo: string) => request<void>(`/v1/pharma/expiration-alerts/${id}/resolve`, { method: "PATCH", body: JSON.stringify({ motivo }) }),
  },
  controlledLogs: {
    create: (data: Partial<PharmaControlledLog>) => request<PharmaControlledLog>("/v1/pharma/controlled-logs", { method: "POST", body: JSON.stringify(data) }),
    list: (params?: { medication_id?: string; patient_ci?: string; limit?: number }) =>
      request<PharmaControlledLog[]>(`/v1/pharma/controlled-logs?${new URLSearchParams(params as Record<string, string>)}`),
    dinalfaReport: (mes: number, anio: number) =>
      request<any[]>(`/v1/pharma/controlled-logs/dinalfa-report?mes=${mes}&anio=${anio}`),
  },
  prescriptions: {
    list: (params?: { customer_id?: string; estado?: string; limit?: number }) =>
      request<PharmaPrescription[]>(`/v1/pharma/prescriptions?${new URLSearchParams(params as Record<string, string>)}`),
    create: (data: Partial<PharmaPrescription>) => request<PharmaPrescription>("/v1/pharma/prescriptions", { method: "POST", body: JSON.stringify(data) }),
    dispense: (id: string, sale_id: string) => request<void>(`/v1/pharma/prescriptions/${id}/dispense?sale_id=${sale_id}`, { method: "POST" }),
  },
  insurance: {
    list: (params?: { medication_id?: string; obra_social?: string }) =>
      request<PharmaInsuranceCoverage[]>(`/v1/pharma/insurance?${new URLSearchParams(params as Record<string, string>)}`),
    create: (data: Partial<PharmaInsuranceCoverage>) => request<PharmaInsuranceCoverage>("/v1/pharma/insurance", { method: "POST", body: JSON.stringify(data) }),
    calculatePrice: (data: { medication_id: string; obra_social: string; precio_base: number }) =>
      request<PharmaInsurancePrice>("/v1/pharma/insurance/calculate-price", { method: "POST", body: JSON.stringify(data) }),
  },
  coldChain: {
    list: (params?: { product_id?: string; fuera_rango?: boolean; limit?: number }) =>
      request<PharmaColdChainLog[]>(`/v1/pharma/cold-chain?${new URLSearchParams(params as Record<string, string>)}`),
    create: (data: Partial<PharmaColdChainLog>) => request<PharmaColdChainLog>("/v1/pharma/cold-chain", { method: "POST", body: JSON.stringify(data) }),
  },
  patientHistory: {
    list: (params: { customer_id: string; limit?: number }) =>
      request<PharmaPatientHistoryEntry[]>(`/v1/pharma/patient-history?${new URLSearchParams(Object.entries(params).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))}`),
  },
  stats: {
    get: () => request<PharmaStats>("/v1/pharma/stats"),
  },
}
