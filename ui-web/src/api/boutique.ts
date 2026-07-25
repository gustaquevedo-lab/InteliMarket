import { client } from "./index"

// ==================== Shared ====================
export interface PaginatedRes<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

// ==================== Dashboard ====================
export interface DashboardData {
  total_productos: number
  total_variantes: number
  total_ventas_mes: number
  total_ingresos_mes: number
  total_clientes: number
  devoluciones_mes: number
  productos_bajo_stock: number
  variantes_con_markdown: number
  loyalty_puntos_emitidos: number
}

// ==================== Sizes ====================
export interface BoutSize {
  id: string; company_id: string; codigo: string; nombre: string
  categoria?: string; orden?: number; medida_referencia_cm?: number
  activo?: boolean; created_at: string
}

// ==================== Colors ====================
export interface BoutColor {
  id: string; company_id: string; codigo: string; nombre: string
  hex?: string; familia?: string; es_basico?: boolean; orden?: number
  activo?: boolean; created_at: string
}

// ==================== Categories ====================
export interface BoutCategory {
  id: string; company_id: string; codigo: string; nombre: string
  descripcion?: string; parent_id?: string; nivel?: number
  activo?: boolean; imagen_url?: string; orden?: number
  children?: BoutCategory[]; created_at: string
}

// ==================== Collections ====================
export interface BoutCollection {
  id: string; company_id: string; codigo: string; nombre: string
  descripcion?: string; temporada: string; anio: number
  fecha_inicio?: string; fecha_fin?: string; estado?: string
  imagen_url?: string; created_at: string; updated_at?: string
}

// ==================== Products & Variants ====================
export interface BoutVariant {
  id: string; size_id?: string; color_id?: string; sku: string
  ean?: string; precio_sobrecargo?: number; stock_actual?: number
  stock_minimo?: number; stock_disponible?: number
  precio_final?: number; activo?: boolean; created_at: string
  updated_at?: string
}

export interface BoutProduct {
  id: string; company_id: string; codigo: string; nombre: string
  descripcion?: string; categoria_id?: string; tipo_producto?: string
  genero?: string; marca?: string; material?: string; cuidados?: string
  precio_base: number; costo_promedio?: number; moneda?: string
  imagen_principal?: string; imagenes_adicionales?: any[]
  tags?: string[]; activo?: boolean; destacado?: boolean
  incluye_gift_wrapping?: boolean; gift_wrapping_surcharge?: number
  meta_title?: string; meta_description?: string
  variantes?: BoutVariant[]; created_at: string; updated_at?: string
}

// ==================== Sales ====================
export interface BoutSaleItem {
  id?: string; producto_id?: string; variant_id?: string
  cantidad: number; precio_unitario: number; descuento_item?: number
}

export interface BoutSale {
  id: string; company_id: string; codigo: string; customer_id: string
  fecha: string; subtotal: number; descuento: number; impuesto: number
  total: number; moneda: string; tipo_venta: string
  incluye_gift_wrapping?: boolean; gift_wrapping_fee?: number
  notas?: string; external_order_id?: string; created_at: string
}

// ==================== Returns ====================
export interface BoutReturnItem {
  sale_item_id?: string; variant_id: string; cantidad: number; motivo?: string
}

export interface BoutReturn {
  id: string; codigo: string; customer_id: string; fecha: string
  motivo: string; estado: string; total_reintegro?: number; created_at: string
}

// ==================== Clienteling ====================
export interface BoutClientProfile {
  id: string; customer_id: string; tipo_cliente?: string
  genero_preferido?: string; talla_preferida_id?: string
  color_preferido_id?: string; marcas_preferidas?: string[]
  estilo?: string; temporada_preferida?: string
  cumpleanos?: string; aniversario?: string; notas_estilista?: string
  total_gastado: number; total_compras: number
  ultima_visita?: string; created_at: string
}

export interface BoutInteraction {
  id: string; customer_id: string; tipo: string; fecha: string
  canal?: string; notas?: string; created_at: string
}

export interface BoutMeasurement {
  id: string; customer_id: string; contorno_busto?: number
  contorno_cintura?: number; contorno_cadera?: number
  largo_espalda?: number; largo_manga?: number; talle?: string
  tipo_prenda?: string; notas?: string; fecha_tomada?: string
  created_at: string
}

