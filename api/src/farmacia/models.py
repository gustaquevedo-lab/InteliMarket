"""Farmacia / Drogueria models - state-of-the-art pharmacy backend.

19 modelos farm_* con enums Paraguay-aware (DINAVISA, JIFE, DINALFA).
"""
import uuid
from datetime import datetime, timezone
import sqlalchemy as sa
from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Text, Integer, ForeignKey, Date
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from api.src.db import Base


def _utcnow():
    return datetime.now(timezone.utc)


# Enums como constantes string
FORMA_FARMACEUTICA = [
    "comprimido", "capsula", "jarabe", "suspension", "inyectable", "crema",
    "pomada", "gel", "gotas", "spray", "supositorio", "ovulo", "parche",
    "solucion", "polvo", "ampolla", "tableta_masticable", "tableta_efervescente",
]

VIA_ADMINISTRACION = [
    "oral", "topica", "intravenosa", "intramuscular", "subcutanea",
    "intranasal", "inhalatoria", "rectal", "vaginal", "oftalmica",
    "otica", "sublingual", "transdermica",
]

CONTROLLED_CATEGORY = [
    "lista_1",   # Estupefacientes (Morfina, Codeina, Fentanilo)
    "lista_2",   # Sicotropicos (BZD, anfetaminas)
    "lista_3",   # Precursores quimicos
    "lista_4",   # Psicotropicos menores
    "libre",     # Venta libre
]

PRESCRIPTION_TYPE = [
    "venta_libre",
    "receta_simple",
    "receta_retenida",
    "receta_especial",
]

INTERACTION_SEVERITY = [
    "leve", "moderada", "grave", "contraindicada",
]

EMBARAZO_CATEGORIA = ["A", "B", "C", "D", "X", "N"]
SEXO = ["M", "F", "O"]

ESTADO_CUENTA_OS = [
    "pendiente", "enviada", "pago_parcial",
    "pagada", "vencida", "anulada",
]

TIPO_MOVIMIENTO_CONTROLADO = [
    "entrada_compra", "entrada_transferencia", "entrada_devolucion",
    "salida_venta", "salida_transferencia", "salida_destruccion",
    "salida_perdida", "salida_vencimiento", "ajuste_inventario", "arqueo",
]

ALERT_TIPO = ["critico", "proximo", "alerta", "informativo"]


# 1. Principios Activos (DCI)
class ActiveIngredient(Base):
    __tablename__ = "farm_active_ingredients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(200), nullable=False, index=True)
    nombre_comun = Column(String(200))
    dci = Column(String(200))
    codigo_atc = Column(String(20), index=True)
    categoria = Column(String(100))
    descripcion = Column(Text)
    dosis_maxima_diaria = Column(String(50))
    contraindicaciones = Column(Text)
    interactua_con = Column(ARRAY(String))
    embarazo_categoria = Column(String(5))
    requiere_receta = Column(Boolean, default=False)
    es_controlado = Column(Boolean, default=False)
    categoria_controlado = Column(String(20))
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


# 2. Medicamentos
class Medication(Base):
    __tablename__ = "farm_medications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, unique=True)
    principio_activo_id = Column(UUID(as_uuid=True), ForeignKey("farm_active_ingredients.id"), nullable=False, index=True)
    concentracion = Column(String(50), nullable=False)
    concentracion_numerica = Column(Numeric(10, 2))
    concentracion_unidad = Column(String(20))
    forma_farmaceutica = Column(String(20), nullable=False)
    via_administracion = Column(String(20))
    troquel = Column(String(50))
    registro_sanitario = Column(String(50))
    laboratorio = Column(String(100))
    marca_comercial = Column(String(200))
    es_generico = Column(Boolean, default=False)
    es_referencia = Column(Boolean, default=False)
    es_controlado = Column(Boolean, default=False)
    categoria_controlado = Column(String(20))
    requiere_receta_retencion = Column(Boolean, default=False)
    requiere_cadena_frio = Column(Boolean, default=False)
    temp_min = Column(Numeric(4, 1))
    temp_max = Column(Numeric(4, 1))
    protege_luz = Column(Boolean, default=False)
    posologia_habitual = Column(Text)
    contraindicaciones = Column(Text)
    efectos_adversos = Column(Text)
    interactua_con = Column(ARRAY(String))
    necesita_autorizacion_obra_social = Column(Boolean, default=False)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


