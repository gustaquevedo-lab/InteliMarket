"""Sales targets (metas de venta) — modelos ORM"""

from sqlalchemy import Column, String, Boolean, Numeric, Integer, Date, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class SalesRep(Base):
    __tablename__ = "sales_reps"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    funcionario_codigo = Column(String(10))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    nombre = Column(String(150), nullable=False)
    cedula = Column(String(20))
    rama = Column(String(20))
    rol = Column(String(20), nullable=False)
    supervisor_id = Column(UUID(as_uuid=True), ForeignKey("sales_reps.id"))
    activo = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ProductLine(Base):
    __tablename__ = "product_lines"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    codigo_legacy = Column(String(20))
    nombre = Column(String(150), nullable=False)
    activo = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # Inteliforce: 'paresa' | 'mix' | 'ambas' | NULL — derivado de historial
    # real de ventas, ver scripts/migracion_casa_gonzalito/classify_lineas_rama.py
    rama = Column(String(10))


class SalesTarget(Base):
    __tablename__ = "sales_targets"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    sales_rep_id = Column(UUID(as_uuid=True), ForeignKey("sales_reps.id"))
    periodo_tipo = Column(String(10), nullable=False)
    periodo_inicio = Column(Date, nullable=False)
    periodo_fin = Column(Date, nullable=False)
    product_line_id = Column(UUID(as_uuid=True), ForeignKey("product_lines.id"))
    monto_gs = Column(Numeric(15, 0), default=0)
    cantidad_unidades = Column(Numeric(15, 2), default=0)
    origen = Column(String(20), nullable=False, default="manual")
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SalesTargetCascadeConfig(Base):
    __tablename__ = "sales_target_cascade_config"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, unique=True)
    umbral_pct = Column(Numeric(5, 2), nullable=False, default=80)
    activo = Column(Boolean, nullable=False, default=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now())


class SalesTargetHistoryBaseline(Base):
    __tablename__ = "sales_target_history_baseline"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    product_line_id = Column(UUID(as_uuid=True), ForeignKey("product_lines.id"))
    mes = Column(Integer, nullable=False)
    promedio_gs = Column(Numeric(15, 0))
    promedio_unidades = Column(Numeric(15, 2))
    tendencia_pct = Column(Numeric(6, 3))
    desvio_gs = Column(Numeric(15, 0))
    # OJO: pese al nombre de columna (heredado del DDL original), este campo
    # guarda UNIDADES del objetivos legacy (objetivos.CANTIDAD), no Gs — no
    # es comparable directo contra promedio_gs, si contra promedio_unidades.
    objetivo_legacy_ref_gs = Column(Numeric(15, 0))
    calculado_at = Column(DateTime(timezone=True), server_default=func.now())
