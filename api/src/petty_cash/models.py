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


class Expense(Base):
    """Caja chica — daily expense tracking"""
    __tablename__ = "expenses"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True))
    category_id = Column(UUID(as_uuid=True))
    monto = Column(Numeric(15, 2), nullable=False)
    descripcion = Column(String(300), nullable=False)
    proveedor = Column(String(100))
    comprobante_url = Column(String(500))  # receipt photo
    tipo_pago = Column(String(20))  # efectivo | tarjeta | transferencia
    fecha_gasto = Column(Date, nullable=False, server_default=func.current_date())
    registrado_por = Column(UUID(as_uuid=True))
    aprobado_por = Column(UUID(as_uuid=True))
    estado = Column(String(20), server_default="pendiente")  # pendiente | aprobado | rechazado
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
