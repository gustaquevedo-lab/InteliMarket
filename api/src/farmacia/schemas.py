"""Farmacia schemas - Pydantic v2 compatible."""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal


class ActiveIngredientBase(BaseModel):
    nombre: str
    nombre_comun: Optional[str] = None
    dci: Optional[str] = None
    codigo_atc: Optional[str] = None
    categoria: Optional[str] = None
    descripcion: Optional[str] = None
    dosis_maxima_diaria: Optional[str] = None
    contraindicaciones: Optional[str] = None
    embarazo_categoria: Optional[str] = "N"
    requiere_receta: bool = False
    es_controlado: bool = False
    categoria_controlado: Optional[str] = None


class ActiveIngredientCreate(ActiveIngredientBase):
    pass


class ActiveIngredientUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    dosis_maxima_diaria: Optional[str] = None
    contraindicaciones: Optional[str] = None
    embarazo_categoria: Optional[str] = None
    activo: Optional[bool] = None


class ActiveIngredientResponse(ActiveIngredientBase):
    id: UUID
    company_id: UUID
    activo: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MedicationBase(BaseModel):
    product_id: UUID
    principio_activo_id: UUID
    concentracion: str
    concentracion_numerica: Optional[Decimal] = None
    concentracion_unidad: Optional[str] = None
    forma_farmaceutica: str
    via_administracion: Optional[str] = "oral"
    troquel: Optional[str] = None
    registro_sanitario: Optional[str] = None
    laboratorio: Optional[str] = None
    marca_comercial: Optional[str] = None
    es_generico: bool = False
    es_referencia: bool = False
    es_controlado: bool = False
    categoria_controlado: Optional[str] = None
    requiere_receta_retencion: bool = False
    requiere_cadena_frio: bool = False
    temp_min: Optional[Decimal] = None
    temp_max: Optional[Decimal] = None
    protege_luz: bool = False
    posologia_habitual: Optional[str] = None
    contraindicaciones: Optional[str] = None
    efectos_adversos: Optional[str] = None


class MedicationCreate(MedicationBase):
    pass


class MedicationUpdate(BaseModel):
    concentracion: Optional[str] = None
    laboratorio: Optional[str] = None
    marca_comercial: Optional[str] = None
    es_generico: Optional[bool] = None
    posologia_habitual: Optional[str] = None
    contraindicaciones: Optional[str] = None
    efectos_adversos: Optional[str] = None
    activo: Optional[bool] = None


class MedicationResponse(MedicationBase):
    id: UUID
    company_id: UUID
    activo: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    principio_activo_nombre: Optional[str] = None

    class Config:
        from_attributes = True


class MedicationSearchResult(BaseModel):
    medication: MedicationResponse
    precio_venta_pyg: Decimal
    disponible: bool
    stock_actual: int
    equivalentes: List[UUID] = Field(default_factory=list)


class DrugInteractionBase(BaseModel):
    principio_activo_a_id: UUID
    principio_activo_b_id: UUID
    severidad: str
    mecanismo: Optional[str] = None
    efecto_clinico: Optional[str] = None
    recomendacion: Optional[str] = None
    nivel_evidencia: Optional[str] = "moderado"
    fuente: Optional[str] = None


class DrugInteractionCreate(DrugInteractionBase):
    pass


class DrugInteractionResponse(DrugInteractionBase):
    id: UUID
    activo: bool
    pa_a_nombre: Optional[str] = None
    pa_b_nombre: Optional[str] = None

    class Config:
        from_attributes = True


class PacienteBase(BaseModel):
    cedula: Optional[str] = None
    nombre: str
    fecha_nacimiento: Optional[date] = None
    sexo: Optional[str] = "O"
    peso_kg: Optional[Decimal] = None
    altura_cm: Optional[Decimal] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None
    embarazada: bool = False
    fecha_ultima_menstruacion: Optional[date] = None
    lactando: bool = False
    insuficiencia_renal: bool = False
    insuficiencia_hepatica: bool = False
    creatinina_mg_dl: Optional[Decimal] = None
    tfg_ml_min: Optional[Decimal] = None
    condiciones_cronicas: List[str] = Field(default_factory=list)
    obra_social_id: Optional[UUID] = None
    numero_afiliado: Optional[str] = None
    observaciones: Optional[str] = None


