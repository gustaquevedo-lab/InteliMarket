"""Modelos del modulo Servicios Profesionales (sv_*).

Omni-servicios: HVAC, plomeria, electricidad, belleza, fitness, salud,
automotriz, construccion, IT, freelance profesional.

Inspirado en ServiceTitan, Jobber, Housecall Pro con sabor Paraguay.
"""
from sqlalchemy import (Column, String, Integer, Numeric, Boolean, DateTime,
                         Date, Text, ForeignKey, JSON, Float, Time, Index, UniqueConstraint)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.sql import func
import uuid
from datetime import datetime, timezone

from api.src.db import Base


def _utcnow():
    return datetime.now(timezone.utc)


def _uuid():
    return uuid.uuid4()


# ============================================================
# ENUMS (string-based para evitar problemas de migracion)
# ============================================================

# ServiceVertical.industria: hvac, plomeria, electricidad, pintura, carpinteria,
#   jardineria, limpieza, belleza, fitness, salud, dental, veterinario,
#   automotriz, construccion, it, pest_control, electrodomesticos, freelance

# Skill.categoria: tecnica, profesional, belleza, salud, automotriz, otro

# Technician.tipo: interno, contratista, freelance
# Technician.modalidad: tiempo_completo, medio_tiempo, por_horas, por_visita

# Certification.tipo: matricula, certificacion_tecnica, seguro, habilitacion,
#   permiso_municipal, curso

# Quote.estado: borrador, enviada, aprobada, rechazada, vencida, convertida_wo
# QuoteItem.tipo: mano_obra, material, equipo, subcontrato, otro

# Appointment.estado: agendada, confirmada, en_camino, en_sitio, completada,
#   cancelada, no_show, reagendada
# Appointment.tipo: consulta, cotizacion, instalacion, reparacion, mantenimiento,
#   emergencia, inspeccion, entrega

# WorkOrder.estado: agendada, en_camino, en_sitio, en_progreso, completada,
#   aprobada_cliente, facturada, cobrada, cancelada, garantia
# WorkOrder.prioridad: baja, normal, alta, urgente, emergencia

# ServiceContract.frecuencia: mensual, bimestral, trimestral, semestral, anual
# ServiceContract.estado: activo, pausado, vencido, cancelado, pendiente_renovacion

# Invoice.estado: borrador, emitida, pagada, parcial, vencida, anulada
# Invoice.metodo_pago: efectivo, transferencia, tarjeta, qr, cheque, retencion


# ============================================================
# 1. CATALOGO DE VERTICALES DE SERVICIO
# ============================================================
class ServiceVertical(Base):
    __tablename__ = "sv_service_verticals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    codigo = Column(String(50), unique=True, nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text)
    icono = Column(String(50))
    color = Column(String(20))
    pais = Column(String(2), default="PY")
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)


# ============================================================
# 2. CATALOGO DE SKILLS / COMPETENCIAS
# ============================================================
class Skill(Base):
    __tablename__ = "sv_skills"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    codigo = Column(String(50), unique=True, nullable=False, index=True)
    nombre = Column(String(200), nullable=False)
    categoria = Column(String(50), index=True)
    descripcion = Column(Text)
    nivel_maximo = Column(Integer, default=5)  # 1=basico, 5=experto
    certificacion_requerida = Column(Boolean, default=False)
    skill_padre_id = Column(UUID(as_uuid=True), ForeignKey("sv_skills.id"), nullable=True)  # jerarquia
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)


