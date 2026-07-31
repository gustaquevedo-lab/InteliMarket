"""Purchase schemas — suppliers, orders, receipts, requisitions, contracts, forecasting, suggestions, budgets"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal


# ── Supplier ──────────────────────────────────────────────────────────────────

class SupplierCreate(BaseModel):
    company_id: UUID
    tipo_persona: str = "juridica"
    ruc: Optional[str] = Field(default=None, max_length=15)
    ci: Optional[str] = Field(default=None, max_length=20)
    razon_social: str = Field(min_length=2, max_length=255)
    condicion_iva: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    plazo_pago_dias: int = 0
    tipo_proveedor: str = "nacional"
    grupo: Optional[str] = None
    categoria_ids: Optional[list[UUID]] = None
    moneda_default: str = "PYG"
    plazo_entrega_promedio: int = 0
    notas: Optional[str] = None
    contacto_nombre: Optional[str] = None
    contacto_telefono: Optional[str] = None
    contacto_email: Optional[str] = None
    banco: Optional[str] = None
    cuenta_bancaria: Optional[str] = None
    tipo_contribuyente: Optional[str] = None
    retencion_irp: bool = False
    retencion_iva: bool = False


class SupplierUpdate(BaseModel):
    condicion_iva: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    plazo_pago_dias: Optional[int] = None
    activo: Optional[bool] = None
    tipo_proveedor: Optional[str] = None
    grupo: Optional[str] = None
    categoria_ids: Optional[list[UUID]] = None
    moneda_default: Optional[str] = None
    plazo_entrega_promedio: Optional[int] = None
    notas: Optional[str] = None
    contacto_nombre: Optional[str] = None
    contacto_telefono: Optional[str] = None
    contacto_email: Optional[str] = None
    banco: Optional[str] = None
    cuenta_bancaria: Optional[str] = None
    tipo_contribuyente: Optional[str] = None
    retencion_irp: Optional[bool] = None
    retencion_iva: Optional[bool] = None


class SupplierResponse(BaseModel):
    id: UUID
    company_id: UUID
    tipo_persona: str
    ruc: Optional[str] = None
    ci: Optional[str] = None
    razon_social: str
    condicion_iva: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    # Optional en vez de required-con-default: un default de Pydantic solo
    # aplica cuando el atributo esta AUSENTE, no cuando el ORM lo trae en
    # None explicito (que es el caso real para los 2.514 proveedores
    # migrados de Casa Gonzalito) — con estos como required, GET /suppliers
    # tiraba 500 para todos.
    plazo_pago_dias: Optional[int] = None
    activo: bool
    tipo_proveedor: Optional[str] = "nacional"
    grupo: Optional[str] = None
    categoria_ids: Optional[list[UUID]] = None
    moneda_default: Optional[str] = "PYG"
    plazo_entrega_promedio: Optional[int] = None
    rating: Optional[Decimal] = None
    notas: Optional[str] = None
    contacto_nombre: Optional[str] = None
    contacto_telefono: Optional[str] = None
    contacto_email: Optional[str] = None
    banco: Optional[str] = None
    cuenta_bancaria: Optional[str] = None
    tipo_contribuyente: Optional[str] = None
    retencion_irp: Optional[bool] = None
    retencion_iva: Optional[bool] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Purchase Order ────────────────────────────────────────────────────────────

class POItemInput(BaseModel):
    product_id: UUID
    variant_id: Optional[UUID] = None
    descripcion: Optional[str] = None
    cantidad: Decimal = Field(ge=Decimal("0.001"))
    precio_unitario: Decimal = Field(ge=0)
    descuento_pct: Decimal = Field(default=0, ge=0, le=100)
    iva_tasa: Optional[Decimal] = None
    warehouse_id: Optional[UUID] = None
    fecha_entrega_esperada: Optional[date] = None


class POCreate(BaseModel):
    company_id: UUID
    supplier_id: UUID
    fecha_entrega_estimada: Optional[date] = None
    moneda: str = "PYG"
    tipo_cambio: Decimal = Decimal("1")
    items: list[POItemInput]
    observaciones: Optional[str] = None
    user_id: Optional[UUID] = None
    tipo_compra: str = "local"
    prioridad: str = "normal"
    condiciones_pago: Optional[str] = None
    dias_validez: int = 30
    shipping_cost: Decimal = Decimal("0")
    insurance_cost: Decimal = Decimal("0")
    customs_cost: Decimal = Decimal("0")
    otros_costos: Decimal = Decimal("0")
    created_by_name: Optional[str] = None
    seguimiento_numero: Optional[str] = None


class POUpdate(BaseModel):
    supplier_id: Optional[UUID] = None
    fecha_entrega_estimada: Optional[date] = None
    moneda: Optional[str] = None
    tipo_cambio: Optional[Decimal] = None
    items: Optional[list[POItemInput]] = None
    observaciones: Optional[str] = None
    tipo_compra: Optional[str] = None
    prioridad: Optional[str] = None
    condiciones_pago: Optional[str] = None
    dias_validez: Optional[int] = None
    shipping_cost: Optional[Decimal] = None
    insurance_cost: Optional[Decimal] = None
    customs_cost: Optional[Decimal] = None
    otros_costos: Optional[Decimal] = None
    updated_by_name: Optional[str] = None


class SupplierSummary(BaseModel):
    id: UUID
    razon_social: str
    ruc: Optional[str] = None
    ci: Optional[str] = None

    class Config:
        from_attributes = True


class POResponse(BaseModel):
    id: UUID
    company_id: UUID
    supplier_id: UUID
    supplier: Optional[SupplierSummary] = None
    numero: str
    fecha: datetime
    fecha_entrega_estimada: Optional[date] = None
    estado: str
    moneda: str
    # NULL en las 106.726 ordenes migradas de Casa Gonzalito (el legacy no
    # maneja tipo de cambio) — required tiraba 500 en TODA la lista.
    tipo_cambio: Optional[Decimal] = None
    subtotal: Optional[Decimal] = None
    descuento_total: Optional[Decimal] = None
    iva_10: Optional[Decimal] = None
    iva_5: Optional[Decimal] = None
    total: Optional[Decimal] = None
    observaciones: Optional[str] = None
    user_id: Optional[UUID] = None
    tipo_compra: Optional[str] = None
    prioridad: Optional[str] = None
    condiciones_pago: Optional[str] = None
    dias_validez: Optional[int] = None
    shipping_cost: Optional[Decimal] = None
    insurance_cost: Optional[Decimal] = None
    customs_cost: Optional[Decimal] = None
    otros_costos: Optional[Decimal] = None
    costo_landed_total: Optional[Decimal] = None
    fecha_envio: Optional[datetime] = None
    fecha_confirmacion_proveedor: Optional[datetime] = None
    aprobado_por: Optional[UUID] = None
    fecha_aprobacion: Optional[datetime] = None
    rechazado_motivo: Optional[str] = None
    sugerencia_id: Optional[UUID] = None
    seguimiento_numero: Optional[str] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class POWithItems(POResponse):
    items: list["POItemResponse"] = []


class POItemResponse(BaseModel):
    id: UUID
    purchase_order_id: UUID
    product_id: UUID
    variant_id: Optional[UUID] = None
    descripcion: Optional[str] = None
    cantidad: Decimal
    cantidad_recibida: Optional[Decimal] = None
    precio_unitario: Decimal
    descuento_pct: Optional[Decimal] = None
    iva_tasa: Optional[Decimal] = None
    total: Decimal
    costo_unitario_estimado: Optional[Decimal] = None
    fecha_entrega_esperada: Optional[date] = None
    fecha_entrega_real: Optional[date] = None
    warehouse_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


class POHistoryResponse(BaseModel):
    id: UUID
    purchase_order_id: UUID
    estado_anterior: Optional[str] = None
    estado_nuevo: str
    cambiado_por: Optional[UUID] = None
    cambiado_por_nombre: Optional[str] = None
    observaciones: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Purchase Receipt ──────────────────────────────────────────────────────────

class ReceiptItemInput(BaseModel):
    product_id: UUID
    variant_id: Optional[UUID] = None
    cantidad_ordenada: Optional[Decimal] = None
    cantidad_recibida: Decimal = Field(ge=Decimal("0.001"))
    costo_unitario: Decimal = Field(ge=0)
    batch_id: Optional[UUID] = None


class ReceiptCreate(BaseModel):
    company_id: UUID
    purchase_order_id: Optional[UUID] = None
    warehouse_id: UUID
    proveedor_ref: Optional[str] = None
    items: list[ReceiptItemInput]
    observaciones: Optional[str] = None
    user_id: Optional[UUID] = None


class ReceiptResponse(BaseModel):
    id: UUID
    company_id: UUID
    purchase_order_id: Optional[UUID] = None
    warehouse_id: UUID
    numero: str
    fecha: datetime
    proveedor_ref: Optional[str] = None
    estado: str
    observaciones: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ReceiptWithItems(ReceiptResponse):
    items: list["ReceiptItemResponse"] = []


class ReceiptItemResponse(BaseModel):
    id: UUID
    receipt_id: UUID
    product_id: UUID
    variant_id: Optional[UUID] = None
    cantidad_ordenada: Optional[Decimal] = None
    cantidad_recibida: Decimal
    costo_unitario: Decimal
    batch_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Purchase Requisition ──────────────────────────────────────────────────────

class RequisitionItemInput(BaseModel):
    product_id: UUID
    variant_id: Optional[UUID] = None
    descripcion: Optional[str] = None
    cantidad_solicitada: Decimal = Field(ge=Decimal("0.001"))
    precio_estimado: Optional[Decimal] = None
    observaciones: Optional[str] = None


class RequisitionCreate(BaseModel):
    company_id: UUID
    fecha_necesidad: Optional[date] = None
    departamento: Optional[str] = None
    solicitante_id: Optional[UUID] = None
    solicitante_nombre: Optional[str] = None
    prioridad: str = "normal"
    moneda: str = "PYG"
    items: list[RequisitionItemInput]
    motivo: Optional[str] = None
    observaciones: Optional[str] = None
    user_id: Optional[UUID] = None


class RequisitionUpdate(BaseModel):
    fecha_necesidad: Optional[date] = None
    departamento: Optional[str] = None
    prioridad: Optional[str] = None
    items: Optional[list[RequisitionItemInput]] = None
    motivo: Optional[str] = None
    observaciones: Optional[str] = None
    rechazado_motivo: Optional[str] = None


class RequisitionResponse(BaseModel):
    id: UUID
    company_id: UUID
    numero: str
    fecha: datetime
    fecha_necesidad: Optional[date] = None
    departamento: Optional[str] = None
    solicitante_id: Optional[UUID] = None
    solicitante_nombre: Optional[str] = None
    estado: str
    prioridad: Optional[str] = None
    moneda: Optional[str] = None
    subtotal: Optional[Decimal] = None
    total: Optional[Decimal] = None
    motivo: Optional[str] = None
    observaciones: Optional[str] = None
    aprobado_por: Optional[UUID] = None
    fecha_aprobacion: Optional[datetime] = None
    rechazado_motivo: Optional[str] = None
    purchase_order_id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RequisitionWithItems(RequisitionResponse):
    items: list["RequisitionItemResponse"] = []


class RequisitionItemResponse(BaseModel):
    id: UUID
    requisition_id: UUID
    product_id: UUID
    variant_id: Optional[UUID] = None
    descripcion: Optional[str] = None
    cantidad_solicitada: Decimal
    cantidad_aprobada: Optional[Decimal] = None
    precio_estimado: Optional[Decimal] = None
    total_estimado: Optional[Decimal] = None
    observaciones: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Supplier Contract ─────────────────────────────────────────────────────────

class ContractItemInput(BaseModel):
    product_id: UUID
    variant_id: Optional[UUID] = None
    precio_acordado: Decimal = Field(ge=0)
    moneda: str = "PYG"
    cantidad_minima: Optional[Decimal] = None
    descuento_pct: Decimal = Field(default=0, ge=0, le=100)


class ContractCreate(BaseModel):
    company_id: UUID
    supplier_id: UUID
    nombre: Optional[str] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    moneda: str = "PYG"
    tipo_cambio_fijo: Optional[Decimal] = None
    condiciones_pago: Optional[str] = None
    plazo_entrega_dias: Optional[int] = None
    monto_minimo_mensual: Optional[Decimal] = None
    monto_maximo_mensual: Optional[Decimal] = None
    items: list[ContractItemInput]
    observaciones: Optional[str] = None
    user_id: Optional[UUID] = None


class ContractUpdate(BaseModel):
    nombre: Optional[str] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    moneda: Optional[str] = None
    tipo_cambio_fijo: Optional[Decimal] = None
    condiciones_pago: Optional[str] = None
    plazo_entrega_dias: Optional[int] = None
    monto_minimo_mensual: Optional[Decimal] = None
    monto_maximo_mensual: Optional[Decimal] = None
    activo: Optional[bool] = None
    items: Optional[list[ContractItemInput]] = None
    observaciones: Optional[str] = None


class ContractItemResponse(BaseModel):
    id: UUID
    contract_id: UUID
    product_id: UUID
    variant_id: Optional[UUID] = None
    precio_acordado: Decimal
    moneda: Optional[str] = None
    cantidad_minima: Optional[Decimal] = None
    descuento_pct: Optional[Decimal] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ContractResponse(BaseModel):
    id: UUID
    company_id: UUID
    supplier_id: UUID
    numero: str
    nombre: Optional[str] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    moneda: Optional[str] = None
    tipo_cambio_fijo: Optional[Decimal] = None
    condiciones_pago: Optional[str] = None
    plazo_entrega_dias: Optional[int] = None
    monto_minimo_mensual: Optional[Decimal] = None
    monto_maximo_mensual: Optional[Decimal] = None
    activo: bool
    observaciones: Optional[str] = None
    user_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    items: list[ContractItemResponse] = []

    class Config:
        from_attributes = True


# ── Supplier Evaluation ───────────────────────────────────────────────────────

class EvaluationCreate(BaseModel):
    company_id: UUID
    supplier_id: UUID
    periodo: Optional[str] = None
    puntaje_calidad: Optional[Decimal] = Field(default=None, ge=0, le=10)
    puntaje_entrega: Optional[Decimal] = Field(default=None, ge=0, le=10)
    puntaje_precio: Optional[Decimal] = Field(default=None, ge=0, le=10)
    puntaje_atencion: Optional[Decimal] = Field(default=None, ge=0, le=10)
    ordenes_completadas: Optional[int] = 0
    ordenes_totales: Optional[int] = 0
    entregas_a_tiempo: Optional[int] = 0
    entregas_totales: Optional[int] = 0
    comentarios: Optional[str] = None
    user_id: Optional[UUID] = None


class EvaluationResponse(BaseModel):
    id: UUID
    company_id: UUID
    supplier_id: UUID
    fecha: datetime
    periodo: Optional[str] = None
    puntaje_calidad: Optional[Decimal] = None
    puntaje_entrega: Optional[Decimal] = None
    puntaje_precio: Optional[Decimal] = None
    puntaje_atencion: Optional[Decimal] = None
    puntaje_total: Optional[Decimal] = None
    ordenes_completadas: Optional[int] = None
    ordenes_totales: Optional[int] = None
    entregas_a_tiempo: Optional[int] = None
    entregas_totales: Optional[int] = None
    comentarios: Optional[str] = None
    user_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SupplierPerformanceResponse(BaseModel):
    supplier_id: UUID
    razon_social: str
    total_orders: int
    total_spent: Decimal
    on_time_rate: Optional[Decimal] = None
    avg_quality_score: Optional[Decimal] = None
    avg_price_score: Optional[Decimal] = None
    avg_delivery_score: Optional[Decimal] = None
    avg_attention_score: Optional[Decimal] = None
    overall_rating: Optional[Decimal] = None
    last_evaluation_date: Optional[datetime] = None


# ── Supplier Price History ────────────────────────────────────────────────────

class PriceHistoryResponse(BaseModel):
    id: UUID
    supplier_id: UUID
    product_id: UUID
    precio: Decimal
    moneda: Optional[str] = None
    fecha: datetime
    purchase_order_id: Optional[UUID] = None
    notas: Optional[str] = None

    class Config:
        from_attributes = True


# ── Forecasting ───────────────────────────────────────────────────────────────

class ForecastRuleCreate(BaseModel):
    company_id: UUID
    nombre: str = Field(min_length=2, max_length=100)
    tipo: str = Field(min_length=2, max_length=30)
    product_id: Optional[UUID] = None
    categoria_id: Optional[UUID] = None
    metodo: str = "promedio_movil"
    dias_historial: int = 90
    dias_proyeccion: int = 30
    nivel_servicio: Decimal = Decimal("95")
    lead_time_dias: int = 7
    lead_time_variacion: int = 2
    stock_seguridad_dias: int = 7
    multiplo_pedido: Decimal = Decimal("1")
    minimo_pedido: Optional[Decimal] = None
    maximo_pedido: Optional[Decimal] = None
    stock_maximo: Optional[Decimal] = None
    stock_minimo: Optional[Decimal] = None
    proveedor_preferido_id: Optional[UUID] = None


class ForecastRuleUpdate(BaseModel):
    nombre: Optional[str] = None
    activo: Optional[bool] = None
    tipo: Optional[str] = None
    product_id: Optional[UUID] = None
    categoria_id: Optional[UUID] = None
    metodo: Optional[str] = None
    dias_historial: Optional[int] = None
    dias_proyeccion: Optional[int] = None
    nivel_servicio: Optional[Decimal] = None
    lead_time_dias: Optional[int] = None
    lead_time_variacion: Optional[int] = None
    stock_seguridad_dias: Optional[int] = None
    multiplo_pedido: Optional[Decimal] = None
    minimo_pedido: Optional[Decimal] = None
    maximo_pedido: Optional[Decimal] = None
    stock_maximo: Optional[Decimal] = None
    stock_minimo: Optional[Decimal] = None
    proveedor_preferido_id: Optional[UUID] = None


class ForecastRuleResponse(BaseModel):
    id: UUID
    company_id: UUID
    nombre: str
    activo: bool
    tipo: str
    product_id: Optional[UUID] = None
    categoria_id: Optional[UUID] = None
    metodo: Optional[str] = None
    dias_historial: Optional[int] = None
    dias_proyeccion: Optional[int] = None
    nivel_servicio: Optional[Decimal] = None
    lead_time_dias: Optional[int] = None
    lead_time_variacion: Optional[int] = None
    stock_seguridad_dias: Optional[int] = None
    multiplo_pedido: Optional[Decimal] = None
    minimo_pedido: Optional[Decimal] = None
    maximo_pedido: Optional[Decimal] = None
    stock_maximo: Optional[Decimal] = None
    stock_minimo: Optional[Decimal] = None
    proveedor_preferido_id: Optional[UUID] = None
    ultima_ejecucion: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ForecastProjectionResponse(BaseModel):
    id: UUID
    rule_id: Optional[UUID] = None
    product_id: UUID
    fecha_proyeccion: date
    demanda_pronosticada: Optional[Decimal] = None
    demanda_real: Optional[Decimal] = None
    confianza: Optional[Decimal] = None

    class Config:
        from_attributes = True


# ── Purchase Suggestions ──────────────────────────────────────────────────────

class PurchaseSuggestionResponse(BaseModel):
    id: UUID
    company_id: UUID
    product_id: UUID
    variant_id: Optional[UUID] = None
    supplier_id: Optional[UUID] = None
    cantidad_sugerida: Decimal
    precio_estimado: Optional[Decimal] = None
    total_estimado: Optional[Decimal] = None
    moneda: Optional[str] = None
    motivo: str
    detalle: Optional[str] = None
    urgencia: Optional[str] = None
    confianza: Optional[Decimal] = None
    stock_actual: Optional[Decimal] = None
    stock_seguridad: Optional[Decimal] = None
    demanda_diaria_promedio: Optional[Decimal] = None
    dias_cobertura: Optional[int] = None
    lead_time_dias: Optional[int] = None
    estado: Optional[str] = None
    purchase_order_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Purchase Budgets ──────────────────────────────────────────────────────────

class BudgetCreate(BaseModel):
    company_id: UUID
    nombre: str = Field(min_length=2, max_length=100)
    anio: int = Field(ge=2020, le=2100)
    mes: Optional[int] = Field(default=None, ge=1, le=12)
    tipo: str = "mensual"
    moneda: str = "PYG"
    monto_presupuestado: Decimal = Field(ge=0)
    categoria_id: Optional[UUID] = None
    departamento: Optional[str] = None
    observaciones: Optional[str] = None
    user_id: Optional[UUID] = None


class BudgetUpdate(BaseModel):
    nombre: Optional[str] = None
    monto_presupuestado: Optional[Decimal] = None
    activo: Optional[bool] = None
    observaciones: Optional[str] = None


class BudgetResponse(BaseModel):
    id: UUID
    company_id: UUID
    nombre: str
    anio: int
    mes: Optional[int] = None
    tipo: Optional[str] = None
    moneda: Optional[str] = None
    monto_presupuestado: Decimal
    monto_ejecutado: Optional[Decimal] = None
    monto_disponible: Optional[Decimal] = None
    categoria_id: Optional[UUID] = None
    departamento: Optional[str] = None
    activo: bool
    observaciones: Optional[str] = None
    user_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BudgetConsumptionResponse(BaseModel):
    budget_id: UUID
    nombre: str
    anio: int
    mes: Optional[int] = None
    monto_presupuestado: Decimal
    monto_ejecutado: Decimal
    monto_disponible: Decimal
    porcentaje_ejecutado: Decimal  # 0-100


# ── Reports ───────────────────────────────────────────────────────────────────

class SpendBySupplierResponse(BaseModel):
    supplier_id: UUID
    razon_social: str
    cantidad_ordenes: int
    total_gastado: Decimal
    moneda: str


class SpendByCategoryResponse(BaseModel):
    category_id: Optional[UUID] = None
    categoria_nombre: str
    cantidad_productos: int
    total_gastado: Decimal


class PriceVarianceResponse(BaseModel):
    product_id: UUID
    nombre: str
    average_price: Decimal
    min_price: Decimal
    max_price: Decimal
    variance_pct: Decimal  # ((max - min) / min) * 100
    last_purchase_date: Optional[datetime] = None
    last_supplier: Optional[str] = None


class PurchaseKPIsResponse(BaseModel):
    total_pos: int
    total_gastado: Decimal
    total_iva: Decimal
    prom_pedido: Decimal
    proveedores_activos: int
    ordenes_pendientes: int
    ordenes_atrasadas: int
    ahorro_estimado: Decimal
    cumplimiento_rate: Optional[Decimal] = None
 