class PacienteCreate(PacienteBase):
    customer_id: Optional[UUID] = None


class PacienteUpdate(BaseModel):
    nombre: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    peso_kg: Optional[Decimal] = None
    embarazada: Optional[bool] = None
    lactando: Optional[bool] = None
    insuficiencia_renal: Optional[bool] = None
    creatinina_mg_dl: Optional[Decimal] = None
    condiciones_cronicas: Optional[List[str]] = None
    obra_social_id: Optional[UUID] = None
    numero_afiliado: Optional[str] = None


class PacienteResponse(PacienteBase):
    id: UUID
    company_id: UUID
    customer_id: Optional[UUID] = None
    activo: bool
    created_at: datetime
    edad: Optional[int] = None
    obra_social_nombre: Optional[str] = None
    alergias_count: int = 0

    class Config:
        from_attributes = True


class AlergiaBase(BaseModel):
    paciente_id: UUID
    principio_activo_id: Optional[UUID] = None
    sustancia: str
    severidad: str
    reaccion: Optional[str] = None
    fecha_deteccion: Optional[date] = None


class AlergiaCreate(AlergiaBase):
    pass


class AlergiaResponse(AlergiaBase):
    id: UUID
    activo: bool
    created_at: datetime

    class Config:
        from_attributes = True


class MedicoBase(BaseModel):
    nombre: str
    matricula: str
    especialidad: Optional[str] = None
    sub_especialidad: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion_consultorio: Optional[str] = None
    institucion: Optional[str] = None


class MedicoCreate(MedicoBase):
    pass


class MedicoUpdate(BaseModel):
    nombre: Optional[str] = None
    especialidad: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    verificado: Optional[bool] = None


class MedicoResponse(MedicoBase):
    id: UUID
    company_id: UUID
    verificado: bool
    verificado_at: Optional[datetime] = None
    fuente_verificacion: Optional[str] = None
    activo: bool
    created_at: datetime
    recetas_count: int = 0

    class Config:
        from_attributes = True


class ObraSocialBase(BaseModel):
    nombre: str
    codigo: Optional[str] = None
    ruc: Optional[str] = None
    tipo: str = "obra_social"
    cobertura_default_pct: Decimal = Decimal("0")
    tope_mensual_pyg: Optional[Decimal] = None
    requiere_autorizacion: bool = False
    dias_vencimiento_autorizacion: int = 30
    plazo_pago_dias: int = 30
    contacto_nombre: Optional[str] = None
    contacto_telefono: Optional[str] = None
    contacto_email: Optional[str] = None
    requiere_coseguro: bool = True
    observaciones: Optional[str] = None


class ObraSocialCreate(ObraSocialBase):
    pass


class ObraSocialResponse(ObraSocialBase):
    id: UUID
    company_id: UUID
    activo: bool
    created_at: datetime
    pacientes_count: int = 0
    recetas_mes_actual: int = 0

    class Config:
        from_attributes = True


class CoberturaCreate(BaseModel):
    obra_social_id: UUID
    medication_id: UUID
    cobertura_pct: Decimal
    copago_fijo_pyg: Optional[Decimal] = None
    requiere_autorizacion: bool = False
    limite_mensual_unidades: Optional[int] = None


class CoberturaResponse(CoberturaCreate):
    id: UUID
    company_id: UUID
    activo: bool

    class Config:
        from_attributes = True


class PriceCalcRequest(BaseModel):
    obra_social_id: UUID
    medication_id: UUID
    cantidad: Decimal = Decimal("1")
    precio_unitario_pyg: Decimal


class PriceCalcResponse(BaseModel):
    precio_unitario_pyg: Decimal
    cantidad: Decimal
    subtotal_pyg: Decimal
    cobertura_pct: Decimal
    monto_os_pyg: Decimal
    monto_paciente_pyg: Decimal
    copago_fijo_pyg: Optional[Decimal] = None
    requiere_autorizacion: bool = False
    fuente: str


