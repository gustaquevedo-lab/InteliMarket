"""CRM schemas"""

from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime, date, time
from enum import Enum
import uuid


class FuenteLead(str, Enum):
    web = "web"
    formulario = "formulario"
    referencia = "referencia"
    compra_cliente = "compra_cliente"
    frio = "frio"


class EstadoLead(str, Enum):
    nuevo = "nuevo"
    contactado = "contactado"
    cualificado = "cualificado"
    descartado = "descartado"


class EtapaOportunidad(str, Enum):
    lead = "lead"
    calificado = "calificado"
    propuesta = "propuesta"
    negociacion = "negociacion"
    cerrado_ganado = "cerrado_ganado"
    cerrado_perdido = "cerrado_perdido"


class TipoActividad(str, Enum):
    llamada = "llamada"
    email = "email"
    reunion = "reunion"
    nota = "nota"
    tarea = "tarea"


class LeadCreate(BaseModel):
    nombre: str
    email: Optional[str] = None
    telefono: Optional[str] = None
    empresa: Optional[str] = None
    fuente: FuenteLead = FuenteLead.web
    estado: EstadoLead = EstadoLead.nuevo
    puntaje: int = 0
    notas: Optional[str] = None
    asignado_a: Optional[uuid.UUID] = None

    @field_validator("puntaje")
    @classmethod
    def validate_puntaje(cls, v):
        if v < 0 or v > 100:
            raise ValueError("puntaje must be between 0 and 100")
        return v


class LeadUpdate(BaseModel):
    nombre: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    empresa: Optional[str] = None
    fuente: Optional[FuenteLead] = None
    estado: Optional[EstadoLead] = None
    puntaje: Optional[int] = None
    notas: Optional[str] = None
    asignado_a: Optional[uuid.UUID] = None


class LeadResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    company_id: uuid.UUID
    nombre: str
    email: Optional[str]
    telefono: Optional[str]
    empresa: Optional[str]
    fuente: str
    estado: str
    puntaje: int
    notas: Optional[str]
    asignado_a: Optional[uuid.UUID]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

    @field_validator("id", mode="before")
    @classmethod
    def cast_id(cls, v):
        if isinstance(v, uuid.UUID):
            return v
        if isinstance(v, str):
            return uuid.UUID(v)
        return v


class OportunidadCreate(BaseModel):
    nombre: str
    lead_id: Optional[uuid.UUID] = None
    monto_estimado: float = 0
    etapa: EtapaOportunidad = EtapaOportunidad.lead
    probabilidad: int = 0
    cliente_id: Optional[uuid.UUID] = None
    fecha_cierre_estimada: Optional[date] = None
    notas: Optional[str] = None
    asignado_a: Optional[uuid.UUID] = None

    @field_validator("probabilidad")
    @classmethod
    def validate_probabilidad(cls, v):
        if v < 0 or v > 100:
            raise ValueError("probabilidad must be between 0 and 100")
        return v


class OportunidadUpdate(BaseModel):
    nombre: Optional[str] = None
    lead_id: Optional[uuid.UUID] = None
    monto_estimado: Optional[float] = None
    etapa: Optional[EtapaOportunidad] = None
    probabilidad: Optional[int] = None
    cliente_id: Optional[uuid.UUID] = None
    fecha_cierre_estimada: Optional[date] = None
    notas: Optional[str] = None
    asignado_a: Optional[uuid.UUID] = None


class OportunidadResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    company_id: uuid.UUID
    lead_id: Optional[uuid.UUID]
    nombre: str
    monto_estimado: float
    etapa: str
    probabilidad: int
    cliente_id: Optional[uuid.UUID]
    fecha_cierre_estimada: Optional[date]
    notas: Optional[str]
    asignado_a: Optional[uuid.UUID]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class EtapaUpdate(BaseModel):
    etapa: EtapaOportunidad


class ActividadCreate(BaseModel):
    oportunidad_id: Optional[uuid.UUID] = None
    lead_id: Optional[uuid.UUID] = None
    tipo: TipoActividad
    titulo: str
    descripcion: Optional[str] = None
    fecha: date
    hora: Optional[time] = None
    duracion_min: Optional[int] = None
    completada: bool = False
    asignado_a: Optional[uuid.UUID] = None


class ActividadUpdate(BaseModel):
    oportunidad_id: Optional[uuid.UUID] = None
    lead_id: Optional[uuid.UUID] = None
    tipo: Optional[TipoActividad] = None
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    fecha: Optional[date] = None
    hora: Optional[time] = None
    duracion_min: Optional[int] = None
    completada: Optional[bool] = None
    asignado_a: Optional[uuid.UUID] = None


class ActividadResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    oportunidad_id: Optional[uuid.UUID]
    lead_id: Optional[uuid.UUID]
    tipo: str
    titulo: str
    descripcion: Optional[str]
    fecha: date
    hora: Optional[time]
    duracion_min: Optional[int]
    completada: bool
    asignado_a: Optional[uuid.UUID]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ActividadRealizadaCreate(BaseModel):
    notas: Optional[str] = None


class ActividadRealizadaResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    actividad_id: uuid.UUID
    user_id: uuid.UUID
    fecha_ejecucion: datetime
    notas: Optional[str]

    class Config:
        from_attributes = True


class PipelineStatsEtapa(BaseModel):
    etapa: str
    cantidad: int
    monto_total: float
    monto_ganado: float


class PipelineStats(BaseModel):
    total_oportunidades: int
    monto_total: float
    monto_ganado: float
    etapas: list[PipelineStatsEtapa]


class LeadStatsEstado(BaseModel):
    estado: str
    cantidad: int


class LeadStats(BaseModel):
    total: int
    promedio_puntaje: float
    por_estado: list[LeadStatsEstado]


class ActivityStatsTipo(BaseModel):
    tipo: str
    total: int
    completadas: int


class ActivityStats(BaseModel):
    total: int
    completadas: int
    pendientes: int
    por_tipo: list[ActivityStatsTipo]