# ============================================================
# 3. TECNICOS / PROFESIONALES
# ============================================================
class Technician(Base):
    __tablename__ = "sv_technicians"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), index=True)  # link opcional a tabla users
    vertical_codigo = Column(String(50), index=True)  # ref ServiceVertical.codigo
    nombre = Column(String(200), nullable=False)
    ci = Column(String(20), index=True)
    telefono = Column(String(30))
    email = Column(String(200))
    foto_url = Column(Text)
    tipo = Column(String(20), default="interno")  # interno, contratista, freelance
    modalidad = Column(String(30), default="tiempo_completo")
    fecha_ingreso = Column(Date)
    tarifa_hora_pyg = Column(Numeric(15, 0), default=0)
    tarifa_visita_pyg = Column(Numeric(15, 0), default=0)
    comision_pct = Column(Numeric(5, 2), default=0)  # % comision por venta
    zonas_cobertura = Column(ARRAY(String))  # zonas/barrios
    lat_base = Column(Numeric(10, 7))  # base para dispatch
    lng_base = Column(Numeric(10, 7))
    rating_promedio = Column(Numeric(3, 2), default=5.0)
    total_servicios = Column(Integer, default=0)
    total_clientes = Column(Integer, default=0)
    primera_visita_pct = Column(Numeric(5, 2), default=0)  # first-time fix rate
    es_lider_equipo = Column(Boolean, default=False)
    biografia = Column(Text)
    color_calendario = Column(String(20), default="#3b82f6")
    activo = Column(Boolean, default=True)
    disponible = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


# ============================================================
# 4. SKILLS POR TECNICO (many-to-many)
# ============================================================
class TechnicianSkill(Base):
    __tablename__ = "sv_technician_skills"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    technician_id = Column(UUID(as_uuid=True), ForeignKey("sv_technicians.id", ondelete="CASCADE"), nullable=False, index=True)
    skill_id = Column(UUID(as_uuid=True), ForeignKey("sv_skills.id"), nullable=False, index=True)
    nivel = Column(Integer, default=1)  # 1-5
    certificado = Column(Boolean, default=False)
    fecha_adquisicion = Column(Date)
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    __table_args__ = (UniqueConstraint("technician_id", "skill_id", name="uq_sv_tech_skill"),)


# ============================================================
# 5. CERTIFICACIONES DE TECNICOS
# ============================================================
class TechnicianCertification(Base):
    __tablename__ = "sv_technician_certifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    technician_id = Column(UUID(as_uuid=True), ForeignKey("sv_technicians.id", ondelete="CASCADE"), nullable=False, index=True)
    tipo = Column(String(50), nullable=False)
    nombre = Column(String(200), nullable=False)
    institucion = Column(String(200))
    numero = Column(String(100))
    fecha_emision = Column(Date)
    fecha_vencimiento = Column(Date, index=True)
    dias_para_vencer = Column(Integer)
    alerta_enviada = Column(Boolean, default=False)
    alerta_dias = Column(Integer, default=30)  # dias antes para alertar
    archivo_url = Column(Text)
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), default=_utcnow)


# ============================================================
# 6. DISPONIBILIDAD SEMANAL
# ============================================================
class TechnicianAvailability(Base):
    __tablename__ = "sv_technician_availability"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    technician_id = Column(UUID(as_uuid=True), ForeignKey("sv_technicians.id", ondelete="CASCADE"), nullable=False, index=True)
    dia_semana = Column(Integer, nullable=False)  # 0=lunes ... 6=domingo
    hora_desde = Column(Time, nullable=False)
    hora_hasta = Column(Time, nullable=False)
    disponible = Column(Boolean, default=True)
    es_receso = Column(Boolean, default=False)
    notas = Column(String(200))
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    __table_args__ = (UniqueConstraint("technician_id", "dia_semana", "hora_desde", name="uq_sv_avail_slot"),)


# ============================================================
# 7. EQUIPOS DE TRABAJO
# ============================================================
class Team(Base):
    __tablename__ = "sv_teams"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text)
    lider_technician_id = Column(UUID(as_uuid=True), ForeignKey("sv_technicians.id"), nullable=True)
    color = Column(String(20), default="#10b981")
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


