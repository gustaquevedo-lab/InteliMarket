"""Data migration models"""

from sqlalchemy import Column, String, DateTime, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from api.src.db import Base


class MigrationLog(Base):
    __tablename__ = "migration_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    tipo = Column(String(30), nullable=False)  # clientes, productos, proveedores, ventas, saldos
    origen = Column(String(30), nullable=False)  # excel, csv, legacy_erp
    archivo_nombre = Column(String(255))
    estado = Column(String(20), nullable=False, server_default="pendiente")
    total_registros = Column(Integer, default=0)
    importados = Column(Integer, default=0)
    errores = Column(Integer, default=0)
    errores_detalle = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