# 3. Equivalentes terapeuticos
class MedicationEquivalent(Base):
    __tablename__ = "farm_equivalents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    medication_id = Column(UUID(as_uuid=True), ForeignKey("farm_medications.id"), nullable=False, index=True)
    equivalent_medication_id = Column(UUID(as_uuid=True), ForeignKey("farm_medications.id"), nullable=False, index=True)
    tipo = Column(String(20), default="generico")
    diferencia_precio_pct = Column(Numeric(5, 2))
    sustitucion_automatica = Column(Boolean, default=True)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)


# 4. Interacciones medicamentosas (DDI)
class DrugInteraction(Base):
    __tablename__ = "farm_interactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), index=True)
    principio_activo_a_id = Column(UUID(as_uuid=True), ForeignKey("farm_active_ingredients.id"), nullable=False, index=True)
    principio_activo_b_id = Column(UUID(as_uuid=True), ForeignKey("farm_active_ingredients.id"), nullable=False, index=True)
    severidad = Column(String(20), nullable=False, index=True)
    mecanismo = Column(Text)
    efecto_clinico = Column(Text)
    recomendacion = Column(Text)
    nivel_evidencia = Column(String(20))
    fuente = Column(String(100))
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    __table_args__ = (
        sa.UniqueConstraint("principio_activo_a_id", "principio_activo_b_id", name="uq_farm_intr_pair"),
    )


# 5. Pacientes
class Paciente(Base):
    __tablename__ = "farm_pacientes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), index=True)
    cedula = Column(String(20), index=True)
    nombre = Column(String(200), nullable=False)
    fecha_nacimiento = Column(Date, index=True)
    sexo = Column(String(1))
    peso_kg = Column(Numeric(5, 2))
    altura_cm = Column(Numeric(5, 2))
    telefono = Column(String(20))
    email = Column(String(200))
    direccion = Column(Text)
    embarazada = Column(Boolean, default=False)
    fecha_ultima_menstruacion = Column(Date)
    lactando = Column(Boolean, default=False)
    insuficiencia_renal = Column(Boolean, default=False)
    insuficiencia_hepatica = Column(Boolean, default=False)
    creatinina_mg_dl = Column(Numeric(5, 2))
    tfg_ml_min = Column(Numeric(5, 2))
    condiciones_cronicas = Column(ARRAY(String))
    observaciones = Column(Text)
    obra_social_id = Column(UUID(as_uuid=True), ForeignKey("farm_obras_sociales.id"), nullable=True, index=True)
    numero_afiliado = Column(String(50))
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class AlergiaPaciente(Base):
    __tablename__ = "farm_alergias_paciente"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    paciente_id = Column(UUID(as_uuid=True), ForeignKey("farm_pacientes.id"), nullable=False, index=True)
    principio_activo_id = Column(UUID(as_uuid=True), ForeignKey("farm_active_ingredients.id"), nullable=True)
    sustancia = Column(String(200), nullable=False)
    severidad = Column(String(20), nullable=False)
    reaccion = Column(Text)
    fecha_deteccion = Column(Date)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)


# 6. Medicos
class Medico(Base):
    __tablename__ = "farm_medicos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(200), nullable=False)
    matricula = Column(String(50), nullable=False, index=True)
    especialidad = Column(String(100), index=True)
    sub_especialidad = Column(String(100))
    telefono = Column(String(20))
    email = Column(String(200))
    direccion_consultorio = Column(Text)
    institucion = Column(String(200))
    verificado = Column(Boolean, default=False)
    verificado_at = Column(DateTime(timezone=True))
    fuente_verificacion = Column(String(100))
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


