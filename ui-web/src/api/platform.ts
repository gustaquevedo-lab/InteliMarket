import { client } from "./index"

export type Env = "production" | "sandbox" | "all"
export type IssueStatus = "unresolved" | "resolved" | "ignored"

export interface Issue {
  id: string
  environment: string
  source: "backend" | "frontend" | "electron" | "integration"
  level: "fatal" | "error" | "warning" | "info"
  title: string
  culprit?: string | null
  provider?: string | null
  status: IssueStatus
  occurrences: number
  regressions: number
  first_seen: string
  last_seen: string
  first_release?: string | null
  last_release?: string | null
  resolved_at?: string | null
  resolved_by?: string | null
  resolved_release?: string | null
  ignored_until?: string | null
  note?: string | null
  cajas: [string, number][]
  users: [string, number][]
  releases: [string, number][]
  routes: [string, number][]
  users_count: number
  cajas_count: number
  spark: number[]
}

export interface IssueEvent {
  id: string
  ts: string
  level: string
  message?: string | null
  stack?: string | null
  request_id?: string | null
  route?: string | null
  http_method?: string | null
  http_status?: number | null
  duration_ms?: number | null
  user_name?: string | null
  rol?: string | null
  hostname?: string | null
  punto_emision?: string | null
  release?: string | null
  app_version?: string | null
  url?: string | null
  client_ip?: string | null
  user_agent?: string | null
  breadcrumbs?: { t: string; type: string; msg: string }[] | null
  extra?: Record<string, unknown> | null
}

export interface Overview {
  environment_api: string
  env: string
  issues: { unresolved: number; fatal: number; new_24h: number; resolved_7d: number }
  events_24h: { t: string; count: number }[]
  events_24h_total: number
  by_source: Record<string, number>
  by_provider: Record<string, number>
  top_issues: Issue[]
}

export interface AuditRow {
  id: string
  ts: string
  actor_name?: string | null
  action: string
  target_type?: string | null
  target_id?: string | null
  target_label?: string | null
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  client_ip?: string | null
}

export interface AlertSettings {
  whatsapp_enabled: boolean
  bell_enabled: boolean
  alert_phone: string
  spike_threshold: number
}

export interface IssueQuery {
  status?: string
  source?: string
  provider?: string
  level?: string
  env?: Env
  q?: string
  sort?: string
  limit?: number
  offset?: number
}


export interface ProviderField { key: string; label: string; kind: "text" | "url" | "secret"; required: boolean; hint: string }
export interface IntegrationStats {
  series_7d: { d: string; ok: number; fail: number; stuck: number }[]
  ok_7d: number; fail_7d: number; ok_today: number; fail_today: number; stuck: number; last_success?: string | null
}
export interface IntegrationItem {
  id: string; label: string; group: string; description: string; environments: string[]
  defaults: Record<string, Record<string, string>>; terminals: boolean; terminals_port?: number | null
  check_label: string; check_warning?: string | null; fields: ProviderField[]
  exists: boolean; enabled: boolean; environment: string | null; updated_at?: string | null
  values: Record<string, string | null>; secrets_set: Record<string, boolean>; missing: string[]
  state: "ok" | "error" | "sin_probar" | "sin_configurar" | "desactivada"; incidents_open: number
  last_check: { ts: string; ok: boolean; latency_ms?: number | null; detail?: string | null; actor?: string | null } | null
  last_check_ok?: string | null; stats: IntegrationStats
}
export interface CheckResult { ok: boolean; latency_ms?: number; detail?: string; meta?: { terminales?: { caja: string; punto: string; ip: string; ok: boolean; ms?: number; error?: string; greeting?: string | null }[]; sin_uso?: string[] } }

export interface CajaWarning { level: "error" | "warning"; text: string }
export interface CajaItem {
  id: string; hostname: string; caja_nombre: string; punto_emision: string; activo: boolean
  ip_pc?: string | null; ip_bancard?: string | null; ip_dinelco?: string | null
  asignado: { bancard?: string | null; dinelco?: string | null }
  heartbeat: { last_seen: string; online: boolean; release?: string | null; app_version?: string | null; electron_version?: string | null; user_name?: string | null; url?: string | null; capabilities?: string[] | null; client_ip?: string | null } | null
  missing_capabilities: string[]
  last_tx: { tipo: string; ok: boolean; error?: string | null; ts: string } | null
  tx_24h: { ok: number; fail: number }
  warnings: CajaWarning[]
}
export interface CajasResponse { expected_capabilities: string[]; current_release: string | null; items: CajaItem[] }

