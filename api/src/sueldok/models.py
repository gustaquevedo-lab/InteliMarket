"""SueldOK integration models"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, Numeric, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class SueldokSyncConfig(Base):
    __tablename__ = "sueldok_sync_config"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False)
    api_url = Column(String(500), nullable=False)
    api_key = Column(String(200))
    enabled = Column(Boolean, default=True)
    commission_rate = Column(Numeric(5, 2), default=2.00)
    auto_sync = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class LaborSettlement(Base):
    __tablename__ = "labor_settlements"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id = Column(String(100), nullable=False, index=True)
    employee_nombre = Column(String(150), nullable=False)
    employee_ci = Column(String(50))
    employee_cargo = Column(String(100))
    fecha_ingreso = Column(DateTime)
    fecha_salida = Column(DateTime, nullable=False)
    motivo = Column(String(100), nullable=False, default="despido_injustificado")
    salario_base = Column(Numeric(15, 0), nullable=False, default=0)
    dias_trabajados_mes = Column(Numeric(5, 0), default=0)
    monto_dias_trabajados = Column(Numeric(15, 0), default=0)
    vacaciones_monto = Column(Numeric(15, 0), default=0)
    aguinaldo_proporcional = Column(Numeric(15, 0), default=0)
    preaviso = Column(Numeric(15, 0), default=0)
    indemnizacion_legal = Column(Numeric(15, 0), default=0)
    descuentos_varios = Column(Numeric(15, 0), default=0)
    total_liquidacion_neta = Column(Numeric(15, 0), nullable=False, default=0)
    payment_order_id = Column(UUID(as_uuid=True), index=True)
    estado = Column(String(30), nullable=False, default="pendiente")
    observaciones = Column(Text)
    created_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ── PayrollDossier ──────────────────────────────────────────────────────────

from sqlalchemy import Date, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship


class PayrollDossier(Base):
    """Master record for a monthly payroll processing batch.

    States: borrador | en_proceso | parcialmente_ejecutado | completado | anulado
    """
    __tablename__ = "payroll_dossiers"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    periodo = Column(String(7), nullable=False)          # "YYYY-MM"
    sueldok_run_id = Column(String(200), nullable=True)  # Convex payrollRun _id

    # Aggregate monetary totals (Guaraníes — integer precision)
    masa_salarial_bruta = Column(Numeric(18, 0), nullable=False, default=0)
    total_neto = Column(Numeric(18, 0), nullable=False, default=0)
    total_ips_obrero = Column(Numeric(18, 0), nullable=False, default=0)
    total_ips_patronal = Column(Numeric(18, 0), nullable=False, default=0)
    total_anticipos = Column(Numeric(18, 0), nullable=False, default=0)
    total_extra_club = Column(Numeric(18, 0), nullable=False, default=0)
    total_uniformes = Column(Numeric(18, 0), nullable=False, default=0)
    total_convenios_terceros = Column(Numeric(18, 0), nullable=False, default=0)
    total_judiciales = Column(Numeric(18, 0), nullable=False, default=0)

    estado = Column(String(30), nullable=False, default="borrador")
    observaciones = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    phases = relationship(
        "PayrollDossierPhase",
        back_populates="dossier",
        cascade="all, delete-orphan",
        order_by="PayrollDossierPhase.created_at",
    )


class PayrollDossierPhase(Base):
    """One processing phase within a PayrollDossier.

    Phase types:
        salario_neto_banco_{bank}      — SIPAP transfer batch per bank
        salario_neto_efectivo_{branch} — Cash envelope batch per branch
        salario_neto_cheque            — Salary cheque issuance
        compensacion_no_cash           — Extra Club / Uniformes internal offset
        convenio_tercero_{name}        — Vendor cheque + Planilla Anexa PDF
        prevision_ips                  — IPS 25.5% OP on legal due date

    States: pendiente | ejecutado | anulado
    """
    __tablename__ = "payroll_dossier_phases"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    dossier_id = Column(
        UUID(as_uuid=True),
        ForeignKey("payroll_dossiers.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    phase_type = Column(String(100), nullable=False)
    phase_label = Column(String(200), nullable=True)
    monto = Column(Numeric(18, 0), nullable=False, default=0)
    estado = Column(String(30), nullable=False, default="pendiente")

    # References to generated documents (set when phase is executed)
    payment_order_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    collection_receipt_id = Column(UUID(as_uuid=True), nullable=True)

    # Flexible metadata: employee list, bank details, third-party info, etc.
    metadata = Column(JSONB, nullable=True)

    # IPS: legal due date = day 12 of the month after the payroll period
    fecha_vencimiento = Column(Date, nullable=True)

    # PDF for third-party phases (Planilla Anexa de Rendición)
    pdf_storage_key = Column(String(500), nullable=True)

    executed_at = Column(DateTime(timezone=True), nullable=True)
    executed_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    dossier = relationship("PayrollDossier", back_populates="phases")
