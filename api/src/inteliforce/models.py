"""Inteliforce (app de campo unificada con SueldOK) — modelos"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, UniqueConstraint, Numeric, Integer, Date, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from api.src.db import Base


class InteliforceServiceKey(Base):
    """Credencial de servidor-a-servidor que SueldOK usa para canjear la cedula
    de un empleado por un JWT corto de Intelimarket. Analogo a company.systemApiKey
    del lado de SueldOK, pero es la propia de Intelimarket — no se comparte la
    misma clave, cada sistema valida la del otro con la suya."""

    __tablename__ = "inteliforce_service_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    api_key = Column(String(100), nullable=False, unique=True, index=True)
    nombre = Column(String(100))
    activo = Column(Boolean, default=True)
    observaciones = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class InteliforceSyncRecord(Base):
    """Espejo generico en Postgres de eventos de campo que hoy viven en
    Convex (tracking GPS, visitas, asistencia) — historial completo para
    siempre, aunque Convex purgue lo viejo semanalmente. Sin esquema rigido
    por tipo todavia: se especializa cuando el patron de uso real lo pida."""

    __tablename__ = "inteliforce_sync_records"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    record_type = Column(String(30), nullable=False, index=True)  # tracking_log | visit | attendance
    convex_id = Column(String(50), nullable=False)
    employee_convex_id = Column(String(50), index=True)
    recorded_at = Column(DateTime(timezone=True))
    payload = Column(JSONB, nullable=False)
    synced_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("record_type", "convex_id", name="uq_inteliforce_sync_record"),
    )


class InteliforceDevice(Base):
    """Token FCM de un dispositivo móvil de Inteliforce. Un rep puede tener
    varios dispositivos registrados (celular viejo + nuevo durante transición).
    Se actualiza cada login — nunca se borra, solo se desactiva."""

    __tablename__ = "inteliforce_devices"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    sales_rep_id = Column(UUID(as_uuid=True), ForeignKey("sales_reps.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    fcm_token = Column(Text, nullable=False)
    platform = Column(String(10), nullable=False, default="android")  # android | ios
    app_version = Column(String(20))
    activo = Column(Boolean, default=True)
    last_seen = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("sales_rep_id", "fcm_token", name="uq_inteliforce_device_rep_token"),
    )


class InteliforceVisit(Base):
    """Registro de visita de un rep (vendedor o merchandiser) a un cliente/POI.
    Check-in valida GPS contra el rango del POI usando accuracy del dispositivo.
    Check-out cierra la visita. Puede quedar abierta si el rep pierde señal —
    el worker offline la cierra cuando sincroniza."""

    __tablename__ = "inteliforce_visits"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    sales_rep_id = Column(UUID(as_uuid=True), ForeignKey("sales_reps.id"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    rol = Column(String(20), nullable=False)  # vendedor | merchandiser | repartidor | promotor
    estado = Column(String(20), nullable=False, default="abierta")  # abierta | cerrada | sin_pedido
    checkin_lat = Column(Numeric(10, 7))
    checkin_lng = Column(Numeric(10, 7))
    checkin_accuracy = Column(Numeric(8, 2))
    checkin_at = Column(DateTime(timezone=True), server_default=func.now())
    checkout_at = Column(DateTime(timezone=True))
    checkout_lat = Column(Numeric(10, 7))
    checkout_lng = Column(Numeric(10, 7))
    sale_id = Column(UUID(as_uuid=True))  # pedido asociado si es vendedor
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class InteliforceIncident(Base):
    """Incidencia reportada por un rep durante una visita: quiebre de stock,
    producto dañado, falta de espacio, competencia, etc. Notifica al supervisor."""

    __tablename__ = "inteliforce_incidents"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    visit_id = Column(UUID(as_uuid=True), ForeignKey("inteliforce_visits.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    sales_rep_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    tipo = Column(String(30), nullable=False)  # quiebre | producto_danado | falta_espacio | competencia | otro
    producto_id = Column(UUID(as_uuid=True))
    descripcion = Column(Text, nullable=False)
    urgencia = Column(String(10), nullable=False, default="normal")  # baja | normal | alta
    notificado = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class InteliforceMedia(Base):
    """Foto o video adjunto a una visita. Se sube en background cuando hay señal.
    La URL es relativa al storage configurado en el servidor (disco local o S3)."""

    __tablename__ = "inteliforce_media"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    visit_id = Column(UUID(as_uuid=True), ForeignKey("inteliforce_visits.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    sales_rep_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    tipo = Column(String(10), nullable=False, default="foto")  # foto | video
    url = Column(Text, nullable=False)
    filename = Column(String(255))
    size_bytes = Column(Integer)
    duracion_seg = Column(Integer)  # solo video
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class InteliforceLotExpiry(Base):
    """Lote y vencimiento de un producto en el punto de venta, cargado por el
    merchandiser durante su visita. Es la fuente de verdad para alertas de
    vencimiento — el supervisor recibe notificación cuando queda <= dias_alerta días."""

    __tablename__ = "inteliforce_lot_expiry"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    visit_id = Column(UUID(as_uuid=True), ForeignKey("inteliforce_visits.id"))
    sales_rep_id = Column(UUID(as_uuid=True), nullable=False)
    lote = Column(String(50))
    fecha_vencimiento = Column(Date, nullable=False, index=True)
    cantidad_unidades = Column(Integer)
    alerta_enviada = Column(Boolean, default=False)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("customer_id", "product_id", "lote", name="uq_lot_expiry_customer_product_lote"),
    )
