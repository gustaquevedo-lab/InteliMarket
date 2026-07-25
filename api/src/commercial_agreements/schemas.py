"""Commercial Agreement schemas"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal


class AgreementItemInput(BaseModel):
    product_id: UUID
    variant_id: Optional[UUID] = None
    descripcion: Optional[str] = None
    precio_acordado: Decimal = Field(ge=0)
    precio_lista: Optional[Decimal] = None
    descuento_pct: Decimal = Field(default=0, ge=0, le=100)
    moneda: str = "PYG"
    tipo_precio: Optional[str] = None
    cantidad_minima: Optional[Decimal] = None
    cantidad_multiple: Optional[Decimal] = None
    iva_tasa: Decimal = Decimal("10")
    incluye_iva: bool = True
    lead_time_dias: Optional[int] = None


class AgreementItemUpdate(BaseModel):
    variant_id: Optional[UUID] = None
    descripcion: Optional[str] = None
    precio_acordado: Optional[Decimal] = None
    precio_lista: Optional[Decimal] = None
    descuento_pct: Optional[Decimal] = None
    moneda: Optional[str] = None
    tipo_precio: Optional[str] = None
    cantidad_minima: Optional[Decimal] = None
    cantidad_multiple: Optional[Decimal] = None
    iva_tasa: Optional[Decimal] = None
    incluye_iva: Optional[bool] = None
    lead_time_dias: Optional[int] = None


class AgreementItemResponse(BaseModel):
    id: UUID
    agreement_id: UUID
    product_id: UUID
    variant_id: Optional[UUID] = None
    descripcion: Optional[str] = None
    precio_acordado: Decimal
    precio_lista: Optional[Decimal] = None
    descuento_pct: Optional[Decimal] = None
    moneda: str
    tipo_precio: Optional[str] = None
    cantidad_minima: Optional[Decimal] = None
    cantidad_multiple: Optional[Decimal] = None
    iva_tasa: Decimal
    incluye_iva: bool
    lead_time_dias: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AgreementCreate(BaseModel):
    company_id: UUID
    supplier_id: UUID
    nombre: str = Field(min_length=2, max_length=200)
    tipo: str = Field(min_length=2, max_length=30)
    estado: Optional[str] = "borrador"
    prioridad: Optional[str] = "normal"
    fecha_inicio: date
    fecha_fin: date
    dias_aviso_renovacion: int = 30
    condiciones_pago: Optional[str] = None
    plazo_pago_dias: int = 30
    moneda: str = "PYG"
    tipo_cambio_fijo: Optional[Decimal] = None
    forma_pago: Optional[str] = None
    aplica_iragru: bool = False
    tasa_iragru: Optional[Decimal] = None
    aplica_retencion_iva: bool = False
    tasa_retencion_iva: Optional[Decimal] = None
    categoria_retencion: Optional[str] = None
    exclusividad: bool = False
    zona_exclusividad: Optional[str] = None
    tipo_envio: Optional[str] = None
    porto_destino: Optional[str] = None
    monto_minimo_orden: Optional[Decimal] = None
    monto_maximo_orden: Optional[Decimal] = None
    monto_total_acordado: Optional[Decimal] = None
    volumen_minimo_mensual: Optional[Decimal] = None
    unidad_medida: Optional[str] = None
    aplica_rebate: bool = False
    tipo_rebate: Optional[str] = None
    umbral_rebate_1: Optional[Decimal] = None
    porcentaje_rebate_1: Optional[Decimal] = None
    umbral_rebate_2: Optional[Decimal] = None
    porcentaje_rebate_2: Optional[Decimal] = None
    umbral_rebate_3: Optional[Decimal] = None
    porcentaje_rebate_3: Optional[Decimal] = None
    frecuencia_liquidacion_rebate: Optional[str] = None
    multa_incumplimiento: Optional[Decimal] = None
    bonificacion_cumplimiento: Optional[Decimal] = None
    nota_penalidad: Optional[str] = None
    objeto: Optional[str] = None
    observaciones: Optional[str] = None
    user_id: Optional[UUID] = None
    items: list[AgreementItemInput] = []


class AgreementUpdate(BaseModel):
    nombre: Optional[str] = None
    tipo: Optional[str] = None
    estado: Optional[str] = None
    prioridad: Optional[str] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    dias_aviso_renovacion: Optional[int] = None
    condiciones_pago: Optional[str] = None
    plazo_pago_dias: Optional[int] = None
    moneda: Optional[str] = None
    tipo_cambio_fijo: Optional[Decimal] = None
    forma_pago: Optional[str] = None
    aplica_iragru: Optional[bool] = None
    tasa_iragru: Optional[Decimal] = None
    aplica_retencion_iva: Optional[bool] = None
    tasa_retencion_iva: Optional[Decimal] = None
    categoria_retencion: Optional[str] = None
    exclusividad: Optional[bool] = None
    zona_exclusividad: Optional[str] = None
    tipo_envio: Optional[str] = None
    porto_destino: Optional[str] = None
    monto_minimo_orden: Optional[Decimal] = None
    monto_maximo_orden: Optional[Decimal] = None
    monto_total_acordado: Optional[Decimal] = None
    volumen_minimo_mensual: Optional[Decimal] = None
    unidad_medida: Optional[str] = None
    aplica_rebate: Optional[bool] = None
    tipo_rebate: Optional[str] = None
    umbral_rebate_1: Optional[Decimal] = None
    porcentaje_rebate_1: Optional[Decimal] = None
    umbral_rebate_2: Optional[Decimal] = None
    porcentaje_rebate_2: Optional[Decimal] = None
    umbral_rebate_3: Optional[Decimal] = None
    porcentaje_rebate_3: Optional[Decimal] = None
    frecuencia_liquidacion_rebate: Optional[str] = None
    multa_incumplimiento: Optional[Decimal] = None
    bonificacion_cumplimiento: Optional[Decimal] = None
    nota_penalidad: Optional[str] = None
    objeto: Optional[str] = None
    observaciones: Optional[str] = None


class AgreementResponse(BaseModel):
    id: UUID
    company_id: UUID
    supplier_id: UUID
    numero: str
    nombre: str
    tipo: str
    estado: str
    prioridad: str
    fecha_inicio: date
    fecha_fin: date
    dias_aviso_renovacion: int
    condiciones_pago: Optional[str] = None
    plazo_pago_dias: int
    moneda: str
    tipo_cambio_fijo: Optional[Decimal] = None
    forma_pago: Optional[str] = None
    aplica_iragru: bool
    tasa_iragru: Optional[Decimal] = None
    aplica_retencion_iva: bool
    tasa_retencion_iva: Optional[Decimal] = None
    categoria_retencion: Optional[str] = None
    exclusividad: bool
    zona_exclusividad: Optional[str] = None
    tipo_envio: Optional[str] = None
    porto_destino: Optional[str] = None
    monto_minimo_orden: Optional[Decimal] = None
    monto_maximo_orden: Optional[Decimal] = None
    monto_total_acordado: Optional[Decimal] = None
    monto_ejecutado: Decimal
    volumen_minimo_mensual: Optional[Decimal] = None
    unidad_medida: Optional[str] = None
    aplica_rebate: bool
    tipo_rebate: Optional[str] = None
    umbral_rebate_1: Optional[Decimal] = None
    porcentaje_rebate_1: Optional[Decimal] = None
    umbral_rebate_2: Optional[Decimal] = None
    porcentaje_rebate_2: Optional[Decimal] = None
    umbral_rebate_3: Optional[Decimal] = None
    porcentaje_rebate_3: Optional[Decimal] = None
    frecuencia_liquidacion_rebate: Optional[str] = None
    multa_incumplimiento: Optional[Decimal] = None
    bonificacion_cumplimiento: Optional[Decimal] = None
    nota_penalidad: Optional[str] = None
    objeto: Optional[str] = None
    observaciones: Optional[str] = None
    user_id: Optional[UUID] = None
    aprobado_por: Optional[UUID] = None
    fecha_aprobacion: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AgreementWithItems(AgreementResponse):
    items: list[AgreementItemResponse] = []
    rebates: list["AgreementRebateResponse"] = []
    volumes: list["AgreementVolumeResponse"] = []


class AgreementRebateResponse(BaseModel):
    id: UUID
    agreement_id: UUID
    supplier_id: UUID
    periodo: str
    tipo: str
    umbral_desde: Decimal
    umbral_hasta: Optional[Decimal] = None
    valor_rebate: Decimal
    monto_aplicado: Decimal
    estado: str
    fecha_calculo: Optional[datetime] = None
    fecha_aprobacion: Optional[datetime] = None
    aprobado_por: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AgreementVolumeResponse(BaseModel):
    id: UUID
    agreement_id: UUID
    supplier_id: UUID
    periodo: str
    tipo_periodo: str
    volumen_comprometido: Decimal
    volumen_real: Decimal
    monto_comprometido: Decimal
    monto_real: Decimal
    porcentaje_cumplimiento: Optional[Decimal] = None
    bonificacion_ganada: Decimal
    multa_aplicada: Decimal
    estado: str
    observaciones: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SupplierNegotiationCreate(BaseModel):
    company_id: UUID
    supplier_id: UUID
    tipo: str = Field(min_length=2, max_length=30)
    titulo: str = Field(min_length=2, max_length=200)
    descripcion: Optional[str] = None
    meta_precio: Optional[Decimal] = None
    meta_descuento: Optional[Decimal] = None
    observaciones: Optional[str] = None
    user_id: Optional[UUID] = None


class SupplierNegotiationUpdate(BaseModel):
    tipo: Optional[str] = None
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    meta_precio: Optional[Decimal] = None
    meta_descuento: Optional[Decimal] = None
    observaciones: Optional[str] = None


class SupplierNegotiationClose(BaseModel):
    precio_final: Decimal
    estado: str
    observaciones: Optional[str] = None


class SupplierNegotiationResponse(BaseModel):
    id: UUID
    company_id: UUID
    supplier_id: UUID
    tipo: str
    titulo: str
    descripcion: Optional[str] = None
    estado: str
    meta_precio: Optional[Decimal] = None
    meta_descuento: Optional[Decimal] = None
    precio_final: Optional[Decimal] = None
    observaciones: Optional[str] = None
    user_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AgreementSummaryResponse(BaseModel):
    id: UUID
    numero: str
    nombre: str
    tipo: str
    estado: str
    prioridad: str
    fecha_inicio: date
    fecha_fin: date
    moneda: str
    monto_total_acordado: Optional[Decimal] = None
    monto_ejecutado: Decimal
    porcentaje_ejecucion: Optional[Decimal] = None
    aplica_iragru: bool
    tasa_iragru: Optional[Decimal] = None
    aplica_retencion_iva: bool
    tasa_retencion_iva: Optional[Decimal] = None
    aplica_rebate: bool
    vigencia_dias: int
    dias_restantes: int
    items_count: int
    rebates_pending: int
    volumen_cumplimiento: Optional[Decimal] = None


class SupplierCommercialSummary(BaseModel):
    supplier_id: UUID
    razon_social: str
    acuerdos_activos: int
    monto_total_contratado: Decimal
    monto_ejecutado: Decimal
    porcentaje_ejecucion: Decimal
    rebates_pendientes: Decimal
    rebates_liquidado: Decimal
    cumplimiento_promedio: Optional[Decimal] = None
    volumen_mes_actual: Decimal
    volumen_mes_anterior: Decimal
    variacion_mensual: Optional[Decimal] = None


class SupplierPriceCompetitiveness(BaseModel):
    supplier_id: UUID
    razon_social: str
    productos_comparados: int
    promedio_ahorro_pct: Decimal
    total_ahorro_estimado: Decimal
    productos: list["ProductPriceComparison"]


class ProductPriceComparison(BaseModel):
    product_id: UUID
    product_nombre: str
    precio_acordado: Decimal
    precio_lista: Optional[Decimal] = None
    precio_ultimo_mercado: Optional[Decimal] = None
    ahorro_gs: Optional[Decimal] = None
    ahorro_pct: Optional[Decimal] = None


class AgreementsBySupplierResponse(BaseModel):
    supplier_id: UUID
    razon_social: str
    cantidad_acuerdos: int
    acuerdos_activos: int
    monto_total: Decimal
    monto_ejecutado: Decimal
    ultimo_acuerdo: Optional[datetime] = None
    items_activos: int