export interface TenantItem {
  id: string; nombre: string; slug: string; schema_name: string; plan: string; estado: string
  fecha_inicio?: string | null; fecha_vencimiento?: string | null; contacto_email?: string | null; contacto_phone?: string | null
  created_at?: string | null; usuarios: number; empresas: { id: string; razon_social: string; ruc: string; activo: boolean }[]
  vertical?: string | null; modulos: number
}

export const platform = {
  overview: (env: Env) => client.get<Overview>("/v1/platform/overview", { env }),
  issues: (p: IssueQuery) => client.get<{ total: number; items: Issue[] }>("/v1/platform/issues", p as Record<string, string | number>),
  issue: (id: string) => client.get<{ issue: Issue; series_7d: number[]; events: IssueEvent[] }>(`/v1/platform/issues/${id}`),
  setStatus: (id: string, status: IssueStatus, opts?: { note?: string; ignore_hours?: number }) =>
    client.post<Issue>(`/v1/platform/issues/${id}/status`, { status, ...opts }),
  bulkStatus: (ids: string[], status: IssueStatus, opts?: { ignore_hours?: number }) =>
    client.post<{ updated: number }>("/v1/platform/issues/bulk-status", { ids, status, ...opts }),
  deleteIssue: (id: string) => client.delete<void>(`/v1/platform/issues/${id}`),
  testIssue: () => client.post<{ issue_id: string; new: boolean }>("/v1/platform/issues/test"),
  settings: () => client.get<AlertSettings>("/v1/platform/settings"),
  putSettings: (s: Partial<AlertSettings>) => client.put<AlertSettings>("/v1/platform/settings", s),
  alertsTest: () => client.post<{ bell: boolean; whatsapp: boolean }>("/v1/platform/alerts/test"),
  audit: (p: { limit?: number; offset?: number; action?: string; q?: string }) =>
    client.get<{ total: number; items: AuditRow[] }>("/v1/platform/audit", p as Record<string, string | number>),
  integrations: (companyId?: string) => client.get<{ company_id: string; companies: { id: string; nombre: string }[]; items: IntegrationItem[] }>("/v1/platform/integrations", companyId ? { company_id: companyId } : undefined),
  saveIntegration: (id: string, body: { environment: string; enabled: boolean; values: Record<string, string | null>; company_id?: string }) =>
    client.put<{ ok: boolean; changed: string[] }>(`/v1/platform/integrations/${id}`, body),
  applyDefaults: (id: string, environment: string, company_id?: string) => client.post<{ ok: boolean; applied: string[] }>(`/v1/platform/integrations/${id}/apply-defaults`, { environment, company_id }),
  checkIntegration: (id: string, company_id?: string) => client.post<CheckResult>(`/v1/platform/integrations/${id}/check`, { company_id }),
  integrationHistory: (id: string, company_id?: string) => client.get<{ ts: string; ok: boolean; latency_ms?: number | null; detail?: string | null; actor?: string | null }[]>(`/v1/platform/integrations/${id}/history`, company_id ? { company_id } : undefined),

  cajas: () => client.get<CajasResponse>("/v1/platform/cajas"),
  updateCaja: (id: string, body: { caja_nombre?: string; ip_address?: string | null; ip_pos_bancard?: string | null; ip_pos_dinelco?: string | null; activo?: boolean }) => client.put<{ ok: boolean }>(`/v1/platform/cajas/${id}`, body),
  createCaja: (body: { hostname: string; punto_emision: string; caja_nombre: string; ip_address?: string; ip_pos_bancard?: string; ip_pos_dinelco?: string }) => client.post<{ id: string }>("/v1/platform/cajas", body),
  deleteCaja: (id: string) => client.delete<void>(`/v1/platform/cajas/${id}`),
  pingCaja: (id: string, target: "dinelco" | "bancard" | "pc") => client.post<{ ip: string; port: number; ok: boolean; ms?: number; error?: string; greeting?: string | null }>(`/v1/platform/cajas/${id}/ping`, { target }),

  tenants: () => client.get<{ planes: string[]; estados: string[]; items: TenantItem[] }>("/v1/platform/tenants"),
  verticals: () => client.get<{ slug: string; nombre: string; descripcion?: string | null }[]>("/v1/platform/verticals"),
  updateTenant: (id: string, body: Partial<{ nombre: string; plan: string; estado: string; fecha_vencimiento: string | null; contacto_email: string | null; contacto_phone: string | null }>) =>
    client.put<{ ok: boolean; changed: string[] }>(`/v1/platform/tenants/${id}`, body),
  createTenant: (body: { nombre: string; slug: string; plan: string; vertical?: string; admin_nombre: string; admin_email: string; admin_password: string }) =>
    client.post<{ id: string; schema_name: string }>("/v1/platform/tenants", body),
}