# 7. Obras sociales
class ObraSocial(Base):
    __tablename__ = "farm_obras_sociales"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(200), nullable=False, index=True)
    codigo = Column(String(20), index=True)
    ruc = Column(String(20))
    tipo = Column(String(50), default="obra_social")
    cobertura_default_pct = Column(Numeric(5, 2), default=0)
    tope_mensual_pyg = Column(Numeric(15, 0))
    requiere_autorizacion = Column(Boolean, default=False)
    dias_vencimiento_autorizacion = Column(Integer, default=30)
    plazo_pago_dias = Column(Integer, default=30)
    contacto_nombre = Column(String(200))
    contacto_telefono = Column(String(50))
    contacto_email = Column(String(200))
    direccion = Column(Text)
    sitio_web = Column(String(200))
    codigo_softfarm = Column(String(20))
    formato_archivo = Column(String(20), default="estandar")
    requiere_coseguro = Column(Boolean, default=True)
    observaciones = Column(Text)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class ObraSocialCobertura(Base):
    __tablename__ = "farm_os_cobertura"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    obra_social_id = Column(UUID(as_uuid=True), ForeignKey("farm_obras_sociales.id"), nullable=False, index=True)
    medication_id = Column(UUID(as_uuid=True), ForeignKey("farm_medications.id"), nullable=False, index=True)
    cobertura_pct = Column(Numeric(5, 2), nullable=False)
    copago_fijo_pyg = Column(Numeric(15, 0))
    requiere_autorizacion = Column(Boolean, default=False)
    limite_mensual_unidades = Column(Integer)
    limite_tratamiento_unidades = Column(Integer)
    observaciones = Column(Text)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)


# 8. Cuentas corrientes OS
class CuentaCorrienteOS(Base):
    __tablename__ = "farm_cuentas_corrientes_os"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    obra_social_id = Column(UUID(as_uuid=True), ForeignKey("farm_obras_sociales.id"), nullable=False, index=True)
    paciente_id = Column(UUID(as_uuid=True), ForeignKey("farm_pacientes.id"), nullable=True, index=True)
    sale_id = Column(UUID(as_uuid=True), index=True)
    prescription_id = Column(UUID(as_uuid=True), index=True)
    numero_comprobante = Column(String(50), index=True)
    fecha_emision = Column(Date, nullable=False)
    fecha_vencimiento = Column(Date, index=True)
    monto_total_pyg = Column(Numeric(15, 0), nullable=False)
    cobertura_pct = Column(Numeric(5, 2), nullable=False)
    monto_os_pyg = Column(Numeric(15, 0), nullable=False)
    monto_copago_pyg = Column(Numeric(15, 0), nullable=False)
    monto_cobrado_pyg = Column(Numeric(15, 0), default=0)
    estado = Column(String(20), default="pendiente", index=True)
    fecha_pago = Column(Date)
    numero_recibo_os = Column(String(50))
    dias_mora = Column(Integer, default=0)
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class FacturaOS(Base):
    __tablename__ = "farm_facturas_os"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    obra_social_id = Column(UUID(as_uuid=True), ForeignKey("farm_obras_sociales.id"), nullable=False, index=True)
    periodo_anio = Column(Integer, nullable=False)
    periodo_mes = Column(Integer, nullable=False)
    numero_factura = Column(String(50), unique=True, index=True)
    fecha_emision = Column(Date, nullable=False)
    fecha_vencimiento = Column(Date)
    cantidad_items = Column(Integer, default=0)
    monto_total_pyg = Column(Numeric(15, 0), nullable=False)
    estado = Column(String(20), default="pendiente")
    fecha_envio = Column(Date)
    fecha_pago = Column(Date)
    archivo_url = Column(Text)
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), default=_utcnow)


# 9. Recetas
class Receta(Base):
    __tablename__ = "farm_recetas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), index=True)
    paciente_id = Column(UUID(as_uuid=True), ForeignKey("farm_pacientes.id"), nullable=True, index=True)
    medico_id = Column(UUID(as_uuid=True), ForeignKey("farm_medicos.id"), nullable=True, index=True)
    sale_id = Column(UUID(as_uuid=True), index=True)
    medico_nombre = Column(String(200), nullable=False)
    medico_matricula = Column(String(50))
    medico_especialidad = Column(String(100))
    fecha_emision = Column(Date, nullable=False, index=True)
    fecha_vencimiento = Column(Date)
    numero_receta = Column(String(50), index=True)
    es_controlada = Column(Boolean, default=False)
    categoria_controlado = Column(String(20))
    tipo_receta = Column(String(20), default="receta_simple")
    items = Column(JSONB)
    diagnostico = Column(Text)
    estado = Column(String(20), default="pendiente")
    dispensado_parcial = Column(Boolean, default=False)
    imagen_url = Column(Text)
    imagen_retencion_url = Column(Text)
    observaciones = Column(Text)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


