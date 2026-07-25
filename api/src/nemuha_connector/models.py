"""Conector Ñemuha (ConceptoComercial/FlexPDV) — historial de sync y mapeo de entidades"""

from sqlalchemy import Column, String, DateTime, Integer, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class NemuhaSyncRun(Base):
    """Una corrida del conector — una por área (fin, ar, bancos, etc.) o una consolidada."""

    __tablename__ = "nemuha_sync_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True))
    status = Column(String(20), default="running")  # running, success, partial, error
    since_date = Column(DateTime(timezone=True))
    rows_synced = Column(JSON)  # {"accounts_payable": 12, "accounts_receivable": 8, ...}
    errors = Column(JSON)  # {"bank_transactions": "mensaje de error"}


class NemuhaRecordMap(Base):
    """Mapeo idempotente: fila de la base legacy -> registro creado en InteliMarket.

    Evita duplicar en cada corrida — antes de insertar, se busca acá por
    (company_id, source_table, source_pk) y si ya existe se actualiza en vez de crear.
    """

    __tablename__ = "nemuha_record_map"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    source_table = Column(String(60), nullable=False, index=True)  # ej. "fin_conta_pagar"
    source_pk = Column(Integer, nullable=False, index=True)  # ej. ID_CONTA_PAGAR
    target_table = Column(String(60), nullable=False)  # ej. "supplier_invoices"
    target_id = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