class RecetaItem(BaseModel):
    medication_id: UUID
    dosis: Optional[str] = None
    cantidad: Decimal
    duracion_dias: Optional[int] = None
    posologia: Optional[str] = None


class RecetaBase(BaseModel):
    paciente_id: Optional[UUID] = None
    medico_id: Optional[UUID] = None
    medico_nombre: str
    medico_matricula: Optional[str] = None
    medico_especialidad: Optional[str] = None
    fecha_emision: date
    fecha_vencimiento: Optional[date] = None
    numero_receta: Optional[str] = None
    es_controlada: bool = False
    categoria_controlado: Optional[str] = None
    tipo_receta: str = "receta_simple"
    diagnostico: Optional[str] = None
    items: List[RecetaItem] = Field(default_factory=list)
    imagen_url: Optional[str] = None
    imagen_retencion_url: Optional[str] = None
    observaciones: Optional[str] = None


class RecetaCreate(RecetaBase):
    customer_id: Optional[UUID] = None
    sale_id: Optional[UUID] = None


class RecetaUpdate(BaseModel):
    estado: Optional[str] = None
    dispensado_parcial: Optional[bool] = None
    observaciones: Optional[str] = None


class RecetaResponse(RecetaBase):
    id: UUID
    company_id: UUID
    customer_id: Optional[UUID] = None
    sale_id: Optional[UUID] = None
    estado: str
    dispensado_parcial: bool
    activo: bool
    created_at: datetime
    paciente_nombre: Optional[str] = None
    medico_especialidad_nombre: Optional[str] = None

    class Config:
        from_attributes = True


class DispensacionItemCreate(BaseModel):
    medication_id: UUID
    product_id: UUID
    cantidad: Decimal
    dosis: Optional[str] = None
    duracion_dias: Optional[int] = None
    posologia: Optional[str] = None
    precio_unitario_pyg: Decimal
    obra_social_id: Optional[UUID] = None
    lote_id: Optional[UUID] = None


class DispensacionCreate(BaseModel):
    receta_id: Optional[UUID] = None
    paciente_id: Optional[UUID] = None
    items: List[DispensacionItemCreate] = Field(default_factory=list)
    forzar_dispensacion: bool = False
    observaciones: Optional[str] = None


class DispensacionResponse(BaseModel):
    id: UUID
    company_id: UUID
    receta_id: UUID
    medication_id: UUID
    product_id: UUID
    paciente_id: Optional[UUID] = None
    cantidad: Decimal
    dosis: Optional[str] = None
    posologia: Optional[str] = None
    precio_unitario_pyg: Decimal
    subtotal_pyg: Decimal
    cobertura_pct: Decimal
    monto_os_pyg: Decimal
    monto_paciente_pyg: Decimal
    alertas_safety: List[Dict[str, Any]] = Field(default_factory=list)
    farmaceutico_user_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


class POSDispensarRequest(BaseModel):
    paciente_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    receta_id: Optional[UUID] = None
    obra_social_id: Optional[UUID] = None
    items: List[DispensacionItemCreate] = Field(default_factory=list)
    forzar_dispensacion: bool = False
    observaciones: Optional[str] = None


class POSDispensarResponse(BaseModel):
    dispensaciones: List[DispensacionResponse]
    alertas_safety: List[Dict[str, Any]] = Field(default_factory=list)
    alertas_blocking: List[Dict[str, Any]] = Field(default_factory=list)
    total_pyg: Decimal
    total_os_pyg: Decimal
    total_paciente_pyg: Decimal
    puede_dispensar: bool
    mensaje: str
    sale_id: Optional[UUID] = None
    cuentas_corrientes_generadas: List[UUID] = Field(default_factory=list)


class SafetyAlert(BaseModel):
    tipo: str
    nivel: str
    codigo: str
    mensaje: str
    detalles: Optional[Dict[str, Any]] = None
    recomendacion: Optional[str] = None


