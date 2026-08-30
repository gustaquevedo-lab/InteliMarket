"""Branch schemas"""

from decimal import Decimal
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class BranchCreate(BaseModel):
    company_id: uuid.UUID
    codigo: str
    nombre: str
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    departamento: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    ruc: Optional[str] = None
    punto_emision: int = 1


class BranchUpdate(BaseModel):
    nombre: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    departamento: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    ruc: Optional[str] = None
    punto_emision: Optional[int] = None
    activo: Optional[bool] = None


class BranchResponse(BaseModel):
    id: uuid.UUID | str
    company_id: uuid.UUID | str
    codigo: str
    nombre: str
    direccion: Optional[str]
    ciudad: Optional[str]
    departamento: Optional[str]
    telefono: Optional[str]
    email: Optional[str]
    ruc: Optional[str]
    punto_emision: int
    activo: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class BranchPriceUpsert(BaseModel):
    branch_id: uuid.UUID
    product_id: uuid.UUID
    precio: Decimal


class BranchPriceResponse(BaseModel):
    id: str
    branch_id: str
    branch_nombre: Optional[str] = None
    product_id: str
    product_nombre: Optional[str] = None
    precio: float
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BranchTransferItemCreate(BaseModel):
    product_id: uuid.UUID
    cantidad: int
    costo_unitario: Optional[Decimal] = None


class BranchTransferCreate(BaseModel):
    origen_branch_id: uuid.UUID
    destino_branch_id: uuid.UUID
    notas: Optional[str] = None
    transportista: Optional[str] = None
    items: list[BranchTransferItemCreate]


class BranchTransferItemResponse(BaseModel):
    id: str
    product_id: str
    product_nombre: Optional[str] = None
    cantidad: int
    costo_unitario: Optional[float] = None
    cantidad_recibida: Optional[int] = None

    class Config:
        from_attributes = True


class BranchTransferResponse(BaseModel):
    id: str
    company_id: str
    origen_branch_id: str
    origen_nombre: Optional[str] = None
    destino_branch_id: str
    destino_nombre: Optional[str] = None
    numero: str
    estado: str
    notas: Optional[str] = None
    transportista: Optional[str] = None
    created_by: Optional[str] = None
    approved_by: Optional[str] = None
    items: list[BranchTransferItemResponse] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TransferReceiveItem(BaseModel):
    item_id: uuid.UUID
    cantidad_recibida: int


class TransferReceiveInput(BaseModel):
    items: list[TransferReceiveItem]


class BranchDashboardItem(BaseModel):
    branch_id: str
    branch_nombre: str
    total_ventas: float = 0
    cantidad_ventas: int = 0
    stock_valor: float = 0
    total_gastos: float = 0


class ConsolidatedDashboard(BaseModel):
    total_branches: int
    total_ventas: float
    total_stock_valor: float
    transferencias_pendientes: int
    branches: list[BranchDashboardItem]