# 10. Dispensaciones
class Dispensacion(Base):
    __tablename__ = "farm_dispensaciones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    receta_id = Column(UUID(as_uuid=True), ForeignKey("farm_recetas.id"), nullable=False, index=True)
    paciente_id = Column(UUID(as_uuid=True), ForeignKey("farm_pacientes.id"), nullable=True, index=True)
    medication_id = Column(UUID(as_uuid=True), ForeignKey("farm_medications.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    sale_id = Column(UUID(as_uuid=True), index=True)
    lote_id = Column(UUID(as_uuid=True), index=True)
    cantidad = Column(Numeric(10, 3), nullable=False)
    dosis = Column(String(100))
    duracion_dias = Column(Integer)
    posologia = Column(Text)
    precio_unitario_pyg = Column(Numeric(15, 0), nullable=False)
    subtotal_pyg = Column(Numeric(15, 0), nullable=False)
    cobertura_pct = Column(Numeric(5, 2), default=0)
    monto_os_pyg = Column(Numeric(15, 0), default=0)
    monto_paciente_pyg = Column(Numeric(15, 0), nullable=False)
    alertas_safety = Column(JSONB)
    requiere_receta_cumplida = Column(Boolean, default=True)
    farmaceutico_user_id = Column(UUID(as_uuid=True), index=True)
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), default=_utcnow)


# 11. Alertas de vencimiento
class ExpirationAlert(Base):
    __tablename__ = "farm_expiration_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    medication_id = Column(UUID(as_uuid=True), ForeignKey("farm_medications.id"), nullable=True, index=True)
    warehouse_id = Column(UUID(as_uuid=True), index=True)
    lote = Column(String(50))
    fecha_vencimiento = Column(Date, nullable=False, index=True)
    cantidad = Column(Integer, nullable=False)
    alerta_tipo = Column(String(20), nullable=False, index=True)
    dias_restantes = Column(Integer)
    notificado = Column(Boolean, default=False)
    notificado_at = Column(DateTime(timezone=True))
    notificado_via = Column(String(50))
    resuelto = Column(Boolean, default=False)
    resuelto_at = Column(DateTime(timezone=True))
    resuelto_motivo = Column(String(100))
    resuelto_user_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


# 12. Libro de psicotropicos
class LibroPsicotropicos(Base):
    __tablename__ = "farm_libro_psicotropicos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    medication_id = Column(UUID(as_uuid=True), ForeignKey("farm_medications.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    sale_id = Column(UUID(as_uuid=True), index=True)
    prescription_id = Column(UUID(as_uuid=True), ForeignKey("farm_recetas.id"), nullable=True, index=True)
    lote = Column(String(50))
    cantidad = Column(Numeric(10, 3), nullable=False)
    tipo_movimiento = Column(String(20), nullable=False)
    patient_nombre = Column(String(200))
    patient_ci = Column(String(20), index=True)
    patient_direccion = Column(Text)
    receta_numero = Column(String(50))
    receta_fecha = Column(Date)
    receta_medico_nombre = Column(String(200))
    receta_medico_matricula = Column(String(50))
    receta_retencion = Column(Boolean, default=False)
    receta_archivada = Column(Boolean, default=False)
    reportado_dinalfa = Column(Boolean, default=False)
    reporte_fecha = Column(DateTime(timezone=True))
    observaciones = Column(Text)
    user_id = Column(UUID(as_uuid=True), index=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, index=True)