class SafetyCheckRequest(BaseModel):
    paciente_id: Optional[UUID] = None
    medications_ids: List[UUID] = Field(default_factory=list)
    principio_activo_ids: List[UUID] = Field(default_factory=list)
    otros_medicamentos_paciente: List[UUID] = Field(default_factory=list)


class SafetyCheckResponse(BaseModel):
    puede_dispensar: bool
    alertas: List[SafetyAlert] = Field(default_factory=list)
    alertas_blocking: List[SafetyAlert] = Field(default_factory=list)
    mensaje: str
    nivel_maximo: str


class ExpirationAlertResponse(BaseModel):
    id: UUID
    product_id: UUID
    medication_id: Optional[UUID] = None
    lote: Optional[str] = None
    fecha_vencimiento: date
    dias_restantes: Optional[int] = None
    cantidad: int
    alerta_tipo: str
    notificado: bool
    resuelto: bool
    creado_at: datetime

    class Config:
        from_attributes = True


class LibroPsicotropicoCreate(BaseModel):
    medication_id: UUID
    product_id: UUID
    cantidad: Decimal
    tipo_movimiento: str
    prescription_id: Optional[UUID] = None
    sale_id: Optional[UUID] = None
    lote: Optional[str] = None
    patient_nombre: Optional[str] = None
    patient_ci: Optional[str] = None
    patient_direccion: Optional[str] = None
    receta_numero: Optional[str] = None
    receta_fecha: Optional[date] = None
    receta_medico_nombre: Optional[str] = None
    receta_medico_matricula: Optional[str] = None
    receta_retencion: bool = False
    observaciones: Optional[str] = None


class LibroPsicotropicoResponse(LibroPsicotropicoCreate):
    id: UUID
    company_id: UUID
    reportado_dinalfa: bool
    reporte_fecha: Optional[datetime] = None
    created_at: datetime
    medication_nombre: Optional[str] = None

    class Config:
        from_attributes = True


class ArqueoCreate(BaseModel):
    medication_id: UUID
    fecha_arqueo: date
    stock_fisico: Decimal
    motivo_diferencia: Optional[str] = None


class ArqueoResponse(ArqueoCreate):
    id: UUID
    company_id: UUID
    stock_sistema: Decimal
    diferencia: Decimal
    regularizado: bool
    created_at: datetime

    class Config:
        from_attributes = True


class DestruccionItemCreate(BaseModel):
    medication_id: UUID
    product_id: UUID
    lote: Optional[str] = None
    fecha_vencimiento: Optional[date] = None
    cantidad: Decimal


class DestruccionCreate(BaseModel):
    fecha_destruccion: date
    motivo: str
    metodo: Optional[str] = None
    autoridad: Optional[str] = None
    testigo1_nombre: Optional[str] = None
    testigo1_ci: Optional[str] = None
    testigo2_nombre: Optional[str] = None
    testigo2_ci: Optional[str] = None
    responsable_nombre: Optional[str] = None
    responsable_ci: Optional[str] = None
    items: List[DestruccionItemCreate] = Field(default_factory=list)
    observaciones: Optional[str] = None


class DestruccionResponse(BaseModel):
    id: UUID
    company_id: UUID
    fecha_destruccion: date
    motivo: str
    metodo: Optional[str] = None
    acta_numero: Optional[str] = None
    autoridad: Optional[str] = None
    responsable_nombre: Optional[str] = None
    created_at: datetime
    items_count: int = 0

    class Config:
        from_attributes = True


class DinalfaReportResponse(BaseModel):
    id: UUID
    company_id: UUID
    periodo_anio: int
    periodo_mes: int
    categoria_controlado: str
    total_entradas: Decimal
    total_salidas: Decimal
    saldo_final: Decimal
    total_movimientos: int
    pdf_url: Optional[str] = None
    pdf_hash_sha256: Optional[str] = None
    firmado_at: Optional[datetime] = None
    qr_verificacion: Optional[str] = None
    presentado: bool
    numero_recibido_dinavisa: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ColdChainMapCreate(BaseModel):
    medication_id: UUID
    product_id: UUID
    sensor_id: str
    ubicacion: Optional[str] = None
    temp_min_requerida: Decimal
    temp_max_requerida: Decimal
    tolerancia_minutos: int = 15


