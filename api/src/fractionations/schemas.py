from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class FractionationLinkInput(BaseModel):
    child_product_id: UUID = Field(..., description="ID del producto unitario individual a vincular")
    factor_conversion: int = Field(..., gt=1, description="Cantidad de unidades contenidas en cada display (ej: 24)")


class FractionationQuickCreateChildInput(BaseModel):
    nombre: str = Field(..., min_length=2, description="Nombre de la unidad individual (ej: Oblea Nik Chocolate 30g)")
    codigo_barra: str = Field(..., min_length=1, description="Código de barras de la unidad que viene dentro del display")
    factor_conversion: int = Field(..., gt=1, description="Cantidad de unidades en el display (ej: 24)")
    precio_unitario: Optional[float] = Field(None, ge=0, description="Precio de venta unitario al público en PYG")


class FractionationExecuteStockInput(BaseModel):
    cantidad_displays: int = Field(..., gt=0, description="Cantidad de displays/cajas a abrir para abastecer góndola")
    sucursal_id: Optional[UUID] = Field(None, description="Sucursal donde se abre el display (opcional, toma sucursal principal)")
    motivo: Optional[str] = Field("Fraccionamiento de display para góndola", description="Observación del movimiento")


class FractionationSummaryProduct(BaseModel):
    id: UUID
    codigo_barra: Optional[str] = None
    nombre: str
    costo_promedio: Optional[float] = None
    precio_promedio: Optional[float] = None
    stock_actual: Optional[float] = None


class FractionationInfoResponse(BaseModel):
    es_display: bool = False
    es_unidad_fraccionada: bool = False
    relacion_id: Optional[UUID] = None
    factor_conversion: Optional[int] = None
    display_parent: Optional[FractionationSummaryProduct] = None
    unidad_child: Optional[FractionationSummaryProduct] = None
