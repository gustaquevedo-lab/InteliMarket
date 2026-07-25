"""Distribuidora — Pydantic schemas."""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


# ─── Supplier Agreements ─────────────────────────────────────

class SupplierAgreementCreate(BaseModel):
    supplier_id: UUID
    numero: str
    nombre: str
    tipo: str = "compra"
    fecha_inicio: date
    fecha_fin: date
    renovacion_automatica: bool = False
    descuento_general_pct: Decimal = Decimal("0")
    bono_volumen_pct: Decimal = Decimal("0")
    dias_credito: int = 0
    moneda: str = "PYG"
    condiciones: Optional[str] = None


class SupplierAgreementUpdate(BaseModel):
    descuento_general_pct: Optional[Decimal] = None
    bono_volumen_pct: Optional[Decimal] = None
    dias_credito: Optional[int] = None
    estado: Optional[str] = None
    condiciones: Optional[str] = None


class SupplierAgreementItemCreate(BaseModel):
    product_id: UUID
    precio_especial: Optional[Decimal] = None
    descuento_pct: Decimal = Decimal("0")
    cantidad_minima: Decimal = Decimal("0")
    bono_pct: Decimal = Decimal("0")


class SupplierAgreementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID; company_id: UUID; supplier_id: UUID
    numero: str; nombre: str; tipo: str
    fecha_inicio: date; fecha_fin: date
    renovacion_automatica: bool
    descuento_general_pct: Decimal; bono_volumen_pct: Decimal
    dias_credito: int; moneda: str
    estado: str; condiciones: Optional[str]
    archivo_url: Optional[str]; created_at: datetime


# ─── PO Approval ──────────────────────────────────────────────

class POApprovalConfigCreate(BaseModel):
    requiere_aprobacion: bool = True
    monto_maximo_sin_aprobacion: Decimal = Decimal("0")
    niveles_aprobacion: int = 1
    aprobadores_nivel1: Optional[list[UUID]] = None
    aprobadores_nivel2: Optional[list[UUID]] = None
    monto_maximo_nivel1: Decimal = Decimal("0")


class POApprovalConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID; company_id: UUID
    requiere_aprobacion: bool
    monto_maximo_sin_aprobacion: Decimal
    niveles_aprobacion: int
    aprobadores_nivel1: Optional[list]
    aprobadores_nivel2: Optional[list]
    monto_maximo_nivel1: Decimal


class POApproveReject(BaseModel):
    aprobador_id: UUID
    motivo_rechazo: Optional[str] = None
    comentarios: Optional[str] = None


class POApprovalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID; purchase_order_id: UUID; company_id: UUID
    nivel: int; estado: str
    aprobador_id: UUID; fecha_decision: Optional[datetime]
    motivo_rechazo: Optional[str]; comentarios: Optional[str]
    created_at: datetime


# ─── Import Container (enhanced) ──────────────────────────────

class ImportContainerCreate(BaseModel):
    supplier_id: UUID
    purchase_order_id: Optional[UUID] = None
    numero_contenedor: str
    booking: Optional[str] = None
    viaje: Optional[str] = None
    conocimiento_embarque: Optional[str] = None
    puerto_origen: str
    puerto_destino: str
    incoterm: str = "FOB"
    fecha_zarpe: Optional[date] = None
    fecha_llegada: Optional[date] = None
    fecha_estiba: Optional[date] = None
    proveedor_transporte: Optional[str] = None
    agente_aduanero: Optional[str] = None
    moneda_origen: str = "USD"
    tipo_cambio: Decimal = Decimal("1")
    notas: Optional[str] = None


class ImportContainerUpdate(BaseModel):
    estado: Optional[str] = None
    fecha_llegada: Optional[date] = None
    fecha_estiba: Optional[date] = None
    fecha_nacionalizacion: Optional[date] = None
    flete_total: Optional[Decimal] = None
    seguro_total: Optional[Decimal] = None
    arancel_total: Optional[Decimal] = None
    desaduanamiento_total: Optional[Decimal] = None
    almacenaje_total: Optional[Decimal] = None
    transporte_local_total: Optional[Decimal] = None
    otros_costos: Optional[list] = None
    notas: Optional[str] = None


class ImportContainerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID; company_id: UUID; supplier_id: UUID
    purchase_order_id: Optional[UUID]
    numero_contenedor: str; booking: Optional[str]; viaje: Optional[str]
    conocimiento_embarque: Optional[str]
    puerto_origen: str; puerto_destino: str; incoterm: str
    fecha_zarpe: Optional[date]; fecha_llegada: Optional[date]
    fecha_estiba: Optional[date]; fecha_nacionalizacion: Optional[date]
    estado: str; proveedor_transporte: Optional[str]
    agente_aduanero: Optional[str]; referencia_aduana: Optional[str]
    moneda_origen: str; tipo_cambio: Decimal
    valor_fob_total: Decimal; flete_total: Decimal; seguro_total: Decimal
    arancel_total: Decimal; desaduanamiento_total: Decimal
    almacenaje_total: Decimal; transporte_local_total: Decimal
    otros_costos_total: Decimal; costo_landed_total: Decimal
    notas: Optional[str]; created_at: datetime