# ============================================================
# 8. MIEMBROS DE EQUIPO
# ============================================================
class TeamMember(Base):
    __tablename__ = "sv_team_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    team_id = Column(UUID(as_uuid=True), ForeignKey("sv_teams.id", ondelete="CASCADE"), nullable=False, index=True)
    technician_id = Column(UUID(as_uuid=True), ForeignKey("sv_technicians.id", ondelete="CASCADE"), nullable=False, index=True)
    rol = Column(String(50), default="miembro")
    fecha_alta = Column(Date)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    __table_args__ = (UniqueConstraint("team_id", "technician_id", name="uq_sv_team_member"),)


# ============================================================
# 9. ZONAS DE SERVICIO
# ============================================================
class ServiceZone(Base):
    __tablename__ = "sv_service_zones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    ciudad = Column(String(100), index=True)
    departamento = Column(String(100), index=True)
    codigo_postal = Column(String(20))
    poligono = Column(JSONB)  # geojson polygon opcional
    radio_km = Column(Numeric(8, 2), default=10.0)
    recargo_km_pyg = Column(Numeric(10, 0), default=0)
    tiempo_promedio_minutos = Column(Integer, default=30)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)


# ============================================================
# 10. PROPIEDADES / SITIOS DEL CLIENTE
# ============================================================
class Property(Base):
    __tablename__ = "sv_properties"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)  # ref customers
    nombre = Column(String(200), nullable=False)
    tipo = Column(String(50), default="residencial")  # residencial, comercial, corporativo, industrial
    direccion = Column(String(500), nullable=False)
    ciudad = Column(String(100))
    departamento = Column(String(100))
    codigo_postal = Column(String(20))
    lat = Column(Numeric(10, 7))
    lng = Column(Numeric(10, 7))
    zona_id = Column(UUID(as_uuid=True), ForeignKey("sv_service_zones.id"), nullable=True)
    metros_cuadrados = Column(Numeric(10, 2))
    pisos = Column(Integer, default=1)
    habitaciones = Column(Integer)
    banos = Column(Numeric(3, 1))
    acceso_notas = Column(Text)  # "puerta azul", "portero Juan", etc
    contacto_nombre = Column(String(200))
    contacto_telefono = Column(String(50))
    notas = Column(Text)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


