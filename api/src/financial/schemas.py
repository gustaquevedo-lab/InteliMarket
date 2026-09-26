"""Financial schemas — AP, banking, cash flow, budgets, payment runs, dashboards"""

from pydantic import BaseModel, Field, model_validator
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
    total_brl: Optional[Decimal] = None
    saldo_pendiente_brl: Optional[Decimal] = None
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
    total_brl: Optional[Decimal] = None
    saldo_pendiente_brl: Optional[Decimal] = None
    notas: Optional[str] = None
    concepto: Optional[str] = None


class SupplierInvoiceResponse(BaseModel):
    id: UUID
    company_id: UUID
    supplier_id: UUID
    supplier_nombre: Optional[str] = None
    supplier_ruc: Optional[str] = None
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
    total_brl: Optional[Decimal] = None
    saldo_pendiente_brl: Optional[Decimal] = None
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


class SupplierInvoiceBatchRevertRequest(BaseModel):
    invoice_ids: list[str]
    motivo: Optional[str] = None


class PaidInvoiceItem(BaseModel):
    id: UUID
    numero_factura: str
    timbrado: Optional[str] = None
    cdc: Optional[str] = None
    fecha_emision: date
    fecha_vencimiento: date
    total: Decimal
    total_brl: Optional[Decimal] = None
    saldo_pendiente: Decimal
    saldo_pendiente_brl: Optional[Decimal] = None
    moneda: str
    estado: str
    condicion: Optional[str] = None
    supplier_id: UUID
    supplier_nombre: Optional[str] = None
    supplier_ruc: Optional[str] = None
    notas: Optional[str] = None
    concepto: Optional[str] = None
    ultimo_pago_fecha: Optional[date] = None
    ultimo_pago_metodo: Optional[str] = None
    pagos_count: int = 0
    created_at: Optional[datetime] = None


class PaidInvoicesListResponse(BaseModel):
    items: list[PaidInvoiceItem]
    total: int
    total_monto_pyg: Decimal
    total_monto_brl: Decimal
    limit: int
    offset: int


class SupplierInvoicePaymentCreate(BaseModel):
    payment_method: str = Field(min_length=1, max_length=30)
    monto: Decimal = Field(ge=0)
    moneda: str = "PYG"
    fecha_pago: Optional[date] = None
    referencia: Optional[str] = None
    comprobante_url: Optional[str] = None
    bank_account_id: Optional[UUID] = None
    petty_cash_fund_id: Optional[UUID] = None


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
    petty_cash_fund_id: Optional[UUID] = None
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
    alias: Optional[str] = Field(None, max_length=100)
    tipo: str = Field(min_length=1, max_length=20)
    numero_cuenta: str = Field(min_length=1, max_length=50)
    moneda: str = "PYG"
    saldo_inicial: Decimal = Decimal("0")
    titular: Optional[str] = None


class BankAccountUpdate(BaseModel):
    banco: Optional[str] = None
    alias: Optional[str] = None
    tipo: Optional[str] = None
    numero_cuenta: Optional[str] = None
    titular: Optional[str] = None
    activo: Optional[bool] = None
    saldo_minimo_alerta: Optional[Decimal] = None


class BankAccountResponse(BaseModel):
    id: UUID
    company_id: UUID
    banco: str
    alias: Optional[str] = None
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
    comision_adicional: Optional[Decimal] = Field(default=None, ge=0)
    company_id: Optional[UUID] = None


class BankTransferCreate(BaseModel):
    origen_account_id: UUID
    destino_account_id: UUID
    monto: Decimal = Field(gt=0)
    fecha: date
    moneda: str = "PYG"
    referencia: Optional[str] = None
    descripcion: Optional[str] = None
    comision: Optional[Decimal] = Field(default=Decimal("0"), ge=0)
    company_id: Optional[UUID] = None


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


class SupplierCreditNoteCreate(BaseModel):
    supplier_id: str
    numero: str
    numero_factura_origen: Optional[str] = None
    timbrado: Optional[str] = None
    fecha: date
    fecha_recepcion: Optional[date] = None
    motivo: str
    motivo_categoria: Optional[str] = "devolucion_rotura"
    impacto_contable: Optional[str] = "otros_ingresos"
    archivo_adjunto_path: Optional[str] = None
    monto: float
    moneda: Optional[str] = "PYG"
    observaciones: Optional[str] = None


class SupplierCreditNoteApply(BaseModel):
    invoice_id: str
    monto: float
    observaciones: Optional[str] = None


# ── Supplier Payment Orders (OP Multifactura y Multimedio) ─────────────────────────

