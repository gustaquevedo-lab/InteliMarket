from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID


class ExpenseCategoryCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    presupuesto_mensual: Optional[Decimal] = None


class ExpenseCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nombre: str
    descripcion: Optional[str] = None
    presupuesto_mensual: Optional[float] = None
    activo: bool = True
    created_at: Optional[datetime] = None


class CostCenterCreate(BaseModel):
    nombre: str
    tipo: str = "sector"  # sector | global
    peso_prorateo: Optional[Decimal] = Decimal("1")


class CostCenterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nombre: str
    tipo: str
    peso_prorateo: float
    activo: bool = True
    created_at: Optional[datetime] = None


class PettyCashFundCreate(BaseModel):
    branch_id: Optional[str] = None
    nombre: str
    custodio_id: Optional[str] = None
    cost_center_id: Optional[str] = None
    monto_autorizado: Decimal
    monto_maximo_por_gasto: Optional[Decimal] = Decimal("500000")
    dotacion_inicial: Optional[bool] = False
    medio_dotacion: Optional[str] = "EFECTIVO_BOVEDA"  # EFECTIVO_BOVEDA | BANCO_TRANSFERENCIA
    caja_boveda_id: Optional[str] = None
    bank_account_id: Optional[str] = None


class PettyCashFundUpdate(BaseModel):
    nombre: Optional[str] = None
    custodio_id: Optional[str] = None
    cost_center_id: Optional[str] = None
    monto_autorizado: Optional[Decimal] = None
    monto_maximo_por_gasto: Optional[Decimal] = None
    activo: Optional[bool] = None


class FundReplenishRequest(BaseModel):
    monto: Decimal
    bank_account_id: Optional[str] = None
    caja_boveda_id: Optional[str] = None
    medio_reposicion: Optional[str] = "EFECTIVO_BOVEDA"
    referencia: Optional[str] = None
    observaciones: Optional[str] = None


class PettyCashFundResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    branch_id: Optional[UUID] = None
    branch_nombre: Optional[str] = None
    nombre: str
    custodio_id: Optional[UUID] = None
    custodio_nombre: Optional[str] = None
    cost_center_id: Optional[UUID] = None
    cost_center_nombre: Optional[str] = None
    monto_autorizado: float
    saldo_actual: float
    monto_maximo_por_gasto: Optional[float] = 500000
    activo: bool
    created_at: Optional[datetime] = None


class PettyCashFundMovementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    fund_id: UUID
    tipo: str
    monto: float
    saldo_anterior: float
    saldo_nuevo: float
    referencia_type: Optional[str] = None
    referencia_id: Optional[UUID] = None
    observaciones: Optional[str] = None
    created_at: Optional[datetime] = None


class ExpenseCreate(BaseModel):
    branch_id: Optional[str] = None
    fund_id: Optional[str] = None
    category_id: Optional[str] = None
    cost_center_id: Optional[str] = None
    monto: Decimal
    descripcion: str
    proveedor: Optional[str] = None
    comprobante_url: Optional[str] = None
    tipo_pago: str = "efectivo"
    fecha_gasto: Optional[date] = None
    # Campos Fiscales Paraguayos
    ruc: Optional[str] = None
    timbrado: Optional[str] = None
    numero_factura: Optional[str] = None
    tipo_comprobante: Optional[str] = "FACTURA_CONTADO"
    gravado_10: Optional[Decimal] = None
    gravado_5: Optional[Decimal] = None
    exentas: Optional[Decimal] = None
    iva_10: Optional[Decimal] = None
    iva_5: Optional[Decimal] = None
    # Clasificación Inversión vs Gasto
    es_inversion: Optional[bool] = False
    vida_util_meses: Optional[int] = None
    categoria_activo: Optional[str] = None
    # Clasificación Mercaderías / Cuentas por Pagar
    es_pago_proveedor: Optional[bool] = False
    supplier_id: Optional[str] = None
    supplier_invoice_id: Optional[str] = None
    # Clasificación Anticipo de Sueldo (Nómina / SueldOK)
    es_anticipo_sueldo: Optional[bool] = False
    employee_id: Optional[str] = None
    employee_nombre: Optional[str] = None
    employee_ci: Optional[str] = None
    periodo_nomina: Optional[str] = None
    cuotas_anticipo: Optional[int] = 1
    monto_brl: Optional[Decimal] = None
    notas: Optional[str] = None


