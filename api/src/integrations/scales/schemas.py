"""Scale integration schemas — config, weight, PLU, labels"""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4
from pydantic import BaseModel, Field, ConfigDict


# ─── Scale Config ─────────────────────────────────────────────

class ScaleConfigCreate(BaseModel):
    nombre: str
    marca: str = "balmak"
    modelo: Optional[str] = None
    protocolo: str
    conexion: str = "tcp"
    puerto_com: Optional[str] = None
    baudrate: int = 9600
    data_bits: int = 8
    paridad: str = "N"
    stop_bits: str = "1"
    host: Optional[str] = None
    puerto_tcp: int = 9000
    timeout_segundos: int = 5
    vendor_id: Optional[str] = None
    product_id: Optional[str] = None
    ruta_carga: Optional[str] = None
    sync_automatico: bool = False
    categorias_ids: list[str] = Field(default_factory=list, description="IDs de categorias que esta balanza recibe via PLU sync; vacio = todas")
    etiqueta_formato: str = "40x30"
    etiqueta_cabecera: Optional[str] = None
    activa: bool = True


class ScaleConfigUpdate(BaseModel):
    nombre: Optional[str] = None
    protocolo: Optional[str] = None
    conexion: Optional[str] = None
    puerto_com: Optional[str] = None
    baudrate: Optional[int] = None
    host: Optional[str] = None
    puerto_tcp: Optional[int] = None
    timeout_segundos: Optional[int] = None
    activa: Optional[bool] = None
    sync_automatico: Optional[bool] = None
    categorias_ids: Optional[list[str]] = None


class ScaleConfigResponse(BaseModel):
    id: UUID
    nombre: str
    marca: str
    modelo: Optional[str] = None
    protocolo: str
    conexion: str
    puerto_com: Optional[str] = None
    baudrate: int
    host: Optional[str] = None
    puerto_tcp: int
    timeout_segundos: int
    sync_automatico: bool
    categorias_ids: list[str] = Field(default_factory=list)
    etiqueta_formato: str
    activa: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─── Weight Reading ───────────────────────────────────────────

class WeightReadResult(BaseModel):
    scale_id: str
    scale_nombre: str
    protocolo: str
    peso_bruto: Decimal
    peso_neto: Optional[Decimal] = None
    tara: Decimal = Decimal("0")
    unidad: str = "kg"
    estable: bool
    raw_response: Optional[str] = None
    timestamp: str


class TareResult(BaseModel):
    scale_id: str
    tara_aplicada: Decimal
    peso_neto: Optional[Decimal] = None
    estable: bool


class WeightLogFilter(BaseModel):
    scale_id: Optional[str] = None
    desde: Optional[datetime] = None
    hasta: Optional[datetime] = None
    origen: Optional[str] = None
    limit: int = 50
    offset: int = 0


# ─── PLU Sync ─────────────────────────────────────────────────

class PLUSyncInput(BaseModel):
    scale_id: str
    producto_ids: list[str] = Field(default_factory=list, description="empty = all products with price")
    modo: str = "incremental"


class PLUSyncResponse(BaseModel):
    sync_id: str
    scale_nombre: str
    total_productos: int
    exitosos: int
    fallidos: int
    archivo_generado: Optional[str] = None
    errores: list[dict] = []

    model_config = ConfigDict(from_attributes=True)


# ─── Label Template ───────────────────────────────────────────

class LabelFieldDef(BaseModel):
    tipo: str = Field(..., description="nombre_producto, precio_unitario, precio_total, peso, codigo_barras, fecha_venc, lote, info_nutricional, texto_libre")
    texto: Optional[str] = None
    fuente_tamano: int = 8
    negrita: bool = False
    x_mm: float = 0
    y_mm: float = 0


class LabelTemplateCreate(BaseModel):
    nombre: str
    ancho_mm: int = 40
    alto_mm: int = 30
    campos: list[LabelFieldDef]
    incluir_barcode: bool = True
    incluir_precio: bool = True
    incluir_peso: bool = True
    incluir_info_nutricional: bool = False
    incluir_logo: bool = False


class LabelTemplateResponse(BaseModel):
    id: UUID
    nombre: str
    ancho_mm: int
    alto_mm: int
    campos: list[dict]
    incluir_barcode: bool
    incluir_precio: bool
    incluir_peso: bool
    activo: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─── Print Label ──────────────────────────────────────────────

class PrintLabelInput(BaseModel):
    scale_id: str
    producto_id: str
    peso_kg: Decimal = Field(..., gt=0)
    precio_unitario: Decimal = Field(..., ge=0)
    template_id: Optional[str] = None
    fecha_vencimiento: Optional[str] = None
    lote: Optional[str] = None
    cantidad_copias: int = 1


class PrintLabelResult(BaseModel):
    scale_id: str
    producto_nombre: str
    peso_kg: Decimal
    precio_unitario: Decimal
    precio_total: Decimal
    etiqueta_generada: bool
    detalles: Optional[dict] = None


# ─── Connection Test ──────────────────────────────────────────

class ConnectionTestResult(BaseModel):
    scale_id: str
    scale_nombre: str
    conectada: bool
    protocolo_detectado: Optional[str] = None
    mensaje: str
    latencia_ms: Optional[int] = None
    peso_actual: Optional[Decimal] = None


# ─── Protocol Detect ──────────────────────────────────────────

class ProtocolDetectInput(BaseModel):
    conexion: str = "serial"
    puerto_com: Optional[str] = None
    host: Optional[str] = None
    puerto_tcp: Optional[int] = 9000
    baudrate: int = 9600
    timeout: int = 3


class ProtocolDetectResult(BaseModel):
    protocolos_probados: list[dict]
    protocolo_detectado: Optional[str] = None
    conectada: bool
    peso_leido: Optional[Decimal] = None


# ─── Weigh Product (POS Bridge) ────────────────────────────────

class WeighProductInput(BaseModel):
    producto_id: str
    precio_unitario: Optional[Decimal] = None


class WeighProductResult(BaseModel):
    escala_id: str
    escala_nombre: str
    peso_kg: Decimal
    unidad: str = "kg"
    estable: bool
    producto_id: str
    producto_nombre: str
    precio_unitario: Decimal
    subtotal: Decimal
