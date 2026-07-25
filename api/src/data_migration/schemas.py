"""Data migration schemas"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class MigrationPreview(BaseModel):
    columnas: list[str]
    filas_ejemplo: list[list]
    total_filas: int
    tipo_detectado: str


class MigrationImport(BaseModel):
    tipo: str = Field(..., pattern="^(clientes|productos|proveedores|ventas|saldos)$")
    column_mapping: dict[str, str]
    skip_header: bool = True


class MigrationLogResponse(BaseModel):
    id: UUID
    company_id: UUID
    tipo: str
    origen: str
    archivo_nombre: Optional[str]
    estado: str
    total_registros: int
    importados: int
    errores: int
    errores_detalle: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