# 13. Arqueos
class ArqueoControlado(Base):
    __tablename__ = "farm_arqueos_controlados"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    medication_id = Column(UUID(as_uuid=True), ForeignKey("farm_medications.id"), nullable=False, index=True)
    fecha_arqueo = Column(Date, nullable=False, index=True)
    stock_sistema = Column(Numeric(12, 3), nullable=False)
    stock_fisico = Column(Numeric(12, 3), nullable=False)
    diferencia = Column(Numeric(12, 3), nullable=False)
    motivo_diferencia = Column(Text)
    regularizado = Column(Boolean, default=False)
    regularizado_at = Column(DateTime(timezone=True))
    user_id = Column(UUID(as_uuid=True), index=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)


# 14. Destruccion
class Destruccion(Base):
    __tablename__ = "farm_destrucciones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    fecha_destruccion = Column(Date, nullable=False, index=True)
    motivo = Column(String(100), nullable=False)
    metodo = Column(String(100))
    acta_numero = Column(String(50), unique=True, index=True)
    autoridad = Column(String(200))
    testigo1_nombre = Column(String(200))
    testigo1_ci = Column(String(20))
    testigo2_nombre = Column(String(200))
    testigo2_ci = Column(String(20))
    responsable_nombre = Column(String(200))
    responsable_ci = Column(String(20))
    foto_acta_url = Column(Text)
    observaciones = Column(Text)
    user_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    items = relationship("DestruccionItem", back_populates="destruccion", cascade="all, delete-orphan", lazy="selectin")