// ==================== Loyalty ====================
export interface BoutLoyaltyConfig {
  id?: string; puntos_por_1000?: number; multiplier_bronze?: number
  multiplier_plata?: number; multiplier_oro?: number
  multiplier_platino?: number; canje_1000_puntos?: number
  gasto_minimo_canje?: number; created_at?: string
}

export interface BoutLoyaltyAccount {
  id: string; customer_id: string; tier_id?: string
  puntos_acumulados: number; puntos_canjeados: number
  puntos_disponibles: number; gasto_total: number
}

export interface BoutLoyaltyTier {
  id: string; nombre: string; nivel: number; gasto_minimo: number
  multiplier_acumulacion: number; multiplier_canje: number
  color?: string; created_at: string
}

// ==================== Markdown ====================
export interface BoutMarkdownRule {
  id: string; company_id: string; codigo: string; nombre: string
  tipo: string; temporada?: string; categoria_id?: string
  descuento_maximo?: number; descuento_minimo?: number
  dias_antes_fin_temporada?: number; factor_rotacion_minimo?: number
  activo?: boolean; prioridad?: number; created_at: string
}

// ==================== AR Metadata ====================
export interface BoutARMetadata {
  id: string; producto_id: string; modelo_3d_url?: string
  glb_url?: string; usdz_url?: string
  talles_disponibles_ar?: string[]; proveedor_ar?: string
}

// ==================== Gift Wrapping ====================
export interface BoutGiftWrap {
  id: string; codigo: string; nombre: string; precio: number
  imagen_url?: string; activo?: boolean; created_at?: string
}

// ==================== Events ====================
export interface BoutEvent {
  id: string; company_id: string; codigo: string; nombre: string
  tipo?: string; descripcion?: string; fecha_inicio: string
  fecha_fin?: string; ubicacion?: string; capacidad_maxima?: number
  invitados?: number; estado?: string; imagen_url?: string
  created_at: string; updated_at?: string
}

export interface BoutEventGuest {
  id: string; event_id: string; customer_id: string
  confirmado?: boolean; asistio?: boolean; acompanantes?: number
  notas?: string; created_at: string
}

// ==================== Stock Movements ====================
export interface BoutStockMovement {
  id: string; variant_id: string; tipo: string; cantidad: number
  motivo?: string; created_at: string
}

// ==================== Pedidos (legacy) ====================
export interface PedidoItem {
  id?: string; pedido_id?: string; producto_id?: string
  producto_data?: string; cantidad: number; precio_unitario: number
  iva_tasa?: number; subtotal?: number
}

export interface Pedido {
  id: string; company_id?: string; numero: string; fecha?: string
  estado: string; customer_id?: string; customer_data?: string
  tipo_comprobante?: string; direccion_entrega?: string
  coordenadas?: string; fecha_entrega_solicitada?: string
  observaciones?: string; subtotal?: number; total_iva?: number
  total?: number; moneda?: string; intelientregas_delivery_id?: string
  sale_id?: string; items?: PedidoItem[]; created_at?: string; updated_at?: string
}

// ==================== Cross-sell / Recommendations ====================
export interface BoutCrossSellItem {
  producto_id: string; nombre: string; precio_base: number
  imagen_principal?: string; support?: number; confidence?: number; lift?: number
}

// ==================== API ====================
const BASE = "/v1/boutique"

