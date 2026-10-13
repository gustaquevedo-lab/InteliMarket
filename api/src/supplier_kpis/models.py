"""Cumplimiento de metas/indicadores por proveedor (ej. PARESA) y su rebate asociado.

Los indicadores en si son dinamicos: cambian de nombre, peso y cantidad mes a
mes segun la planilla que cada proveedor le pasa a Casa Gonzalito (ej. jul-26
tenia Compras/Ejecucion/TPM/Foco, el mes que viene puede ser otra cosa). Por
eso no se modelan como columnas fijas sino como filas editables por periodo,
todas atadas a un SupplierKpiPeriod via FK.
"""

from sqlalchemy import Column, String, Numeric, Date, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class SupplierKpiPeriod(Base):
    __tablename__ = "supplier_kpi_periods"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=False, index=True)
    periodo = Column(Date, nullable=False, index=True)  # primer dia del mes, ej 2026-07-01
    rebate_pct_objetivo = Column(Numeric(5, 2), nullable=False, default=0)  # ej 4.50
    estado = Column(String(20), nullable=False, default="borrador")  # borrador | cerrado
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SupplierKpiIndicator(Base):
    __tablename__ = "supplier_kpi_indicators"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    period_id = Column(UUID(as_uuid=True), ForeignKey("supplier_kpi_periods.id"), nullable=False, index=True)
    codigo = Column(String(50), nullable=False)  # ej "compras", "ejecucion", "tpm", "foco_core"
    nombre = Column(String(150), nullable=False)  # ej "Compras", "Foco 1 Core Shw"
    peso_pct = Column(Numeric(5, 2), nullable=False)  # peso dentro del rebate total, ej 1.00
    meta = Column(Numeric(15, 2))
    resultado = Column(Numeric(15, 2))
    piso_minimo_pct = Column(Numeric(5, 2))  # nullable: bajo ese % de cumplimiento, aporta 0
    orden = Column(Numeric(3, 0), default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
