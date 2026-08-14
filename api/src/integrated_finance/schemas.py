from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID


# ── Withholding ──────────────────────────────────────────────────────────────

class WithholdingConfigCreate(BaseModel):
    company_id: str
    supplier_id: str
    tipo: str
    categoria: Optional[str] = None
    tasa: float
    base_minima: Optional[float] = 0
    exento_hasta: Optional[float] = 0
    regimen: Optional[str] = None

class WithholdingConfigUpdate(BaseModel):
    tasa: Optional[float] = None
    categoria: Optional[str] = None
    base_minima: Optional[float] = None
    exento_hasta: Optional[float] = None
    regimen: Optional[str] = None
    activo: Optional[bool] = None

class WithholdingConfigResponse(BaseModel):
    id: UUID
    company_id: UUID
    supplier_id: Optional[UUID] = None
    tipo: str
    activo: bool
    categoria: Optional[str] = None
    tasa: float
    base_minima: Optional[float] = 0.0
    exento_hasta: Optional[float] = None
    regimen: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class WithholdingDocumentCreate(BaseModel):
    company_id: str
    supplier_id: str
    invoice_id: str
    tipo: str
    periodo_fiscal: str
    base_imponible: float
    tasa: float
    monto_retenido: float
    moneda: str = "PYG"
    notas: Optional[str] = None

class WithholdingDocumentResponse(BaseModel):
    id: UUID
    company_id: UUID
    supplier_id: UUID
    invoice_id: UUID
    tipo: str
    numero_documento: Optional[str] = None
    cdc: Optional[str] = None
    fecha_emision: date
    periodo_fiscal: str
    base_imponible: float
    tasa: float
    monto_retenido: float
    moneda: str
    estado: str
    notas: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class WithholdingDashboard(BaseModel):
    total_retenciones_pendientes: int
    monto_total_pendiente: float
    total_retenciones_enviadas: int
    monto_total_enviado: float
    por_tipo: dict


# ── Account Plan ─────────────────────────────────────────────────────────────

class AccountPlanCreate(BaseModel):
    company_id: str
    codigo: str
    nombre: str
    tipo: str
    nivel: int = 1
    padre_id: Optional[str] = None
    acepta_asientos: bool = True

class AccountPlanResponse(BaseModel):
    id: UUID
    company_id: UUID
    codigo: str
    nombre: str
    tipo: str
    nivel: int
    padre_id: Optional[UUID] = None
    acepta_asientos: bool
    activo: bool

    class Config:
        from_attributes = True


# ── Accounting Period ────────────────────────────────────────────────────────

class AccountingPeriodCreate(BaseModel):
    company_id: str
    anio: int
    mes: int

class AccountingPeriodResponse(BaseModel):
    id: UUID
    company_id: UUID
    anio: int
    mes: int
    fecha_inicio: date
    fecha_fin: date
    estado: str
    fecha_apertura: Optional[datetime] = None
    fecha_cierre: Optional[datetime] = None
    observaciones: Optional[str] = None

    class Config:
        from_attributes = True


# ── Accounting Entry ─────────────────────────────────────────────────────────

class AccountingEntryCreate(BaseModel):
    company_id: str
    period_id: str
    account_id: str
    fecha: date
    tipo: str
    monto: float
    concepto: Optional[str] = None
    referencia_tipo: Optional[str] = None
    referencia_id: Optional[str] = None
    asiento_numero: Optional[str] = None

class AccountingEntryResponse(BaseModel):
    id: UUID
    company_id: UUID
    period_id: UUID
    account_id: UUID
    fecha: date
    tipo: str
    monto: float
    concepto: Optional[str] = None
    asiento_numero: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class TrialBalanceItem(BaseModel):
    account_id: str
    codigo: str
    nombre: str
    tipo: str
    nivel: int
    debe: float
    haber: float
    saldo: float

class TrialBalanceResponse(BaseModel):
    periodo: str
    items: list[TrialBalanceItem]
    total_debe: float
    total_haber: float

class PnLItem(BaseModel):
    account_id: str
    codigo: str
    nombre: str
    monto: float

class PnLStatement(BaseModel):
    periodo: str
    ingresos: list[PnLItem]
    total_ingresos: float
    costos: list[PnLItem]
    total_costos: float
    gastos: list[PnLItem]
    total_gastos: float
    resultado_bruto: float
    resultado_operativo: float
    resultado_neto: float


# ── Collection ───────────────────────────────────────────────────────────────

class CollectionActionCreate(BaseModel):
    company_id: str
    customer_id: str
    receivable_id: Optional[str] = None
    tipo: str
    resultado: Optional[str] = None
    notas: Optional[str] = None
    contacto: Optional[str] = None
    proximo_contacto: Optional[date] = None
    compromiso_pago: Optional[date] = None
    monto_comprometido: Optional[float] = None

class CollectionActionResponse(BaseModel):
    id: UUID
    company_id: UUID
    customer_id: UUID
    receivable_id: Optional[UUID] = None
    tipo: str
    fecha: date
    resultado: Optional[str] = None
    notas: Optional[str] = None
    proximo_contacto: Optional[date] = None
    compromiso_pago: Optional[date] = None
    monto_comprometido: Optional[float] = None
    created_by: Optional[UUID] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Customer Scoring ─────────────────────────────────────────────────────────

class CustomerScoreResponse(BaseModel):
    id: UUID
    company_id: UUID
    customer_id: UUID
    score: int
    pago_puntual: float
    dias_mora_promedio: float
    antiguedad_dias: int
    total_compras: float
    total_pagos: float
    veces_mora: int
    ultima_actualizacion: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── EBITDA ───────────────────────────────────────────────────────────────────

class EbitdaResponse(BaseModel):
    periodo: str
    ingresos_netos: float
    costo_ventas: float
    resultado_bruto: float
    gastos_operativos: float
    ebitda: float
    margen_ebitda: float
    notas: Optional[str] = None


# ── Auto Reconciliation ─────────────────────────────────────────────────────

class AutoReconcileResult(BaseModel):
    conciliadas: int
    monto_conciliado: float
    no_conciliadas: int
    monto_no_conciliado: float
    detalle: list[dict]


# ── Consolidated Dashboard ───────────────────────────────────────────────────

class ConsolidatedDashboard(BaseModel):
    liquidez: float
    liquidez_rapida: float
    ebitda: float
    margen_ebitda: float
    resultado_neto: float
    total_por_cobrar: float
    total_por_pagar: float
    saldo_bancario: float
    proyeccion_30d: float
    proyeccion_60d: float
    proyeccion_90d: float
    rotacion_cartera_dias: float
    rotacion_proveedores_dias: float
    ciclo_efectivo_dias: float
    ar_aging: list[dict]
    ap_aging: list[dict]
    ingresos_del_mes: float
    gastos_del_mes: float
    retenciones_pendientes: int
    colecciones_pendientes: int
    scoring_promedio: float
    accounting_weeks: int
