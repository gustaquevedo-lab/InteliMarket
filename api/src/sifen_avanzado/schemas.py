from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from decimal import Decimal


# ── Distribuidora Invoice ────────────────────────────────────────────────────

class DistribuidoraInvoiceRequest(BaseModel):
    company_id: str
    customer_id: str
    condicion: str = "credito"
    plazo_dias: Optional[int] = None
    cuotas: Optional[int] = None
    tipo_exportacion: Optional[str] = None
    incoterm: Optional[str] = None
    pais_destino: Optional[str] = None
    transporte: Optional[str] = None
    guia_numero: Optional[str] = None
    observaciones: Optional[str] = None
    items: list[dict]

class DistribuidoraInvoiceResponse(BaseModel):
    id: str
    numero: str
    cdc: Optional[str] = None
    sifen_estado: Optional[str] = None
    total: float
    condicion: str


# ── IVA Book ─────────────────────────────────────────────────────────────────

class IvaBookEntry(BaseModel):
    fecha: date
    numero_documento: str
    tipo_documento: str
    ruc: str
    razon_social: str
    timbrado: Optional[str] = None
    base_gravada_5: float
    base_gravada_10: float
    exenta: float
    iva_5: float
    iva_10: float
    total: float
    cdc: Optional[str] = None

class IvaBookResponse(BaseModel):
    periodo: str
    tipo: str
    entries: list[IvaBookEntry]
    total_base_5: float
    total_base_10: float
    total_exenta: float
    total_iva_5: float
    total_iva_10: float
    total_general: float


# ── Retention Book ───────────────────────────────────────────────────────────

class RetentionBookEntry(BaseModel):
    periodo: str
    numero_documento: Optional[str] = None
    ruc_proveedor: str
    nombre_proveedor: str
    tipo_retencion: str
    base_imponible: float
    tasa: float
    monto_retenido: float
    fecha_emision: date
    cdc: Optional[str] = None

class RetentionBookResponse(BaseModel):
    periodo: str
    entries: list[RetentionBookEntry]
    total_retenido_iva: float
    total_retenido_irp: float
    total_general: float


# ── DGR ──────────────────────────────────────────────────────────────────────

class DgrVehicleCreate(BaseModel):
    company_id: str
    patente: str
    marca: str
    modelo: str
    anio: int
    tipo: str
    chasis: Optional[str] = None
    motor: Optional[str] = None
    capacidad_toneladas: Optional[float] = None
    propietario: Optional[str] = None
    ruc_propietario: Optional[str] = None
    color: Optional[str] = None

class DgrVehicleUpdate(BaseModel):
    marca: Optional[str] = None
    modelo: Optional[str] = None
    anio: Optional[int] = None
    tipo: Optional[str] = None
    chasis: Optional[str] = None
    motor: Optional[str] = None
    capacidad_toneladas: Optional[float] = None
    propietario: Optional[str] = None
    color: Optional[str] = None
    activo: Optional[bool] = None

class DgrVehicleResponse(BaseModel):
    id: str
    company_id: str
    patente: str
    marca: str
    modelo: str
    anio: int
    tipo: str
    chasis: Optional[str] = None
    motor: Optional[str] = None
    capacidad_toneladas: Optional[float] = None
    propietario: Optional[str] = None
    ruc_propietario: Optional[str] = None
    color: Optional[str] = None
    activo: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class DgrReportResponse(BaseModel):
    id: str
    periodo: str
    tipo: str
    cantidad_vehiculos: int
    archivo_path: Optional[str] = None
    fecha_generacion: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── e-Kuatia Documents ───────────────────────────────────────────────────────

class EkuatiaDocumentCreate(BaseModel):
    company_id: str
    sale_id: Optional[str] = None
    tipo_documento: str
    nombre_original: str
    archivo_path: Optional[str] = None
    hash_sha256: Optional[str] = None

class EkuatiaDocumentResponse(BaseModel):
    id: str
    company_id: str
    sale_id: Optional[str] = None
    tipo_documento: str
    nombre_original: str
    archivo_path: Optional[str] = None
    hash_sha256: Optional[str] = None
    validez_legal: bool
    fecha_digitalizacion: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── CDC Validation ───────────────────────────────────────────────────────────

class CdcValidationRequest(BaseModel):
    sale_id: str
    cdc: str
    company_id: str

class CdcValidationResponse(BaseModel):
    cdc: str
    valido: bool
    mensaje: Optional[str] = None
    fecha_consulta: Optional[datetime] = None

class BatchCdcValidationRequest(BaseModel):
    company_id: str
    sale_ids: list[str]


# ── Dashboard ────────────────────────────────────────────────────────────────

class SifenAvanzadoDashboard(BaseModel):
    total_facturas_mes: int
    facturas_pendientes_sifen: int
    facturas_con_cdc: int
    facturas_rechazadas: int
    libros_iva_generados_mes: int
    documentos_ekuatia: int
    vehiculos_registrados: int
    cdc_validados: int
    cdc_invalidos: int
    retenciones_del_periodo: int
    compliance_score: float