# ============================================================
# 11. EQUIPOS A MANTENER (AC, calderas, ascensores)
# ============================================================
class Equipment(Base):
    __tablename__ = "sv_equipment"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    property_id = Column(UUID(as_uuid=True), ForeignKey("sv_properties.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)  # denormalizado
    tipo = Column(String(50), nullable=False, index=True)  # aire_acondicionado, caldera, ascensor, generador, bomba, heladera_comercial
    marca = Column(String(100))
    modelo = Column(String(100))
    numero_serie = Column(String(100), index=True)
    capacidad = Column(String(100))  # "12000 BTU", "5000W"
    fecha_instalacion = Column(Date)
    fecha_garantia_fin = Column(Date)
    ubicacion = Column(String(200))  # "sala principal", "techo", "sotano"
    requiere_mantenimiento = Column(Boolean, default=True)
    frecuencia_mantenimiento_dias = Column(Integer, default=180)  # 6 meses default
    ultimo_mantenimiento = Column(Date)
    proximo_mantenimiento = Column(Date, index=True)
    estado = Column(String(20), default="operativo")  # operativo, reparacion, dado_baja, garantia
    notas = Column(Text)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


# ============================================================
# 12. COTIZACIONES / PRESUPUESTOS
# ============================================================
class ServiceQuote(Base):
    __tablename__ = "sv_quotes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    numero = Column(String(50), unique=True, nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    property_id = Column(UUID(as_uuid=True), ForeignKey("sv_properties.id"), nullable=True)
    equipment_id = Column(UUID(as_uuid=True), ForeignKey("sv_equipment.id"), nullable=True)
    technician_id = Column(UUID(as_uuid=True), ForeignKey("sv_technicians.id"), nullable=True)
    vertical_codigo = Column(String(50), index=True)
    titulo = Column(String(300), nullable=False)
    descripcion = Column(Text)
    estado = Column(String(20), default="borrador", index=True)
    fecha_cotizacion = Column(Date, default=func.current_date())
    fecha_validez = Column(Date)
    fecha_aprobacion = Column(Date)
    duracion_estimada_horas = Column(Numeric(8, 2))
    fecha_inicio_estimada = Column(Date)
    subtmano_obra = Column( Numeric(15, 0), default=0)
    subtotal_materiales = Column(Numeric(15, 0), default=0)
    subtotal_equipos = Column(Numeric(15, 0), default=0)
    subtotal_subcontratos = Column(Numeric(15, 0), default=0)
    descuento_pct = Column(Numeric(5, 2), default=0)
    descuento_monto = Column(Numeric(15, 0), default=0)
    iva_pct = Column(Numeric(5, 2), default=10)
    iva_monto = Column(Numeric(15, 0), default=0)
    total = Column(Numeric(15, 0), default=0)
    condiciones = Column(Text)
    tiempo_validez_dias = Column(Integer, default=15)
    aprobado_por = Column(String(200))
    metodo_pago_propuesto = Column(String(50))
    notas_internas = Column(Text)
    pdf_url = Column(Text)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
    items_relation = relationship("ServiceQuoteItem", back_populates="quote", cascade="all, delete-orphan", lazy="selectin")


# ============================================================
# 13. ITEMS DE COTIZACION
# ============================================================
class ServiceQuoteItem(Base):
    __tablename__ = "sv_quote_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    quote_id = Column(UUID(as_uuid=True), ForeignKey("sv_quotes.id", ondelete="CASCADE"), nullable=False, index=True)
    tipo = Column(String(20), nullable=False)  # mano_obra, material, equipo, subcontrato
    codigo = Column(String(50))
    descripcion = Column(String(500), nullable=False)
    detalle = Column(Text)
    cantidad = Column(Numeric(10, 2), default=1)
    unidad = Column(String(20), default="UN")
    precio_unitario = Column(Numeric(15, 0), default=0)
    descuento_pct = Column(Numeric(5, 2), default=0)
    subtotal = Column(Numeric(15, 0), default=0)
    iva_incluido = Column(Boolean, default=True)
    orden = Column(Integer, default=0)
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    quote = relationship("ServiceQuote", back_populates="items_relation")


# ============================================================
# 14. FOTOS DE COTIZACION
# ============================================================
class QuotePhoto(Base):
    __tablename__ = "sv_quote_photos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    quote_id = Column(UUID(as_uuid=True), ForeignKey("sv_quotes.id", ondelete="CASCADE"), nullable=False, index=True)
    url = Column(Text, nullable=False)
    thumbnail_url = Column(Text)
    descripcion = Column(String(300))
    orden = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=_utcnow)


# ============================================================
# 15. AGENDA / CITAS
# ============================================================
class Appointment(Base):
    __tablename__ = "sv_appointments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    property_id = Column(UUID(as_uuid=True), ForeignKey("sv_properties.id"), nullable=True)
    technician_id = Column(UUID(as_uuid=True), ForeignKey("sv_technicians.id"), nullable=False, index=True)
    quote_id = Column(UUID(as_uuid=True), ForeignKey("sv_quotes.id"), nullable=True)
    contract_visit_id = Column(UUID(as_uuid=True), index=True)  # si viene de contrato
    tipo = Column(String(30), default="servicio")
    estado = Column(String(20), default="agendada", index=True)
    prioridad = Column(String(20), default="normal")
    titulo = Column(String(300), nullable=False)
    descripcion = Column(Text)
    fecha = Column(Date, nullable=False, index=True)
    hora_desde = Column(Time, nullable=False)
    hora_hasta = Column(Time, nullable=False)
    duracion_estimada_minutos = Column(Integer, default=60)
    ventana_tiempo = Column(String(50))  # "8-10am", "tarde", "todo_dia"
    direccion = Column(String(500))
    lat = Column(Numeric(10, 7))
    lng = Column(Numeric(10, 7))
    recordatorio_enviado = Column(Boolean, default=False)
    recordatorio_horas_antes = Column(Integer, default=24)
    notas_previas = Column(Text)
    requiere_confirmacion = Column(Boolean, default=True)
    confirmada = Column(Boolean, default=False)
    fecha_confirmacion = Column(DateTime(timezone=True))
    color = Column(String(20))
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


# ============================================================
# 16. ORDENES DE TRABAJO
# ============================================================
class WorkOrder(Base):
    __tablename__ = "sv_work_orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    numero = Column(String(50), unique=True, nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    property_id = Column(UUID(as_uuid=True), ForeignKey("sv_properties.id"), nullable=True)
    equipment_id = Column(UUID(as_uuid=True), ForeignKey("sv_equipment.id"), nullable=True)
    technician_id = Column(UUID(as_uuid=True), ForeignKey("sv_technicians.id"), nullable=False, index=True)
    quote_id = Column(UUID(as_uuid=True), ForeignKey("sv_quotes.id"), nullable=True)
    appointment_id = Column(UUID(as_uuid=True), ForeignKey("sv_appointments.id"), nullable=True)
    contract_visit_id = Column(UUID(as_uuid=True), index=True)
    vertical_codigo = Column(String(50), index=True)
    tipo = Column(String(30), default="servicio")
    estado = Column(String(30), default="agendada", index=True)
    prioridad = Column(String(20), default="normal", index=True)
    titulo = Column(String(300), nullable=False)
    descripcion_cliente = Column(Text)
    descripcion_tecnica = Column(Text)
    problema_reportado = Column(Text)
    diagnostico = Column(Text)
    solucion_aplicada = Column(Text)
    recomendaciones = Column(Text)
    fecha_programada = Column(Date, nullable=False, index=True)
    hora_programada = Column(Time)
    fecha_checkin = Column(DateTime(timezone=True))
    lat_checkin = Column(Numeric(10, 7))
    lng_checkin = Column(Numeric(10, 7))
    fecha_inicio = Column(DateTime(timezone=True))
    fecha_fin = Column(DateTime(timezone=True))
    duracion_real_minutos = Column(Integer)
    duracion_estimada_horas = Column(Numeric(8, 2))
    tiempo_viaje_minutos = Column(Integer)
    km_recorridos = Column(Numeric(8, 2))
    subtmano_obra = Column( Numeric(15, 0), default=0)
    subtotal_materiales = Column(Numeric(15, 0), default=0)
    descuento = Column(Numeric(15, 0), default=0)
    iva = Column(Numeric(15, 0), default=0)
    total = Column(Numeric(15, 0), default=0)
    requiere_factura = Column(Boolean, default=True)
    invoice_id = Column(UUID(as_uuid=True), index=True)
    requiere_garantia = Column(Boolean, default=False)
    dias_garantia = Column(Integer, default=30)
    fecha_garantia_fin = Column(Date)
    requiere_permiso = Column(Boolean, default=False)
    tipo_permiso = Column(String(100))
    firma_cliente_url = Column(Text)
    nombre_firmante = Column(String(200))
    ci_firmante = Column(String(20))
    satisfaccion_nps = Column(Integer)  # 0-10
    satisfaccion_comentario = Column(Text)
    requiere_seguimiento = Column(Boolean, default=False)
    fecha_seguimiento = Column(Date)
    notas_internas = Column(Text)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
    items_relation = relationship("WorkOrderItem", back_populates="work_order", cascade="all, delete-orphan", lazy="selectin")


# ============================================================
# 17. ITEMS DE ORDEN DE TRABAJO
# ============================================================
class WorkOrderItem(Base):
    __tablename__ = "sv_work_order_items"
    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    work_order_id = Column(UUID(as_uuid=True), ForeignKey("sv_work_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    tipo = Column(String(20), nullable=False)  # mano_obra, material, equipo, subcontrato
    codigo = Column(String(50))
    descripcion = Column(String(500), nullable=False)
    detalle = Column(Text)
    cantidad = Column(Numeric(10, 2), default=1)
    unidad = Column(String(20), default="UN")
    precio_unitario = Column(Numeric(15, 0), default=0)
    descuento_pct = Column(Numeric(5, 2), default=0)
    subtotal = Column(Numeric(15, 0), default=0)
    iva_incluido = Column(Boolean, default=True)
    product_id = Column(UUID(as_uuid=True), index=True)  # opcional, link a products
    truck_stock = Column(Boolean, default=False)  # si salió del inventario móvil
    orden = Column(Integer, default=0)
    tecnico_id = Column(UUID(as_uuid=True), index=True)  # para mano de obra por tecnico
    horas = Column(Numeric(8, 2))
    tarifa_hora = Column(Numeric(15, 0))
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    work_order = relationship("WorkOrder", back_populates="items_relation")


# ============================================================
# 18. FOTOS DE WORK ORDER
# ============================================================
class WorkOrderPhoto(Base):
    __tablename__ = "sv_work_order_photos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    work_order_id = Column(UUID(as_uuid=True), ForeignKey("sv_work_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    tipo = Column(String(20), default="general")  # antes, durante, despues, problema, firma
    url = Column(Text, nullable=False)
    thumbnail_url = Column(Text)
    descripcion = Column(String(300))
    lat = Column(Numeric(10, 7))
    lng = Column(Numeric(10, 7))
    taken_at = Column(DateTime(timezone=True), default=_utcnow)
    taken_by = Column(UUID(as_uuid=True), index=True)
    orden = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=_utcnow)


# ============================================================
# 19. REGISTRO DE TIEMPO
# ============================================================
class TimeEntry(Base):
    __tablename__ = "sv_time_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    work_order_id = Column(UUID(as_uuid=True), ForeignKey("sv_work_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    technician_id = Column(UUID(as_uuid=True), ForeignKey("sv_technicians.id"), nullable=False, index=True)
    tipo = Column(String(20), default="trabajo")  # trabajo, viaje, espera, almuerzo
    inicio = Column(DateTime(timezone=True), nullable=False)
    fin = Column(DateTime(timezone=True))
    duracion_minutos = Column(Integer)
    descripcion = Column(String(500))
    facturable = Column(Boolean, default=True)
    tarifa_hora = Column(Numeric(15, 0))
    monto = Column(Numeric(15, 0))
    created_at = Column(DateTime(timezone=True), default=_utcnow)


# ============================================================
# 20. CONTRATOS DE SERVICIO RECURRENTE
# ============================================================
class ServiceContract(Base):
    __tablename__ = "sv_service_contracts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    numero = Column(String(50), unique=True, nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    vertical_codigo = Column(String(50), index=True)
    titulo = Column(String(300), nullable=False)
    descripcion = Column(Text)
    estado = Column(String(20), default="activo", index=True)
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, index=True)
    duracion_meses = Column(Integer, default=12)
    renovacion_auto = Column(Boolean, default=False)
    dias_aviso_renovacion = Column(Integer, default=30)
    frecuencia_visitas = Column(String(20), default="mensual")  # mensual, bimestral, trimestral, semestral, anual
    visitas_incluidas_anio = Column(Integer, default=12)
    visitas_realizadas = Column(Integer, default=0)
    visitas_restantes = Column(Integer)
    incluye_emergencias = Column(Boolean, default=False)
    tiempo_respuesta_horas = Column(Integer, default=24)
    tiempo_resolucion_horas = Column(Integer, default=72)
    monto_mensual_pyg = Column(Numeric(15, 0), default=0)
    monto_total_pyg = Column(Numeric(15, 0), default=0)
    descuento_pct = Column(Numeric(5, 2), default=0)
    incluye_materiales = Column(Boolean, default=False)
    incluye_repuestos = Column(Boolean, default=False)
    equipos_cubiertos = Column(JSONB)  # lista de equipment_id
    properties_cubiertas = Column(JSONB)
    sla_texto = Column(Text)
    terminos_condiciones = Column(Text)
    fecha_ultimo_cobro = Column(Date)
    fecha_proximo_cobro = Column(Date, index=True)
    requiere_garantia = Column(Boolean, default=False)
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


# ============================================================
# 21. VISITAS DE CONTRATO
# ============================================================
class ContractVisit(Base):
    __tablename__ = "sv_contract_visits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    contract_id = Column(UUID(as_uuid=True), ForeignKey("sv_service_contracts.id", ondelete="CASCADE"), nullable=False, index=True)
    numero_visita = Column(Integer, nullable=False)
    fecha_programada = Column(Date, nullable=False, index=True)
    fecha_realizada = Column(Date)
    work_order_id = Column(UUID(as_uuid=True), ForeignKey("sv_work_orders.id"), nullable=True)
    technician_id = Column(UUID(as_uuid=True), ForeignKey("sv_technicians.id"), nullable=True)
    estado = Column(String(20), default="programada", index=True)  # programada, completada, saltada, reagendada
    tipo = Column(String(30), default="mantenimiento")
    checklist = Column(JSONB)  # lista de checks [{item, completado, nota}]
    completado_pct = Column(Numeric(5, 2), default=0)
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


# ============================================================
# 22. INVENTARIO MOVIL (TRUCK STOCK)
# ============================================================
class TruckInventory(Base):
    __tablename__ = "sv_truck_inventory"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    technician_id = Column(UUID(as_uuid=True), ForeignKey("sv_technicians.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    codigo = Column(String(50))
    descripcion = Column(String(200))
    cantidad_actual = Column(Numeric(10, 2), default=0)
    cantidad_minima = Column(Numeric(10, 2), default=0)
    cantidad_maxima = Column(Numeric(10, 2))
    ubicacion_vehiculo = Column(String(50))  # "estante A", "caja 3"
    ultima_carga = Column(Date)
    ultimo_conteo = Column(Date)
    necesita_reposicion = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
    __table_args__ = (UniqueConstraint("technician_id", "product_id", name="uq_sv_truck_tech_prod"),)


# ============================================================
# 23. MOVIMIENTOS DE INVENTARIO
# ============================================================
class ServiceInventoryMovement(Base):
    __tablename__ = "sv_inventory_movements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    technician_id = Column(UUID(as_uuid=True), ForeignKey("sv_technicians.id"), nullable=True, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    work_order_id = Column(UUID(as_uuid=True), ForeignKey("sv_work_orders.id"), nullable=True, index=True)
    tipo = Column(String(20), nullable=False)  # carga_inicial, carga_reposicion, consumo_wo, devolucion, merma, transferencia
    cantidad = Column(Numeric(10, 2), nullable=False)  # positivo=entrada, negativo=salida
    stock_anterior = Column(Numeric(10, 2))
    stock_actual = Column(Numeric(10, 2))
    notas = Column(String(300))
    created_by = Column(UUID(as_uuid=True), index=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)


# ============================================================
# 24. FACTURAS DE SERVICIOS
# ============================================================
class ServiceInvoice(Base):
    __tablename__ = "sv_invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    numero = Column(String(50), unique=True, nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    work_order_id = Column(UUID(as_uuid=True), ForeignKey("sv_work_orders.id"), nullable=True, index=True)
    contract_id = Column(UUID(as_uuid=True), ForeignKey("sv_service_contracts.id"), nullable=True, index=True)
    estado = Column(String(20), default="borrador", index=True)
    fecha_emision = Column(Date, default=func.current_date(), index=True)
    fecha_vencimiento = Column(Date, index=True)
    plazo_pago_dias = Column(Integer, default=30)
    subtotal = Column(Numeric(15, 0), default=0)
    descuento = Column(Numeric(15, 0), default=0)
    iva = Column(Numeric(15, 0), default=0)
    total = Column(Numeric(15, 0), default=0)
    monto_pagado = Column(Numeric(15, 0), default=0)
    saldo = Column(Numeric(15, 0), default=0)
    dias_mora = Column(Integer, default=0)
    metodo_pago = Column(String(50))
    requiere_sifen = Column(Boolean, default=True)
    sifen_cdc = Column(String(50), index=True)
    sifen_xml_url = Column(Text)
    pdf_url = Column(Text)
    fecha_pago_total = Column(Date)
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


# ============================================================
# 25. PAGOS DE FACTURAS
# ============================================================
class InvoicePayment(Base):
    __tablename__ = "sv_invoice_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("sv_invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    fecha = Column(Date, default=func.current_date(), index=True)
    monto = Column(Numeric(15, 0), nullable=False)
    metodo_pago = Column(String(50), nullable=False)
    referencia = Column(String(100))
    banco = Column(String(50))
    notas = Column(String(300))
    created_by = Column(UUID(as_uuid=True), index=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)


# ============================================================
# 26. SOLICITUDES DE COTIZACION (PUBLICAS/ENTRY POINT)
# ============================================================
class ServiceQuoteRequest(Base):
    __tablename__ = "sv_quote_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    nombre = Column(String(200), nullable=False)
    telefono = Column(String(30), nullable=False)
    email = Column(String(200))
    direccion = Column(String(500))
    ciudad = Column(String(100))
    tipo_servicio = Column(String(50), index=True)
    descripcion = Column(Text, nullable=False)
    fotos_urls = Column(ARRAY(Text))
    urgencia = Column(String(20), default="normal")
    estado = Column(String(20), default="nueva", index=True)  # nueva, contactada, cotizada, ganada, perdida
    fuente = Column(String(50), default="web")  # web, whatsapp, telefono, referido
    quote_id = Column(UUID(as_uuid=True), ForeignKey("sv_quotes.id"), nullable=True)
    customer_id = Column(UUID(as_uuid=True), index=True)
    notas_seguimiento = Column(Text)
    fecha_contacto = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


# ============================================================
# 27. CALIFICACIONES DE TECNICO
# ============================================================
class TechnicianReview(Base):
    __tablename__ = "sv_technician_reviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    technician_id = Column(UUID(as_uuid=True), ForeignKey("sv_technicians.id", ondelete="CASCADE"), nullable=False, index=True)
    work_order_id = Column(UUID(as_uuid=True), ForeignKey("sv_work_orders.id"), nullable=True, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    rating = Column(Integer, nullable=False)  # 1-5 estrellas
    puntualidad = Column(Integer)
    profesionalismo = Column(Integer)
    calidad = Column(Integer)
    limpieza = Column(Integer)
    recomendaria = Column(Boolean, default=True)
    comentario = Column(Text)
    fotos_urls = Column(ARRAY(Text))
    verificado = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow)


# ============================================================
# 28. METRICAS CALCULADAS (cache para dashboard)
# ============================================================
class TechnicianMetrics(Base):
    __tablename__ = "sv_technician_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    technician_id = Column(UUID(as_uuid=True), ForeignKey("sv_technicians.id", ondelete="CASCADE"), nullable=False, index=True)
    periodo = Column(String(10), nullable=False)  # 2026-06 (YYYY-MM)
    wo_completadas = Column(Integer, default=0)
    wo_canceladas = Column(Integer, default=0)
    ingresos_generados = Column(Numeric(15, 0), default=0)
    comision_ganada = Column(Numeric(15, 0), default=0)
    horas_trabajadas = Column(Numeric(10, 2), default=0)
    tiempo_promedio_servicio_minutos = Column(Integer)
    rating_promedio_periodo = Column(Numeric(3, 2))
    nps_promedio = Column(Integer)
    primera_visita_pct = Column(Numeric(5, 2))
    satisfaccion_promedio = Column(Numeric(3, 2))
    clientes_unicos = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    __table_args__ = (UniqueConstraint("technician_id", "periodo", name="uq_sv_metrics_tech_period"),)