class PaymentOrderAllocationCreate(BaseModel):
    invoice_id: UUID
    monto_aplicado: Decimal = Field(gt=0)
    monto_retencion: Decimal = Decimal("0")


class PaymentOrderDisbursementCreate(BaseModel):
    forma_pago: str  # boveda, fondo_fijo, transferencia, cheque, nota_credito, otro
    monto: Decimal = Field(gt=0)
    moneda: str = "PYG"
    tipo_cambio: Decimal = Decimal("1")
    bank_account_id: Optional[UUID] = None
    referencia_transferencia: Optional[str] = None
    cheque_id: Optional[UUID] = None  # Si se vincula a cheque existente / compartido
    numero_cheque: Optional[str] = None
    banco_cheque: Optional[str] = None
    fecha_cheque_emision: Optional[date] = None
    fecha_cheque_vencimiento: Optional[date] = None
    es_cheque_diferido: bool = False
    titular_cheque: Optional[str] = None
    monto_total_cheque: Optional[Decimal] = None  # Si se crea un nuevo cheque matriz compartido
    petty_cash_fund_id: Optional[UUID] = None
    credit_note_id: Optional[UUID] = None
    comprobante_url: Optional[str] = None
    observaciones: Optional[str] = None


class SupplierLegalInvoiceInput(BaseModel):
    numero_factura: str
    timbrado: str
    fecha_emision: Optional[date] = None
    fecha_vencimiento: Optional[date] = None
    monto: Decimal
    condicion: Optional[str] = "contado"
    ticket_ids: Optional[list[UUID]] = None


class SupplierPaymentOrderCreate(BaseModel):
    supplier_id: UUID
    fecha_emision: Optional[date] = None
    observaciones: Optional[str] = None
    recibo_proveedor: Optional[str] = None
    estado: Optional[str] = "registrado"  # "registrado", "aguardando_pago", etc.
    allocations: list[PaymentOrderAllocationCreate]
    disbursements: Optional[list[PaymentOrderDisbursementCreate]] = None
    legal_invoices: Optional[list[SupplierLegalInvoiceInput]] = None


class PaymentProposalItem(BaseModel):
    invoice_id: str
    numero_factura: str
    timbrado: Optional[str] = None
    fecha_emision: Optional[str] = None
    fecha_vencimiento: Optional[str] = None
    monto_total: Optional[float] = None
    total: Optional[float] = None
    saldo_pendiente: Optional[float] = None
    monto_a_pagar: float = 0.0

    @model_validator(mode="after")
    def unify_totals(self):
        if self.monto_total is None:
            self.monto_total = self.total if self.total is not None else self.monto_a_pagar
        return self


class PaymentProposalCreditNote(BaseModel):
    id: Optional[str] = None
    credit_note_id: Optional[str] = None
    tipo: Optional[str] = "nc_fiscal"  # "nc_fiscal" o "devolucion" o "devolucion_fisica"
    numero: str
    timbrado: Optional[str] = None
    fecha: Optional[str] = None
    motivo: Optional[str] = None
    monto: float = 0.0
    saldo_aplicado: Optional[float] = None

    @model_validator(mode="after")
    def unify_ids(self):
        if not self.id:
            self.id = self.credit_note_id or self.numero
        return self


class PaymentProposalPdfRequest(BaseModel):
    supplier_id: str
    supplier_nombre: str
    supplier_ruc: Optional[str] = None
    fecha_propuesta: Optional[str] = None
    observaciones: Optional[str] = None
    invoices: list[PaymentProposalItem]
    credit_notes: Optional[list[PaymentProposalCreditNote]] = None


class SupplierPaymentOrderDisburse(BaseModel):
    fecha_pago: Optional[date] = None
    recibo_proveedor: Optional[str] = None
    observaciones: Optional[str] = None
    disbursements: list[PaymentOrderDisbursementCreate]
    legal_invoices: Optional[list[SupplierLegalInvoiceInput]] = None


class MultiSupplierBatchItem(BaseModel):
    supplier_id: UUID
    recibo_proveedor: Optional[str] = None
    observaciones: Optional[str] = None
    moneda: str = "PYG"  # "BRL" o "PYG"
    tipo_cambio: Decimal = Decimal("1")
    monto_moneda: Decimal
    monto_pyg: Decimal
    diferencia_cambio: Optional[Decimal] = Decimal("0")
    allocations: list[PaymentOrderAllocationCreate]


