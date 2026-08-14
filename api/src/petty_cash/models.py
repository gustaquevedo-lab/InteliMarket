from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Text, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from api.src.db import Base


class ExpenseCategory(Base):
    """Cost centers for expense tracking"""
    __tablename__ = "expense_categories"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text)
    presupuesto_mensual = Column(Numeric(15, 2))
    activo = Column(Boolean, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CostCenter(Base):
    """Sector/área del negocio (carnicería, panadería, caja, administración...) para
    imputar gastos y medir rentabilidad por centro de costo. tipo='global' es el
    centro especial cuyo saldo se prorratea entre los sectores activos según
    peso_prorateo — para gastos que no son atribuibles a un único sector
    (ej. alquiler, seguridad, gerencia)."""
    __tablename__ = "cost_centers"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    tipo = Column(String(20), nullable=False, server_default="sector")  # sector | global
    peso_prorateo = Column(Numeric(6, 2), nullable=False, server_default="1")
    activo = Column(Boolean, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PettyCashFund(Base):
    """Fondo fijo real de caja chica -- un monto autorizado por sucursal, con
    un custodio responsable y un saldo real que baja con cada gasto y sube
    con cada reposicion. Sin esto, 'caja chica' era solo un log de gastos sin
    ningun concepto de caja (Fase 1 del rediseño)."""
    __tablename__ = "petty_cash_funds"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), index=True)
    nombre = Column(String(100), nullable=False)
    custodio_id = Column(UUID(as_uuid=True))
    monto_autorizado = Column(Numeric(15, 0), nullable=False)
    saldo_actual = Column(Numeric(15, 0), nullable=False)
    activo = Column(Boolean, nullable=False, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PettyCashFundMovement(Base):
    """Ledger de todo movimiento del fondo -- apertura, gasto, reposicion,
    ajuste -- para no perder el rastro de por que el saldo es el que es."""
    __tablename__ = "petty_cash_fund_movements"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    fund_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    tipo = Column(String(20), nullable=False)  # apertura | gasto | reposicion | ajuste
    monto = Column(Numeric(15, 0), nullable=False)
    saldo_anterior = Column(Numeric(15, 0), nullable=False)
    saldo_nuevo = Column(Numeric(15, 0), nullable=False)
    referencia_type = Column(String(30))
    referencia_id = Column(UUID(as_uuid=True))
    observaciones = Column(Text)
    created_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PettyCashFundCount(Base):
    """Arqueo de caja chica -- conteo ciego del efectivo fisico del fondo,
    mismo patron que CashCount en el modulo Caja: el custodio declara lo que
    cuenta SIN ver el saldo_actual del sistema; saldo_esperado se guarda como
    foto del momento (no se recalcula despues) y la diferencia se calcula en
    el backend recien al guardar. requiere_revision se dispara si la
    diferencia supera la tolerancia configurada -- ahi un Supervisor/Gerente
    tiene que confirmar el arqueo y decidir si ajusta el saldo del fondo."""
    __tablename__ = "petty_cash_fund_counts"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    fund_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    contado_por = Column(UUID(as_uuid=True), nullable=False)
    contado_por_nombre = Column(String(100))
    saldo_esperado = Column(Numeric(15, 0), nullable=False)
    monto_contado = Column(Numeric(15, 0), nullable=False)
    diferencia = Column(Numeric(15, 0), nullable=False)
    requiere_revision = Column(Boolean, nullable=False, server_default="false")
    estado = Column(String(20), nullable=False, server_default="pendiente")  # pendiente | confirmado
    confirmado_por = Column(UUID(as_uuid=True))
    confirmado_por_nombre = Column(String(100))
    fecha_confirmacion = Column(DateTime(timezone=True))
    ajusto_saldo = Column(Boolean, nullable=False, server_default="false")
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Expense(Base):
    """Caja chica — daily expense tracking"""
    __tablename__ = "expenses"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True))
    fund_id = Column(UUID(as_uuid=True), index=True)
    category_id = Column(UUID(as_uuid=True))
    cost_center_id = Column(UUID(as_uuid=True))
    monto = Column(Numeric(15, 2), nullable=False)
    descripcion = Column(String(300), nullable=False)
    proveedor = Column(String(100))
    comprobante_url = Column(String(500))  # receipt photo
    tipo_pago = Column(String(20))  # efectivo | tarjeta | transferencia
    fecha_gasto = Column(Date, nullable=False, server_default=func.current_date())
    registrado_por = Column(UUID(as_uuid=True))
    aprobado_por = Column(UUID(as_uuid=True))
    aprobado_at = Column(DateTime(timezone=True))
    rechazado_por = Column(UUID(as_uuid=True))
    rechazado_at = Column(DateTime(timezone=True))
    rechazado_motivo = Column(Text)
    estado = Column(String(20), server_default="pendiente")  # pendiente | aprobado | rechazado
    anulado = Column(Boolean, nullable=False, server_default="false")
    anulado_por = Column(UUID(as_uuid=True))
    anulado_at = Column(DateTime(timezone=True))
    anulado_motivo = Column(Text)
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