class ExpenseUpdate(BaseModel):
    category_id: Optional[str] = None
    cost_center_id: Optional[str] = None
    fund_id: Optional[str] = None
    rendicion_id: Optional[str] = None
    monto: Optional[Decimal] = None
    descripcion: Optional[str] = None
    proveedor: Optional[str] = None
    comprobante_url: Optional[str] = None
    tipo_pago: Optional[str] = None
    ruc: Optional[str] = None
    timbrado: Optional[str] = None
    numero_factura: Optional[str] = None
    tipo_comprobante: Optional[str] = None
    gravado_10: Optional[Decimal] = None
    gravado_5: Optional[Decimal] = None
    exentas: Optional[Decimal] = None
    iva_10: Optional[Decimal] = None
    iva_5: Optional[Decimal] = None
    es_inversion: Optional[bool] = None
    vida_util_meses: Optional[int] = None
    categoria_activo: Optional[str] = None
    es_pago_proveedor: Optional[bool] = None
    supplier_id: Optional[str] = None
    supplier_invoice_id: Optional[str] = None
    grouped_expense_ids: Optional[list[str]] = None
    # Clasificación Anticipo de Sueldo (Nómina / SueldOK)
    es_anticipo_sueldo: Optional[bool] = None
    employee_id: Optional[str] = None
    employee_nombre: Optional[str] = None
    employee_ci: Optional[str] = None
    periodo_nomina: Optional[str] = None
    cuotas_anticipo: Optional[int] = None
    monto_brl: Optional[Decimal] = None
    fecha_gasto: Optional[date] = None
    notas: Optional[str] = None


class ExpenseBatchAssignInvoiceRequest(BaseModel):
    expense_ids: list[str]
    supplier_invoice_id: str
    notas: Optional[str] = None


class ExpenseApprovalConfig(BaseModel):
    umbral_aprobacion: Decimal = Decimal("200000")
    tolerancia_arqueo: Decimal = Decimal("2000")


class FundCountCreate(BaseModel):
    monto_contado: Decimal
    observaciones: Optional[str] = None


class FundCountConfirm(BaseModel):
    ajustar: bool = True
    observaciones: Optional[str] = None


class PettyCashFundCountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    fund_id: UUID
    contado_por: UUID
    contado_por_nombre: Optional[str] = None
    saldo_esperado: float
    monto_contado: float
    diferencia: float
    requiere_revision: bool
    estado: str
    confirmado_por: Optional[UUID] = None
    confirmado_por_nombre: Optional[str] = None
    fecha_confirmacion: Optional[datetime] = None
    ajusto_saldo: bool = False
    observaciones: Optional[str] = None
    created_at: Optional[datetime] = None


class ExpenseRejectBody(BaseModel):
    motivo: str


class ExpenseVoidBody(BaseModel):
    motivo: str


class ExpenseRevertPaymentRequest(BaseModel):
    fund_id: Optional[str] = None
    nuevo_estado: Optional[str] = "aprobado"  # aprobado | pendiente
    motivo: Optional[str] = None


class ExpenseBatchRevertPaymentRequest(BaseModel):
    expense_ids: list[str]
    fund_id: Optional[str] = None
    nuevo_estado: Optional[str] = "aprobado"  # aprobado | pendiente
    motivo: Optional[str] = None


class ComprobanteUploadResponse(BaseModel):
    url: str
    filename: str


class ExpenseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: Optional[UUID] = None
    branch_id: Optional[UUID] = None
    fund_id: Optional[UUID] = None
    fund_nombre: Optional[str] = None
    rendicion_id: Optional[UUID] = None
    rendicion_numero: Optional[str] = None
    rendicion_estado: Optional[str] = None
    rendicion_fecha: Optional[datetime] = None
    category_id: Optional[UUID] = None
    cost_center_id: Optional[UUID] = None
    cost_center_nombre: Optional[str] = None
    monto: float
    monto_brl: Optional[float] = None
    descripcion: str
    proveedor: Optional[str] = None
    comprobante_url: Optional[str] = None
    tipo_pago: Optional[str] = None
    fecha_gasto: Optional[date] = None
    # Campos Fiscales
    ruc: Optional[str] = None
    timbrado: Optional[str] = None
    numero_factura: Optional[str] = None
    tipo_comprobante: Optional[str] = "FACTURA_CONTADO"
    gravado_10: Optional[float] = 0
    gravado_5: Optional[float] = 0
    exentas: Optional[float] = 0
    iva_10: Optional[float] = 0
    iva_5: Optional[float] = 0
    # Inversión y Activos Fijos
    es_inversion: bool = False
    fixed_asset_id: Optional[UUID] = None
    vida_util_meses: Optional[int] = None
    categoria_activo: Optional[str] = None
    # Clasificación Mercaderías / Cuentas por Pagar
    es_pago_proveedor: bool = False
    supplier_id: Optional[UUID] = None
    supplier_invoice_id: Optional[UUID] = None
    # Clasificación Anticipo de Sueldo (Nómina / SueldOK)
    es_anticipo_sueldo: bool = False
    employee_id: Optional[str] = None
    employee_nombre: Optional[str] = None
    employee_ci: Optional[str] = None
    periodo_nomina: Optional[str] = None
    cuotas_anticipo: Optional[int] = 1
    sueldok_sync_status: Optional[str] = "pendiente"
    sueldok_sync_id: Optional[str] = None
    # Auditoría
    auditoria_estado: Optional[str] = "pendiente"
    auditoria_motivo: Optional[str] = None
    registrado_por: Optional[UUID] = None
    aprobado_por: Optional[UUID] = None
    aprobado_at: Optional[datetime] = None
    rechazado_por: Optional[UUID] = None
    rechazado_at: Optional[datetime] = None
    rechazado_motivo: Optional[str] = None
    anulado: bool = False
    anulado_por: Optional[UUID] = None
    anulado_at: Optional[datetime] = None
    anulado_motivo: Optional[str] = None
    estado: str = "pendiente"
    notas: Optional[str] = None
    # Liquidación / Pago
    fecha_pago: Optional[date] = None
    pagado_por: Optional[UUID] = None
    pagado_at: Optional[datetime] = None
    forma_pago_resumen: Optional[str] = None
    disbursements: Optional[list["ExpenseDisbursementResponse"]] = None
    created_at: Optional[datetime] = None