class ImportItemCreate(BaseModel):
    product_id: UUID
    purchase_order_item_id: Optional[UUID] = None
    cantidad: Decimal
    unidad_medida: str = "UN"
    precio_unitario_fob: Decimal


class ImportItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID; container_id: UUID; product_id: UUID
    purchase_order_item_id: Optional[UUID]
    cantidad: Decimal; unidad_medida: str
    precio_unitario_fob: Decimal; costo_unitario_flete: Decimal
    costo_unitario_seguro: Decimal; costo_unitario_arancel: Decimal
    costo_unitario_desaduanamiento: Decimal
    costo_unitario_almacenaje: Decimal
    costo_unitario_transporte_local: Decimal
    costo_unitario_otros: Decimal; costo_unitario_landed: Decimal


# ─── Reconciliation ──────────────────────────────────────────

class ReconcileInput(BaseModel):
    purchase_order_id: UUID


class ReconcileResponse(BaseModel):
    container_id: UUID
    purchase_order_id: UUID
    items_reconciled: int
    diferencias: list[dict]


# ─── Customer Agreements ─────────────────────────────────────

class CustomerAgreementCreate(BaseModel):
    customer_id: UUID
    numero: str
    nombre: str
    tipo: str = "precio_especial"
    fecha_inicio: date
    fecha_fin: date
    renovacion_automatica: bool = False
    descuento_general_pct: Decimal = Decimal("0")
    plazo_pago_dias: int = 0
    limite_credito: Decimal = Decimal("0")
    moneda: str = "PYG"
    observaciones: Optional[str] = None


class CustomerAgreementItemCreate(BaseModel):
    product_id: UUID
    precio_especial: Optional[Decimal] = None
    descuento_pct: Decimal = Decimal("0")
    cantidad_minima: Decimal = Decimal("0")


class CustomerAgreementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID; company_id: UUID; customer_id: UUID
    numero: str; nombre: str; tipo: str
    fecha_inicio: date; fecha_fin: date
    renovacion_automatica: bool; descuento_general_pct: Decimal
    plazo_pago_dias: int; limite_credito: Decimal
    moneda: str; estado: str; observaciones: Optional[str]
    archivo_url: Optional[str]; created_at: datetime


# ─── Sales Routes ────────────────────────────────────────────

class SalesRouteCreate(BaseModel):
    nombre: str
    codigo: Optional[str] = None
    user_id: UUID
    dias_semana: Optional[list[int]] = None
    zona: Optional[str] = None


class RouteCustomerCreate(BaseModel):
    customer_id: UUID
    orden_visita: int = 0
    dia_semana: Optional[int] = None


class RouteVisitCreate(BaseModel):
    route_customer_id: Optional[UUID] = None
    customer_id: UUID
    fecha_planificada: date
    estado: str = "pendiente"


class RouteVisitComplete(BaseModel):
    estado: str = "visitado"
    resultado: Optional[str] = None
    monto_cobrado: Decimal = Decimal("0")
    notas: Optional[str] = None
    latitud: Optional[Decimal] = None
    longitud: Optional[Decimal] = None
    fotos_url: Optional[list[str]] = None
    firma_url: Optional[str] = None


class SalesRouteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID; company_id: UUID; nombre: str; codigo: Optional[str]
    user_id: UUID; dias_semana: Optional[list]; zona: Optional[str]
    estado: str; created_at: datetime


# ─── Credit ──────────────────────────────────────────────────

class CreditLimitUpdate(BaseModel):
    limite_credito: Decimal
    dias_credito: int = 0


class CreditAuthorizationCreate(BaseModel):
    customer_id: UUID
    monto_solicitado: Decimal
    motivo: str


class CreditAuthorizationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID; company_id: UUID; customer_id: UUID
    monto_solicitado: Decimal; monto_autorizado: Optional[Decimal]
    motivo: Optional[str]; estado: str; created_at: datetime


# ─── Margin / Profitability ──────────────────────────────────

class ProductMargin(BaseModel):
    product_id: UUID
    product_name: str
    sku: str
    costo_unitario: Decimal
    precio_venta: Decimal
    margen_bruto: Decimal
    margen_pct: Decimal
    vendido_mes: Decimal
    ganancia_mes: Decimal


class RouteProfitability(BaseModel):
    route_id: UUID
    route_name: str
    vendedor_id: UUID
    vendedor_nombre: str
    total_visitas: int
    visitas_completadas: int
    monto_vendido: Decimal
    margen_promedio: Decimal
    ganancia_total: Decimal


class CustomerProfitability(BaseModel):
    customer_id: UUID
    customer_name: str
    total_ventas: Decimal
    margen_promedio: Decimal
    ganancia_total: Decimal
    frecuencia_compra_dias: int
    ultima_compra: Optional[date]


# ─── Dashboard ───────────────────────────────────────────────

class DistribuidoraDashboard(BaseModel):
    total_clientes: int
    clientes_con_credito: int
    clientes_bloqueados: int
    ventas_mes: Decimal
    margen_promedio: Decimal
    facturas_vencidas: int
    monto_vencido: Decimal
    contenedores_en_transito: int
    contenedores_en_aduanas: int
    productos_bajo_stock: int
    visitas_hoy: int
    visitas_completadas_hoy: int
    costo_landed_pendiente: int
    po_pendientes_aprobacion: int