export const boutiqueApi = {
  // === Dashboard ===
  getDashboard: () => client.get<DashboardData>(`${BASE}/dashboard`),

  // === Sizes ===
  listSizes: (params?: { categoria?: string; activo?: boolean }) =>
    client.get<BoutSize[]>(`${BASE}/sizes`, params as any),
  getSize: (id: string) => client.get<BoutSize>(`${BASE}/sizes/${id}`),
  createSize: (data: any) => client.post<BoutSize>(`${BASE}/sizes`, data),
  updateSize: (id: string, data: any) => client.put<BoutSize>(`${BASE}/sizes/${id}`, data),
  deleteSize: (id: string) => client.delete<void>(`${BASE}/sizes/${id}`),

  // === Colors ===
  listColors: (params?: { familia?: string; activo?: boolean }) =>
    client.get<BoutColor[]>(`${BASE}/colors`, params as any),
  getColor: (id: string) => client.get<BoutColor>(`${BASE}/colors/${id}`),
  createColor: (data: any) => client.post<BoutColor>(`${BASE}/colors`, data),
  updateColor: (id: string, data: any) => client.put<BoutColor>(`${BASE}/colors/${id}`, data),
  deleteColor: (id: string) => client.delete<void>(`${BASE}/colors/${id}`),

  // === Categories ===
  listCategories: (params?: { activo?: boolean }) =>
    client.get<BoutCategory[]>(`${BASE}/categories`, params as any),
  getCategory: (id: string) => client.get<BoutCategory>(`${BASE}/categories/${id}`),
  createCategory: (data: any) => client.post<BoutCategory>(`${BASE}/categories`, data),
  updateCategory: (id: string, data: any) => client.put<BoutCategory>(`${BASE}/categories/${id}`, data),
  deleteCategory: (id: string) => client.delete<void>(`${BASE}/categories/${id}`),

  // === Collections ===
  listCollections: (params?: { temporada?: string; estado?: string }) =>
    client.get<BoutCollection[]>(`${BASE}/collections`, params as any),
  getCollection: (id: string) => client.get<BoutCollection>(`${BASE}/collections/${id}`),
  createCollection: (data: any) => client.post<BoutCollection>(`${BASE}/collections`, data),
  updateCollection: (id: string, data: any) => client.put<BoutCollection>(`${BASE}/collections/${id}`, data),
  deleteCollection: (id: string) => client.delete<void>(`${BASE}/collections/${id}`),

  // === Products ===
  listProducts: (params?: { categoria_id?: string; genero?: string; marca?: string; activo?: boolean; destacado?: boolean; page?: number; page_size?: number }) =>
    client.get<PaginatedRes<BoutProduct>>(`${BASE}/products`, params as any),
  getProduct: (id: string) => client.get<BoutProduct>(`${BASE}/products/${id}`),
  createProduct: (data: any) => client.post<BoutProduct>(`${BASE}/products`, data),
  updateProduct: (id: string, data: any) => client.put<BoutProduct>(`${BASE}/products/${id}`, data),
  deleteProduct: (id: string) => client.delete<void>(`${BASE}/products/${id}`),

  // === Variants ===
  createVariant: (productId: string, data: any) =>
    client.post<BoutVariant>(`${BASE}/products/${productId}/variants`, data),
  updateVariantStock: (variantId: string, delta: number) =>
    client.post<any>(`${BASE}/variants/${variantId}/stock?delta=${delta}`, {}),
  transferStock: (fromVariantId: string, toVariantId: string, cantidad: number) =>
    client.post<any>(`${BASE}/variants/transfer?from_variant_id=${fromVariantId}&to_variant_id=${toVariantId}&cantidad=${cantidad}`, {}),
  listStockMovements: (variantId: string, params?: { page?: number; page_size?: number }) =>
    client.get<PaginatedRes<BoutStockMovement>>(`${BASE}/variants/${variantId}/movements`, params as any),

  // === Sales ===
  listSales: (params?: { customer_id?: string; page?: number; page_size?: number }) =>
    client.get<PaginatedRes<BoutSale>>(`${BASE}/sales`, params as any),
  getSale: (id: string) => client.get<BoutSale>(`${BASE}/sales/${id}`),
  createSale: (data: any) => client.post<BoutSale>(`${BASE}/sales`, data),

  // === Returns ===
  listReturns: (params?: { customer_id?: string; page?: number; page_size?: number }) =>
    client.get<PaginatedRes<BoutReturn>>(`${BASE}/returns`, params as any),
  createReturn: (data: any) => client.post<BoutReturn>(`${BASE}/returns`, data),

  // === Client Profiles ===
  listClientProfiles: (params?: { estilo?: string; page?: number; page_size?: number }) =>
    client.get<PaginatedRes<BoutClientProfile>>(`${BASE}/client-profiles`, params as any),
  getClientProfile: (customerId: string) =>
    client.get<BoutClientProfile>(`${BASE}/client-profiles/${customerId}`),
  upsertClientProfile: (customerId: string, data: any) =>
    client.put<BoutClientProfile>(`${BASE}/client-profiles/${customerId}`, data),

  // === Interactions ===
  listInteractions: (customerId: string, params?: { page?: number; page_size?: number }) =>
    client.get<PaginatedRes<BoutInteraction>>(`${BASE}/interactions/${customerId}`, params as any),
  createInteraction: (data: any) => client.post<BoutInteraction>(`${BASE}/interactions`, data),

  // === Measurements ===
  getMeasurements: (customerId: string) =>
    client.get<BoutMeasurement[]>(`${BASE}/measurements/${customerId}`),
  createMeasurement: (data: any) => client.post<BoutMeasurement>(`${BASE}/measurements`, data),

  // === Loyalty ===
  getLoyaltyConfig: () => client.get<BoutLoyaltyConfig>(`${BASE}/loyalty/config`),
  createLoyaltyConfig: () => client.post<BoutLoyaltyConfig>(`${BASE}/loyalty/config`, {}),
  getLoyaltyAccount: (customerId: string) =>
    client.get<BoutLoyaltyAccount>(`${BASE}/loyalty/accounts/${customerId}`),
  upsertLoyaltyAccount: (customerId: string) =>
    client.post<BoutLoyaltyAccount>(`${BASE}/loyalty/accounts/${customerId}/upsert`, {}),
  recalculateTier: (customerId: string) =>
    client.post<BoutLoyaltyAccount>(`${BASE}/loyalty/accounts/${customerId}/recalculate-tier`, {}),
  redeemPoints: (customerId: string, puntos: number) =>
    client.post<any>(`${BASE}/loyalty/accounts/${customerId}/redeem?puntos=${puntos}`, {}),

  // === Markdown ===
  listMarkdownRules: () => client.get<BoutMarkdownRule[]>(`${BASE}/markdown/rules`),
  createMarkdownRule: (data: any) => client.post<BoutMarkdownRule>(`${BASE}/markdown/rules`, data),
  applyMarkdown: (ruleId: string) => client.post<any>(`${BASE}/markdown/rules/${ruleId}/apply`, {}),

  // === AR Metadata ===
  getARMetadata: (productoId: string) =>
    client.get<BoutARMetadata>(`${BASE}/ar/${productoId}`),
  upsertARMetadata: (productoId: string, data: any) =>
    client.put<BoutARMetadata>(`${BASE}/ar/${productoId}`, data),

  // === Cross-sell / Recommendations ===
  getCrossSell: (productoId: string, limit?: number) =>
    client.get<BoutCrossSellItem[]>(`${BASE}/cross-sell/${productoId}`, { limit } as any),
  getRecommendations: (customerId: string, limit?: number) =>
    client.get<BoutCrossSellItem[]>(`${BASE}/recommendations/${customerId}`, { limit } as any),

  // === Gift Wrapping ===
  listGiftWrapping: () => client.get<BoutGiftWrap[]>(`${BASE}/gift-wrapping`),
  createGiftWrapping: (data: any) => client.post<BoutGiftWrap>(`${BASE}/gift-wrapping`, data),

  // === Events ===
  listEvents: () => client.get<BoutEvent[]>(`${BASE}/events`),
  createEvent: (data: any) => client.post<BoutEvent>(`${BASE}/events`, data),
  listEventGuests: (eventId: string) =>
    client.get<BoutEventGuest[]>(`${BASE}/events/${eventId}/guests`),
  addEventGuest: (eventId: string, data: any) =>
    client.post<BoutEventGuest>(`${BASE}/events/${eventId}/guests`, data),

  // === Pedidos (legacy) ===
  list: (params?: { estado?: string; search?: string }) =>
    client.get<Pedido[]>(`${BASE}/pedidos`, params as any),
  get: (id: string) => client.get<Pedido>(`${BASE}/pedidos/${id}`),
  create: (data: any) => client.post<Pedido>(`${BASE}/pedidos`, data),
  update: (id: string, data: any) => client.patch<Pedido>(`${BASE}/pedidos/${id}`, data),
  delete: (id: string) => client.delete<void>(`${BASE}/pedidos/${id}`),
  assignDelivery: (id: string, data: any) =>
    client.post<Pedido>(`${BASE}/pedidos/${id}/assign-delivery`, data),
  approve: (id: string, data: any) =>
    client.post<Pedido>(`${BASE}/pedidos/${id}/approve`, data),
  rendir: (pedidoId: string, data: any) =>
    client.post<Pedido>(`${BASE}/pedidos/${pedidoId}/rendir`, data),
  printData: (id: string) => client.get<any>(`${BASE}/pedidos/${id}/print`),
}