class ColdChainLogCreate(BaseModel):
    product_id: UUID
    medication_id: Optional[UUID] = None
    warehouse_id: Optional[UUID] = None
    lote: Optional[str] = None
    temperatura: Decimal
    temp_min_esperada: Optional[Decimal] = None
    temp_max_esperada: Optional[Decimal] = None
    sensor_id: Optional[str] = None
    ubicacion: Optional[str] = None
    observaciones: Optional[str] = None


class ColdChainResponse(BaseModel):
    id: UUID
    company_id: UUID
    product_id: UUID
    medication_id: Optional[UUID] = None
    temperatura: Decimal
    temp_min_esperada: Optional[Decimal] = None
    temp_max_esperada: Optional[Decimal] = None
    fuera_rango: bool
    tipo_registro: str
    sensor_id: Optional[str] = None
    alerta_generada: bool
    alerta_motivo: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ColdChainAlertaItem(BaseModel):
    log_id: UUID
    medication_id: Optional[UUID] = None
    medication_nombre: Optional[str] = None
    product_id: UUID
    sensor_id: Optional[str] = None
    temperatura: Decimal
    temp_min: Decimal
    temp_max: Decimal
    tiempo_fuera_minutos: int
    ubicacion: Optional[str] = None
    created_at: datetime


class FarmacovigilanciaCreate(BaseModel):
    paciente_id: Optional[UUID] = None
    medication_id: Optional[UUID] = None
    product_id: Optional[UUID] = None
    dispensacion_id: Optional[UUID] = None
    fecha_evento: date
    fecha_deteccion: date
    sintoma: str
    descripcion_completa: Optional[str] = None
    severidad: str
    causalidad: Optional[str] = None
    metodo_causalidad: str = "Naranjo"
    desenlace: Optional[str] = None
    requirio_hospitalizacion: bool = False
    puso_en_riesgo_vida: bool = False
    reportante_nombre: str
    reportante_email: Optional[str] = None
    reportante_telefono: Optional[str] = None
    reportante_profesion: Optional[str] = None


class FarmacovigilanciaResponse(FarmacovigilanciaCreate):
    id: UUID
    company_id: UUID
    notificado_dinavisa: bool
    fecha_notificacion: Optional[date] = None
    numero_recibido_dinavisa: Optional[str] = None
    created_at: datetime
    paciente_nombre: Optional[str] = None
    medication_nombre: Optional[str] = None

    class Config:
        from_attributes = True


class FarmaciaDashboardData(BaseModel):
    kpis_principales: Dict[str, Any] = Field(default_factory=dict)
    top_medicamentos: List[Dict[str, Any]] = Field(default_factory=list)
    alertas_vencimiento: List[ExpirationAlertResponse] = Field(default_factory=list)
    alertas_safety_hoy: int = 0
    aging_os: Dict[str, Any] = Field(default_factory=dict)
    control_summary: Dict[str, Any] = Field(default_factory=dict)
    cold_chain_summary: Dict[str, Any] = Field(default_factory=dict)
    farmacovigilancia_summary: Dict[str, Any] = Field(default_factory=dict)
    generated_at: datetime


class CuentaCorrienteOSCreate(BaseModel):
    obra_social_id: UUID
    paciente_id: Optional[UUID] = None
    sale_id: Optional[UUID] = None
    prescription_id: Optional[UUID] = None
    numero_comprobante: Optional[str] = None
    fecha_emision: date
    fecha_vencimiento: date
    monto_total_pyg: Decimal
    cobertura_pct: Decimal
    monto_os_pyg: Decimal
    monto_copago_pyg: Decimal
    observaciones: Optional[str] = None


class CuentaCorrienteOSResponse(CuentaCorrienteOSCreate):
    id: UUID
    company_id: UUID
    monto_cobrado_pyg: Decimal
    estado: str
    fecha_pago: Optional[date] = None
    numero_recibo_os: Optional[str] = None
    dias_mora: int
    created_at: datetime
    obra_social_nombre: Optional[str] = None

    class Config:
        from_attributes = True