class ExpenseDisbursementLineCreate(BaseModel):
    medio_pago: str  # boveda | fondo_fijo | transferencia | cheque | otro
    monto: Decimal
    bank_account_id: Optional[str] = None
    petty_cash_fund_id: Optional[str] = None
    numero_comprobante: Optional[str] = None
    fecha_efectiva: Optional[date] = None
    banco_cheque: Optional[str] = None
    numero_cheque: Optional[str] = None
    fecha_cheque_emision: Optional[date] = None
    fecha_cheque_vencimiento: Optional[date] = None
    titular_cheque: Optional[str] = None
    es_cheque_diferido: Optional[bool] = False
    moneda: Optional[str] = "PYG"
    monto_moneda: Optional[Decimal] = None
    tipo_cambio: Optional[Decimal] = None
    detalles: Optional[dict] = None


class ExpenseDisburseRequest(BaseModel):
    fecha_pago: Optional[date] = None
    disbursements: list[ExpenseDisbursementLineCreate]
    notas: Optional[str] = None


class ExpenseDisbursementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    expense_id: UUID
    medio_pago: str
    monto: float
    moneda: str = "PYG"
    bank_account_id: Optional[UUID] = None
    petty_cash_fund_id: Optional[UUID] = None
    cheque_id: Optional[UUID] = None
    numero_comprobante: Optional[str] = None
    fecha_efectiva: date
    detalles: Optional[dict] = None
    created_at: Optional[datetime] = None



# ── Modelos de Rendición de Cuentas y Reposición Formal ──────────

class PettyCashRendicionCreate(BaseModel):
    fund_id: str
    expense_ids: list[str]
    efectivo_remanente_contado: Decimal
    observaciones: Optional[str] = None


class PettyCashRendicionAuditItem(BaseModel):
    expense_id: str
    estado: str  # aprobado | observado | rechazado
    motivo: Optional[str] = None


class PettyCashRendicionAuditRequest(BaseModel):
    items: list[PettyCashRendicionAuditItem]
    observaciones: Optional[str] = None


class PettyCashRendicionReplenishRequest(BaseModel):
    medio_reposicion: str = "EFECTIVO_BOVEDA"  # EFECTIVO_BOVEDA | BANCO_TRANSFERENCIA | CHEQUE
    caja_boveda_id: Optional[str] = None
    bank_account_id: Optional[str] = None
    comprobante_pago_ref: Optional[str] = None
    observaciones: Optional[str] = None


class PettyCashRendicionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    fund_id: UUID
    fund_nombre: Optional[str] = None
    numero_rendicion: str
    custodio_id: UUID
    custodio_nombre: str
    auditado_por_id: Optional[UUID] = None
    auditado_por_nombre: Optional[str] = None
    estado: str
    monto_fondo_autorizado: float
    efectivo_remanente_contado: float
    total_comprobantes_presentados: float
    total_comprobantes_aprobados: float
    total_comprobantes_rechazados: float
    diferencia_arqueo: float
    total_gravado_10: float
    total_gravado_5: float
    total_exentas: float
    total_iva_10: float
    total_iva_5: float
    total_inversion_activos: float
    total_gasto_operativo: float
    monto_repuesto: float
    medio_reposicion: Optional[str] = None
    caja_boveda_id: Optional[UUID] = None
    bank_account_id: Optional[UUID] = None
    comprobante_pago_ref: Optional[str] = None
    asiento_contable_id: Optional[UUID] = None
    fecha_presentacion: Optional[datetime] = None
    fecha_aprobacion: Optional[datetime] = None
    fecha_pago: Optional[datetime] = None
    observaciones_custodio: Optional[str] = None
    observaciones_tesoreria: Optional[str] = None
    created_at: Optional[datetime] = None


class PettyCashRendicionDetailResponse(BaseModel):
    rendicion: PettyCashRendicionResponse
    expenses: list[ExpenseResponse]
    fund: PettyCashFundResponse


class ExpenseSummary(BaseModel):
    total_dia: float
    total_semana: float
    total_mes: float
    por_categoria: list[dict]
    por_sucursal: list[dict]
    pendientes_aprobacion: int


class ExpenseDashboard(BaseModel):
    fecha_desde: date
    fecha_hasta: date
    total_periodo: float
    total_periodo_anterior: float
    variacion_pct: Optional[float] = None
    por_categoria: list[dict]
    por_sector: list[dict]
    tendencia_mensual: list[dict]
    top_proveedores: list[dict]
    sugerencias: list[dict]