class MultiSupplierPaymentBatchCreate(BaseModel):
    fecha_pago: Optional[date] = None
    observaciones: Optional[str] = None
    forma_pago: str  # "cheque", "transferencia", "boveda"
    moneda_desembolso: str = "PYG"
    bank_account_id: Optional[UUID] = None
    referencia_transferencia: Optional[str] = None
    # Datos de cheque (si forma_pago == "cheque"):
    cheque_id: Optional[UUID] = None  # Si se vincula a uno existente
    numero_cheque: Optional[str] = None
    banco_cheque: Optional[str] = None
    titular_cheque: Optional[str] = None
    fecha_cheque_emision: Optional[date] = None
    fecha_cheque_vencimiento: Optional[date] = None
    es_cheque_diferido: bool = False
    monto_total_desembolso_pyg: Decimal  # Monto total del cheque/transferencia matriz
    monto_total_desembolso_brl: Optional[Decimal] = None
    diferencia_cambio_total: Optional[Decimal] = Decimal("0")
    items: list[MultiSupplierBatchItem]


class QuickValeItem(BaseModel):
    descripcion: str
    monto: Decimal
    numero_vale: Optional[str] = None
    fecha: Optional[date] = None


class SettleValesAndPayRequest(BaseModel):
    supplier_id: UUID
    receipt_ids: list[UUID] = []  # IDs de PurchaseReceipt seleccionadas
    vales_adicionales: list[QuickValeItem] = []  # Vales manuales complementarios
    # Datos Factura Legal:
    numero_factura: str
    timbrado: Optional[str] = None
    cdc: Optional[str] = None
    fecha_factura: date
    condicion: str = "contado"
    monto_total_factura: Decimal
    # Desembolso / Pago Inmediato en Ventanilla:
    forma_pago: str  # "boveda", "fondo_fijo", "cheque", "transferencia"
    bank_account_id: Optional[UUID] = None
    petty_cash_fund_id: Optional[UUID] = None
    referencia_transferencia: Optional[str] = None
    # Cheque fields (si forma_pago == "cheque"):
    cheque_id: Optional[UUID] = None
    numero_cheque: Optional[str] = None
    banco_cheque: Optional[str] = None
    titular_cheque: Optional[str] = None
    fecha_cheque_emision: Optional[date] = None
    fecha_cheque_vencimiento: Optional[date] = None
    es_cheque_diferido: bool = False
    monto_total_cheque: Optional[Decimal] = None
    observaciones: Optional[str] = None
    recibo_proveedor: Optional[str] = None



class PaymentOrderAllocationResponse(BaseModel):
    id: UUID
    invoice_id: UUID
    numero_factura: Optional[str] = None
    timbrado: Optional[str] = None
    fecha_emision: Optional[date] = None
    fecha_vencimiento: Optional[date] = None
    monto_aplicado: Decimal
    monto_retencion: Decimal
    saldo_anterior: Decimal
    saldo_restante: Decimal

    class Config:
        from_attributes = True


class PaymentOrderDisbursementResponse(BaseModel):
    id: UUID
    forma_pago: str
    monto: Decimal
    moneda: str
    tipo_cambio: Decimal
    monto_pyg: Decimal
    bank_account_id: Optional[UUID] = None
    banco_nombre: Optional[str] = None
    referencia_transferencia: Optional[str] = None
    cheque_id: Optional[UUID] = None
    numero_cheque: Optional[str] = None
    banco_cheque: Optional[str] = None
    fecha_cheque_emision: Optional[date] = None
    fecha_cheque_vencimiento: Optional[date] = None
    es_cheque_diferido: bool = False
    titular_cheque: Optional[str] = None
    petty_cash_fund_id: Optional[UUID] = None
    fondo_nombre: Optional[str] = None
    credit_note_id: Optional[UUID] = None
    numero_nc: Optional[str] = None
    comprobante_url: Optional[str] = None
    observaciones: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SupplierPaymentOrderResponse(BaseModel):
    id: UUID
    company_id: UUID
    supplier_id: UUID
    supplier_nombre: Optional[str] = None
    supplier_ruc: Optional[str] = None
    numero_orden: str
    fecha_emision: date
    fecha_pago: Optional[date] = None
    estado: str  # registrado, pagado, anulado
    moneda: str
    monto_total: Decimal
    monto_retenido: Decimal
    monto_neto: Decimal
    diferencia_cambio: Optional[Decimal] = Decimal("0")
    observaciones: Optional[str] = None
    recibo_proveedor: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    total_facturas: Optional[int] = 0
    formas_pago_resumen: Optional[str] = None

    class Config:
        from_attributes = True


class SupplierPaymentOrderDetailResponse(SupplierPaymentOrderResponse):
    allocations: list[PaymentOrderAllocationResponse] = []
    disbursements: list[PaymentOrderDisbursementResponse] = []


