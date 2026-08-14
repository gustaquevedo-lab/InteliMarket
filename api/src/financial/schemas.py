"""Financial schemas — AP, banking, cash flow, budgets, payment runs, dashboards"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal


# ── Supplier Invoice (AP) ──────────────────────────────────────────────────────

class SupplierInvoiceCreate(BaseModel):
    company_id: UUID
    supplier_id: UUID
    numero_factura: str = Field(min_length=1, max_length=50)
    timbrado: Optional[str] = None
    cdc: Optional[str] = None
    fecha_emision: date
    fecha_recepcion: Optional[date] = None
    fecha_vencimiento: date
    subtotal: Decimal = Decimal("0")
    descuento: Decimal = Decimal("0")
    iva_10: Decimal = Decimal("0")
    iva_5: Decimal = Decimal("0")
    total: Decimal = Field(ge=0)
    moneda: str = "PYG"
    tipo_cambio: Decimal = Decimal("1")
    purchase_order_id: Optional[UUID] = None
    receipt_id: Optional[UUID] = None
    condicion: str = "credito"
    tipo_comprobante: str = "factura"
    concepto: Optional[str] = None
    notas: Optional[str] = None
    created_by: Optional[UUID] = None


class SupplierInvoiceUpdate(BaseModel):
    timbrado: Optional[str] = None
    cdc: Optional[str] = None
    fecha_recepcion: Optional[date] = None
    fecha_vencimiento: Optional[date] = None
    notas: Optional[str] = None
    concepto: Optional[str] = None


class SupplierInvoiceResponse(BaseModel):
    id: UUID
    company_id: UUID
    supplier_id: UUID
    supplier_nombre: Optional[str] = None
    numero_factura: str
    timbrado: Optional[str] = None
    cdc: Optional[str] = None
    fecha_emision: date
    fecha_recepcion: Optional[date] = None
    fecha_vencimiento: date
    subtotal: Optional[Decimal] = None
    descuento: Optional[Decimal] = None
    iva_10: Optional[Decimal] = None
    iva_5: Optional[Decimal] = None
    total: Decimal
    saldo_pendiente: Decimal
    moneda: str
    tipo_cambio: Optional[Decimal] = None
    purchase_order_id: Optional[UUID] = None
    receipt_id: Optional[UUID] = None
    condicion: Optional[str] = None
    tipo_comprobante: Optional[str] = None
    estado: str
    concepto: Optional[str] = None
    notas: Optional[str] = None
    created_by: Optional[UUID] = None
    approved_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SupplierInvoiceWithPayments(SupplierInvoiceResponse):
    payments: list["SupplierInvoicePaymentResponse"] = []


class SupplierInvoicePaymentCreate(BaseModel):
    payment_method: str = Field(min_length=1, max_length=30)
    monto: Decimal = Field(ge=0)
    moneda: str = "PYG"
    fecha_pago: Optional[date] = None
    referencia: Optional[str] = None
    comprobante_url: Optional[str] = None
    bank_account_id: Optional[UUID] = None


class SupplierInvoicePaymentResponse(BaseModel):
    id: UUID
    invoice_id: UUID
    payment_method: str
    monto: Decimal
    moneda: str
    fecha_pago: date
    referencia: Optional[str] = None
    comprobante_url: Optional[str] = None
    bank_account_id: Optional[UUID] = None
    estado: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Aging & AP Dashboard ───────────────────────────────────────────────────────

class AgingBucket(BaseModel):
    rango: str
    monto: Decimal
    facturas: int


class AgingBySupplier(BaseModel):
    supplier_id: UUID
    razon_social: str
    total_pendiente: Decimal
    vencido: Decimal
    por_vencer: Decimal


class APDashboard(BaseModel):
    total_pendiente: Decimal
    total_vencido: Decimal
    total_por_vencer: Decimal
    facturas_pendientes: int
    facturas_vencidas: int
    proveedores_con_deuda: int
    aging_30: Decimal
    aging_60: Decimal
    aging_90: Decimal
    aging_90_plus: Decimal


# ── Bank Accounts ──────────────────────────────────────────────────────────────

class BankAccountCreate(BaseModel):
    company_id: UUID
    banco: str = Field(min_length=1, max_length=100)
    tipo: str = Field(min_length=1, max_length=20)
    numero_cuenta: str = Field(min_length=1, max_length=50)
    moneda: str = "PYG"
    saldo_inicial: Decimal = Decimal("0")
    titular: Optional[str] = None


class BankAccountUpdate(BaseModel):
    banco: Optional[str] = None
    tipo: Optional[str] = None
    numero_cuenta: Optional[str] = None
    titular: Optional[str] = None
    activo: Optional[bool] = None
    saldo_minimo_alerta: Optional[Decimal] = None


class BankAccountResponse(BaseModel):
    id: UUID
    company_id: UUID
    banco: str
    tipo: str
    numero_cuenta: str
    moneda: str
    saldo_inicial: Decimal
    saldo_actual: Decimal
    titular: Optional[str] = None
    activo: bool
    saldo_minimo_alerta: Optional[Decimal] = None
    saldo_verificado_manualmente: bool = False
    saldo_verificado_at: Optional[datetime] = None
    saldo_verificado_por: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Bank Transactions ──────────────────────────────────────────────────────────

class BankTransactionCreate(BaseModel):
    fecha: date
    tipo: str = Field(pattern="^(credito|debito)$")
    monto: Decimal = Field(ge=0)
    moneda: str = "PYG"
    descripcion: Optional[str] = None
    referencia: Optional[str] = None
    contraparte: Optional[str] = None
    categoria: str = "otros"


class BankTransactionImport(BaseModel):
    transactions: list[BankTransactionCreate]


class BankTransactionResponse(BaseModel):
    id: UUID
    company_id: UUID
    bank_account_id: UUID
    fecha: date
    tipo: str
    monto: float
    moneda: str
    descripcion: Optional[str] = None
    referencia: Optional[str] = None
    contraparte: Optional[str] = None
    conciliado: bool
    fecha_conciliacion: Optional[datetime] = None
    invoice_id: Optional[UUID] = None
    cheque_id: Optional[UUID] = None
    categoria: str
    created_at: datetime

    class Config:
        from_attributes = True


class ReconcileRequest(BaseModel):
    matched_type: str = "manual"  # "invoice" | "cheque" | "manual"
    matched_id: Optional[UUID] = None


class BulkReconcileMatch(BaseModel):
    transaction_id: UUID
    matched_type: str
    matched_id: Optional[UUID] = None


class BulkReconcileRequest(BaseModel):
    matches: list[BulkReconcileMatch]


# ── Verificación de saldo y correcciones (Bancos Fase 5) ───────────────────────

class BalanceCorrectionCreate(BaseModel):
    saldo_propuesto: Decimal
    motivo: str = Field(min_length=1)


class BalanceCorrectionDecision(BaseModel):
    motivo: Optional[str] = None  # solo para rechazo


class BankBalanceCorrectionResponse(BaseModel):
    id: UUID
    company_id: UUID
    bank_account_id: UUID
    origen: str
    saldo_actual: Decimal
    saldo_propuesto: Decimal
    motivo: Optional[str] = None
    estado: str
    solicitado_por: Optional[UUID] = None
    aprobado_supervisor_id: Optional[UUID] = None
    aprobado_supervisor_at: Optional[datetime] = None
    aprobado_gerente_id: Optional[UUID] = None
    aprobado_gerente_at: Optional[datetime] = None
    rechazado_por: Optional[UUID] = None
    rechazado_at: Optional[datetime] = None
    rechazado_motivo: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Cash Flow ──────────────────────────────────────────────────────────────────

class CashFlowProjectionResponse(BaseModel):
    id: UUID
    company_id: UUID
    fecha: date
    saldo_inicial: Decimal
    ingresos_estimados: Decimal
    egresos_estimados: Decimal
    saldo_final_proyectado: Decimal
    ingresos_reales: Optional[Decimal] = None
    egresos_reales: Optional[Decimal] = None
    saldo_final_real: Optional[Decimal] = None
    fuente: str
    notas: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CashFlowProjectionUpdate(BaseModel):
    ingresos_estimados: Optional[Decimal] = None
    egresos_estimados: Optional[Decimal] = None
    notas: Optional[str] = None
    fuente: str = "manual"


class CashFlowDashboard(BaseModel):
    saldo_bancario: Decimal
    ingresos_hoy: Decimal
    egresos_hoy: Decimal
    saldo_proyectado_7d: Decimal
    saldo_proyectado_30d: Decimal
    proyecciones: list[dict]


# ── Budgets ────────────────────────────────────────────────────────────────────

class BudgetCreate(BaseModel):
    company_id: UUID
    nombre: str = Field(min_length=2, max_length=100)
    periodo: str = Field(pattern=r"^\d{4}-\d{2}$")
    categoria: Optional[str] = None
    monto_presupuestado: Decimal = Field(ge=0)
    area: str = "general"
    tipo: str = Field(pattern="^(ingreso|egreso)$")


class BudgetUpdate(BaseModel):
    nombre: Optional[str] = None
    monto_presupuestado: Optional[Decimal] = None
    categoria: Optional[str] = None
    area: Optional[str] = None


class BudgetResponse(BaseModel):
    id: UUID
    company_id: UUID
    nombre: str
    periodo: str
    categoria: Optional[str] = None
    monto_presupuestado: Decimal
    monto_ejecutado: Decimal
    monto_disponible: Optional[Decimal] = None
    area: str
    tipo: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BudgetVsActual(BaseModel):
    budget_id: UUID
    nombre: str
    periodo: str
    categoria: Optional[str] = None
    area: str
    monto_presupuestado: Decimal
    monto_ejecutado: Decimal
    monto_disponible: Decimal
    porcentaje_ejecutado: Decimal


# ── Payment Runs ───────────────────────────────────────────────────────────────

class PaymentRunCreate(BaseModel):
    company_id: UUID
    nombre: str = Field(min_length=2, max_length=100)
    fecha_programada: date
    metodo_pago: str = "transferencia"
    bank_account_id: Optional[UUID] = None
    invoice_ids: list[UUID] = Field(min_length=1)


class PaymentRunResponse(BaseModel):
    id: UUID
    company_id: UUID
    nombre: str
    fecha_programada: date
    total_monto: Decimal
    estado: str
    metodo_pago: Optional[str] = None
    bank_account_id: Optional[UUID] = None
    created_by: Optional[UUID] = None
    approved_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PaymentRunWithItems(PaymentRunResponse):
    items: list["PaymentRunItemResponse"] = []


class PaymentRunItemResponse(BaseModel):
    id: UUID
    payment_run_id: UUID
    invoice_id: UUID
    supplier_id: UUID
    supplier_nombre: Optional[str] = None
    numero_factura: Optional[str] = None
    monto_programado: Decimal
    monto_pagado: Optional[Decimal] = None
    estado: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Consolidated Dashboards ────────────────────────────────────────────────────

class BankReconciliationResult(BaseModel):
    total_transactions: int
    conciliadas: int
    pendientes: int
    diferencias: Decimal


class FinancialDashboard(BaseModel):
    ap_dashboard: APDashboard
    ar_summary: dict
    cash_flow: CashFlowDashboard
    budget_summary: list[dict]
    liquidity_ratio: float
    rotacion_cartera_dias: float
    rotacion_proveedores_dias: float


class FinancialRatios(BaseModel):
    liquidity_ratio: float
    quick_ratio: float
    rotacion_cartera_dias: float
    rotacion_proveedores_dias: float
    ciclo_efectivo_dias: float
    ap_total: Decimal
    ar_total: Decimal


# ── Aprobación de pagos grandes (Cuentas por Pagar Fase 3) ─────────────────────

class APPaymentApprovalResponse(BaseModel):
    id: UUID
    company_id: UUID
    entidad_tipo: str
    entidad_id: UUID
    monto: Decimal
    estado: str
    solicitado_por: Optional[UUID] = None
    aprobado_supervisor_id: Optional[UUID] = None
    aprobado_supervisor_at: Optional[datetime] = None
    aprobado_gerente_id: Optional[UUID] = None
    aprobado_gerente_at: Optional[datetime] = None
    rechazado_por: Optional[UUID] = None
    rechazado_at: Optional[datetime] = None
    rechazado_motivo: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class APPaymentRejectRequest(BaseModel):
    motivo: Optional[str] = None


class CashFlowAlertConfig(BaseModel):
    activo: bool = False
    dias_horizonte: int = 30
    telefono: Optional[str] = None
