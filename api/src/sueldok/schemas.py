"""SueldOK integration schemas"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SueldOKSyncConfig(BaseModel):
    id: str
    tenant_id: str
    enabled: bool
    auto_sync: bool
    url_base: str
    api_key: str | None = None
    created_at: datetime
    updated_at: datetime


class SueldOKSyncConfigCreate(BaseModel):
    url_base: str
    api_key: Optional[str] = None
    auto_sync: bool = False


class PayrollSyncData(BaseModel):
    employee_id: str
    periodo: str
    sueldo_base: float
    horas_extra: float
    bonificaciones: float
    deducciones: float
    comisiones: float
    adelantos: float


SYNC_EVENTS = [
    "payroll.sync",
    "employee.created",
    "employee.updated",
    "attendance.sync",
    "payroll.approved",
]


class PayrollPaymentOrderCreate(BaseModel):
    periodo: str
    total_neto: float
    colaboradores_count: Optional[int] = 0
    observaciones: Optional[str] = None
    liquidar_inmediato: Optional[bool] = False
    forma_pago: Optional[str] = "transferencia"  # transferencia | cheque | boveda | fondo_fijo
    bank_account_id: Optional[str] = None
    referencia_transferencia: Optional[str] = None
    numero_cheque: Optional[str] = None
    banco_cheque: Optional[str] = None
    fecha_pago: Optional[str] = None
    sueldok_run_id: Optional[str] = None


class SettlementCreate(BaseModel):
    employee_id: str
    employee_nombre: str
    employee_ci: Optional[str] = None
    employee_cargo: Optional[str] = None
    fecha_ingreso: Optional[str] = None
    fecha_salida: str
    motivo: Optional[str] = "despido_injustificado"
    salario_base: float
    dias_trabajados_mes: Optional[int] = 0
    monto_dias_trabajados: Optional[float] = 0
    vacaciones_monto: Optional[float] = 0
    aguinaldo_proporcional: Optional[float] = 0
    preaviso: Optional[float] = 0
    indemnizacion_legal: Optional[float] = 0
    descuentos_varios: Optional[float] = 0
    total_liquidacion_neta: float
    observaciones: Optional[str] = None
    generar_op: Optional[bool] = True
    liquidar_inmediato: Optional[bool] = False
    forma_pago: Optional[str] = "transferencia"  # transferencia | cheque | boveda | fondo_fijo
    bank_account_id: Optional[str] = None
    referencia_transferencia: Optional[str] = None
    numero_cheque: Optional[str] = None
    banco_cheque: Optional[str] = None
    fecha_pago: Optional[str] = None


class SettlementResponse(BaseModel):
    id: str
    company_id: str
    employee_id: str
    employee_nombre: str
    employee_ci: Optional[str] = None
    employee_cargo: Optional[str] = None
    fecha_ingreso: Optional[str] = None
    fecha_salida: str
    motivo: str
    salario_base: float
    dias_trabajados_mes: Optional[int] = 0
    monto_dias_trabajados: Optional[float] = 0
    vacaciones_monto: Optional[float] = 0
    aguinaldo_proporcional: Optional[float] = 0
    preaviso: Optional[float] = 0
    indemnizacion_legal: Optional[float] = 0
    descuentos_varios: Optional[float] = 0
    total_liquidacion_neta: float
    payment_order_id: Optional[str] = None
    payment_order_numero: Optional[str] = None
    estado: str
    observaciones: Optional[str] = None
    created_at: Optional[datetime] = None


# ── PayrollDossier Schemas ────────────────────────────────────────────────


class DisbursementBatchEntry(BaseModel):
    """One employee's disbursement info within a batch."""
    employee_id: str
    name: str
    ci: str
    net_salary: float
    account_number: Optional[str] = None
    bank_account_type: Optional[str] = None


class BankBatch(BaseModel):
    employees: list[DisbursementBatchEntry]
    total: float


class ChequeeBatch(BaseModel):
    employees: list[DisbursementBatchEntry]
    total: float


class ThirdPartyDeduction(BaseModel):
    """One external creditor's retained amount."""
    third_party_name: str
    third_party_ruc: Optional[str] = None
    total: float
    employees: list[dict]  # [{employee_id, name, ci, amount, invoice_reference}]


class ExtraClubTicket(BaseModel):
    """One Extra Club / commercial debt ticket to offset."""
    employee_id: str
    employee_name: str
    employee_ci: str
    ticket_ref: Optional[str] = None
    amount: float


class PayrollDossierCreate(BaseModel):
    """Input payload to create a PayrollDossier from an approved SueldOK run."""
    periodo: str                           # "YYYY-MM"
    sueldok_run_id: Optional[str] = None

    # Aggregate totals
    masa_salarial_bruta: float
    total_neto: float
    total_ips_obrero: float
    total_ips_patronal: float
    total_anticipos: float = 0
    total_extra_club: float = 0
    total_uniformes: float = 0
    total_convenios_terceros: float = 0
    total_judiciales: float = 0

    # Disbursement batches per channel (from getPayrollDisbursementBatches)
    lotes_banco: dict[str, BankBatch] = {}     # bankName -> BankBatch
    lotes_efectivo: dict[str, BankBatch] = {}  # branchName -> BankBatch
    lote_cheque: Optional[ChequeeBatch] = None

    # Non-cash deductions
    extra_club_tickets: list[ExtraClubTicket] = []
    uniformes_items: list[ExtraClubTicket] = []  # reuse same structure

    # Third-party creditors (Comercial Malou, etc.)
    terceros_desglose: list[ThirdPartyDeduction] = []

    observaciones: Optional[str] = None


class PayrollDossierPhaseOut(BaseModel):
    id: str
    phase_type: str
    phase_label: Optional[str]
    monto: float
    estado: str
    payment_order_id: Optional[str] = None
    collection_receipt_id: Optional[str] = None
    fecha_vencimiento: Optional[str] = None
    pdf_storage_key: Optional[str] = None
    executed_at: Optional[datetime] = None


class PayrollDossierOut(BaseModel):
    id: str
    company_id: str
    periodo: str
    sueldok_run_id: Optional[str]
    masa_salarial_bruta: float
    total_neto: float
    total_ips_obrero: float
    total_ips_patronal: float
    total_anticipos: float
    total_extra_club: float
    total_uniformes: float
    total_convenios_terceros: float
    total_judiciales: float
    estado: str
    observaciones: Optional[str]
    created_at: Optional[datetime]
    phases: list[PayrollDossierPhaseOut] = []