class DestruccionItem(Base):
    __tablename__ = "farm_destruccion_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    destruccion_id = Column(UUID(as_uuid=True), ForeignKey("farm_destrucciones.id", ondelete="CASCADE"), nullable=False, index=True)
    medication_id = Column(UUID(as_uuid=True), ForeignKey("farm_medications.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    lote = Column(String(50))
    fecha_vencimiento = Column(Date)
    cantidad = Column(Numeric(10, 3), nullable=False)

    destruccion = relationship("Destruccion", back_populates="items")


# 15. Reportes DINALFA
class DinalfaReport(Base):
    __tablename__ = "farm_dinalfa_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    periodo_anio = Column(Integer, nullable=False)
    periodo_mes = Column(Integer, nullable=False)
    categoria_controlado = Column(String(20), nullable=False)
    total_entradas = Column(Numeric(12, 3), default=0)
    total_salidas = Column(Numeric(12, 3), default=0)
    saldo_final = Column(Numeric(12, 3), default=0)
    total_movimientos = Column(Integer, default=0)
    pdf_url = Column(Text)
    pdf_hash_sha256 = Column(String(64), index=True)
    firma_digital = Column(Text)
    firmado_at = Column(DateTime(timezone=True))
    firmado_por_user_id = Column(UUID(as_uuid=True))
    qr_verificacion = Column(String(100), index=True)
    presentado = Column(Boolean, default=False)
    presentado_at = Column(DateTime(timezone=True))
    numero_recibido_dinavisa = Column(String(50))
    generado_por_user_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class PrevisionDinalfa(Base):
    __tablename__ = "farm_previsiones_dinalfa"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    anio = Column(Integer, nullable=False, index=True)
    medication_id = Column(UUID(as_uuid=True), ForeignKey("farm_medications.id"), nullable=False, index=True)
    categoria_controlado = Column(String(20), nullable=False)
    cantidad_prevista = Column(Numeric(12, 3), nullable=False)
    cantidad_ejecutada = Column(Numeric(12, 3), default=0)
    saldo_anio_anterior = Column(Numeric(12, 3), default=0)
    presentada = Column(Boolean, default=False)
    fecha_presentacion = Column(Date)
    numero_presentacion = Column(String(50), index=True)
    estado = Column(String(20), default="borrador", index=True)
    aprobada_at = Column(Date)
    observaciones_dinavisa = Column(Text)
    user_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


# 16. Cold chain map
class ColdChainMap(Base):
    __tablename__ = "farm_cold_chain_map"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    medication_id = Column(UUID(as_uuid=True), ForeignKey("farm_medications.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    sensor_id = Column(String(50), nullable=False, index=True)
    ubicacion = Column(String(100))
    temp_min_requerida = Column(Numeric(4, 1), nullable=False)
    temp_max_requerida = Column(Numeric(4, 1), nullable=False)
    tolerancia_minutos = Column(Integer, default=15)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)


class ColdChainLog(Base):
    __tablename__ = "farm_cold_chain"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    medication_id = Column(UUID(as_uuid=True), ForeignKey("farm_medications.id"), nullable=True, index=True)
    warehouse_id = Column(UUID(as_uuid=True), index=True)
    lote = Column(String(50))
    temperatura = Column(Numeric(5, 2), nullable=False)
    temp_min_esperada = Column(Numeric(5, 2))
    temp_max_esperada = Column(Numeric(5, 2))
    fuera_rango = Column(Boolean, default=False)
    tipo_registro = Column(String(20), default="manual")
    sensor_id = Column(String(50))
    ubicacion = Column(String(100))
    alerta_generada = Column(Boolean, default=False)
    alerta_motivo = Column(String(200))
    observaciones = Column(Text)
    user_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), default=_utcnow, index=True)


# 17. Farmacovigilancia
class Farmacovigilancia(Base):
    __tablename__ = "farm_farmacovigilancia"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    paciente_id = Column(UUID(as_uuid=True), ForeignKey("farm_pacientes.id"), nullable=True, index=True)
    medication_id = Column(UUID(as_uuid=True), ForeignKey("farm_medications.id"), nullable=True, index=True)
    product_id = Column(UUID(as_uuid=True), index=True)
    dispensacion_id = Column(UUID(as_uuid=True), index=True)
    fecha_evento = Column(Date, nullable=False, index=True)
    fecha_deteccion = Column(Date, nullable=False)
    sintoma = Column(Text, nullable=False)
    descripcion_completa = Column(Text)
    severidad = Column(String(20), nullable=False, index=True)
    causalidad = Column(String(20))
    metodo_causalidad = Column(String(50), default="Naranjo")
    desenlace = Column(String(50))
    requirio_hospitalizacion = Column(Boolean, default=False)
    puso_en_riesgo_vida = Column(Boolean, default=False)
    reportante_nombre = Column(String(200), nullable=False)
    reportante_email = Column(String(200))
    reportante_telefono = Column(String(50))
    reportante_profesion = Column(String(100))
    notificado_dinavisa = Column(Boolean, default=False)
    fecha_notificacion = Column(Date)
    numero_recibido_dinavisa = Column(String(50))
    user_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


# 18. Sesion POS
class FarmaciaSesionPOS(Base):
    __tablename__ = "farm_sesiones_pos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    branch_id = Column(UUID(as_uuid=True), index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_nombre = Column(String(200))
    abierta_at = Column(DateTime(timezone=True), default=_utcnow)
    cerrada_at = Column(DateTime(timezone=True))
    monto_inicial_pyg = Column(Numeric(15, 0), default=0)
    monto_final_esperado_pyg = Column(Numeric(15, 0))
    monto_final_declarado_pyg = Column(Numeric(15, 0))
    diferencia_pyg = Column(Numeric(15, 0))
    total_ventas = Column(Integer, default=0)
    total_recaudado_pyg = Column(Numeric(15, 0), default=0)
    total_dispensaciones = Column(Integer, default=0)
    alertas_seguridad_total = Column(Integer, default=0)
    estado = Column(String(20), default="abierta", index=True)
    observaciones = Column(Text)


# 19. Historial paciente / adherencia
class PacienteHistorial(Base):
    __tablename__ = "farm_paciente_historial"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), index=True)
    paciente_id = Column(UUID(as_uuid=True), ForeignKey("farm_pacientes.id"), nullable=True, index=True)
    medication_id = Column(UUID(as_uuid=True), ForeignKey("farm_medications.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    sale_id = Column(UUID(as_uuid=True), index=True)
    receta_id = Column(UUID(as_uuid=True), index=True)
    dispensacion_id = Column(UUID(as_uuid=True), index=True)
    cantidad = Column(Numeric(10, 3), nullable=False)
    posologia = Column(Text)
    duracion_dias = Column(Integer)
    medico_nombre = Column(String(200))
    proxima_dispensacion_esperada = Column(Date)
    dias_sin_reposicion = Column(Integer, default=0)
    adherencia_pct = Column(Numeric(5, 2))
    created_at = Column(DateTime(timezone=True), default=_utcnow, index=True)
