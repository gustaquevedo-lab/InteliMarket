from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime
from decimal import Decimal


# ── Config de impresoras ──────────────────────────────────────────────────

class LabelPrinterConfigUpsert(BaseModel):
    nombre: str
    conexion: Optional[str] = None  # solo zebra: qz_tray, red_tcp
    qz_printer_name: Optional[str] = None
    host: Optional[str] = None
    puerto_tcp: Optional[int] = None
    ancho_mm: Decimal
    alto_mm: Decimal
    columnas: int = 1
    activa: bool = True


class LabelPrinterConfigResponse(LabelPrinterConfigUpsert):
    id: UUID
    company_id: UUID
    tipo: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Plantillas ─────────────────────────────────────────────────────────────

class LabelTemplateFields(BaseModel):
    mostrar_nombre: bool = True
    mostrar_precio: bool = True
    mostrar_costo: bool = False
    mostrar_barcode: bool = True
    mostrar_sku: bool = False
    mostrar_proveedor: bool = False
    mostrar_fecha: bool = False
    fuente_tamano_nombre: int = 8
    fuente_tamano_precio: int = 12


class LabelTemplateCreate(BaseModel):
    tipo_impresora: str
    nombre: str
    es_default: bool = False
    campos: LabelTemplateFields


class LabelTemplateResponse(BaseModel):
    id: UUID
    company_id: UUID
    tipo_impresora: str
    nombre: str
    es_default: bool
    campos: dict
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Resolución de origen (productos sueltos / proveedor / recepción / categoría) ──

class LabelSourceItem(BaseModel):
    product_id: UUID
    cantidad: int = Field(ge=1)


class LabelSourceFilter(BaseModel):
    producto_ids: Optional[list[LabelSourceItem]] = None
    proveedor_id: Optional[UUID] = None
    receipt_id: Optional[UUID] = None
    categoria_id: Optional[UUID] = None
    cantidad_default: int = 1


class ResolvedLabelItem(BaseModel):
    product_id: UUID
    nombre: str
    sku: Optional[str] = None
    codigo_barra: Optional[str] = None
    precio_venta: Decimal
    costo_unitario: Optional[Decimal] = None
    proveedor_nombre: Optional[str] = None
    fecha: Optional[str] = None
    cantidad: int


# ── Impresión Zebra ────────────────────────────────────────────────────────

class PrintZebraRequest(BaseModel):
    items: list[ResolvedLabelItem]
    template_id: Optional[UUID] = None


class PrintZebraResponse(BaseModel):
    zpl: str
    enviado_por_red: bool
