"""Migracion: Modulo Servicios Profesionales (sv_*) - 28 tablas alineadas con models.py"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY

revision = "20260604000000"
down_revision = "20260603000000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. sv_service_verticals
    op.create_table(
        "sv_service_verticals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("codigo", sa.String(50), unique=True, nullable=False, index=True),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("descripcion", sa.Text),
        sa.Column("icono", sa.String(50)),
        sa.Column("color", sa.String(20)),
        sa.Column("pais", sa.String(2), server_default="PY"),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # 2. sv_skills
    op.create_table(
        "sv_skills",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("codigo", sa.String(50), unique=True, nullable=False, index=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("categoria", sa.String(50), index=True),
        sa.Column("descripcion", sa.Text),
        sa.Column("nivel_maximo", sa.Integer, server_default="5"),
        sa.Column("certificacion_requerida", sa.Boolean, server_default="false"),
        sa.Column("skill_padre_id", UUID(as_uuid=True), sa.ForeignKey("sv_skills.id"), nullable=True),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # 3. sv_technicians
    op.create_table(
        "sv_technicians",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("user_id", UUID(as_uuid=True), index=True),
        sa.Column("vertical_codigo", sa.String(50), index=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("ci", sa.String(20), index=True),
        sa.Column("telefono", sa.String(30)),
        sa.Column("email", sa.String(200)),
        sa.Column("foto_url", sa.Text),
        sa.Column("tipo", sa.String(20), server_default="interno"),
        sa.Column("modalidad", sa.String(30), server_default="tiempo_completo"),
        sa.Column("fecha_ingreso", sa.Date),
        sa.Column("tarifa_hora_pyg", sa.Numeric(15, 0), server_default="0"),
        sa.Column("tarifa_visita_pyg", sa.Numeric(15, 0), server_default="0"),
        sa.Column("comision_pct", sa.Numeric(5, 2), server_default="0"),
        sa.Column("zonas_cobertura", ARRAY(sa.String)),
        sa.Column("lat_base", sa.Numeric(10, 7)),
        sa.Column("lng_base", sa.Numeric(10, 7)),
        sa.Column("rating_promedio", sa.Numeric(3, 2), server_default="5.0"),
        sa.Column("total_servicios", sa.Integer, server_default="0"),
        sa.Column("total_clientes", sa.Integer, server_default="0"),
        sa.Column("primera_visita_pct", sa.Numeric(5, 2), server_default="0"),
        sa.Column("es_lider_equipo", sa.Boolean, server_default="false"),
        sa.Column("biografia", sa.Text),
        sa.Column("color_calendario", sa.String(20), server_default="#3b82f6"),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("disponible", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # 4. sv_technician_skills
    op.create_table(
        "sv_technician_skills",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("technician_id", UUID(as_uuid=True), sa.ForeignKey("sv_technicians.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("skill_id", UUID(as_uuid=True), sa.ForeignKey("sv_skills.id"), nullable=False, index=True),
        sa.Column("nivel", sa.Integer, server_default="1"),
        sa.Column("certificado", sa.Boolean, server_default="false"),
        sa.Column("fecha_adquisicion", sa.Date),
        sa.Column("notas", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("technician_id", "skill_id", name="uq_sv_tech_skill"),
    )

    # 5. sv_technician_certifications
    op.create_table(
        "sv_technician_certifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("technician_id", UUID(as_uuid=True), sa.ForeignKey("sv_technicians.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("tipo", sa.String(50), nullable=False),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("institucion", sa.String(200)),
        sa.Column("numero", sa.String(100)),
        sa.Column("fecha_emision", sa.Date),
        sa.Column("fecha_vencimiento", sa.Date, index=True),
        sa.Column("dias_para_vencer", sa.Integer),
        sa.Column("alerta_enviada", sa.Boolean, server_default="false"),
        sa.Column("alerta_dias", sa.Integer, server_default="30"),
        sa.Column("archivo_url", sa.Text),
        sa.Column("notas", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # 6. sv_technician_availability
    op.create_table(
        "sv_technician_availability",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("technician_id", UUID(as_uuid=True), sa.ForeignKey("sv_technicians.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("dia_semana", sa.Integer, nullable=False),
        sa.Column("hora_desde", sa.Time, nullable=False),
        sa.Column("hora_hasta", sa.Time, nullable=False),
        sa.Column("disponible", sa.Boolean, server_default="true"),
        sa.Column("es_receso", sa.Boolean, server_default="false"),
        sa.Column("notas", sa.String(200)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("technician_id", "dia_semana", "hora_desde", name="uq_sv_avail_slot"),
    )

    # 7. sv_teams
    op.create_table(
        "sv_teams",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("descripcion", sa.Text),
        sa.Column("lider_technician_id", UUID(as_uuid=True), sa.ForeignKey("sv_technicians.id"), nullable=True),
        sa.Column("color", sa.String(20), server_default="#10b981"),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # 8. sv_team_members
    op.create_table(
        "sv_team_members",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("team_id", UUID(as_uuid=True), sa.ForeignKey("sv_teams.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("technician_id", UUID(as_uuid=True), sa.ForeignKey("sv_technicians.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("rol", sa.String(50), server_default="miembro"),
        sa.Column("fecha_alta", sa.Date),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("team_id", "technician_id", name="uq_sv_team_member"),
    )

    # 9. sv_service_zones
    op.create_table(
        "sv_service_zones",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("ciudad", sa.String(100), index=True),
        sa.Column("departamento", sa.String(100), index=True),
        sa.Column("codigo_postal", sa.String(20)),
        sa.Column("poligono", JSONB),
        sa.Column("radio_km", sa.Numeric(8, 2), server_default="10"),
        sa.Column("recargo_km_pyg", sa.Numeric(10, 0), server_default="0"),
        sa.Column("tiempo_promedio_minutos", sa.Integer, server_default="30"),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # 10. sv_properties
    op.create_table(
        "sv_properties",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("tipo", sa.String(50), server_default="residencial"),
        sa.Column("direccion", sa.String(500), nullable=False),
        sa.Column("ciudad", sa.String(100)),
        sa.Column("departamento", sa.String(100)),
        sa.Column("codigo_postal", sa.String(20)),
        sa.Column("lat", sa.Numeric(10, 7)),
        sa.Column("lng", sa.Numeric(10, 7)),
        sa.Column("zona_id", UUID(as_uuid=True), sa.ForeignKey("sv_service_zones.id"), nullable=True),
        sa.Column("metros_cuadrados", sa.Numeric(10, 2)),
        sa.Column("pisos", sa.Integer, server_default="1"),
        sa.Column("habitaciones", sa.Integer),
        sa.Column("banos", sa.Numeric(3, 1)),
        sa.Column("acceso_notas", sa.Text),
        sa.Column("contacto_nombre", sa.String(200)),
        sa.Column("contacto_telefono", sa.String(50)),
        sa.Column("notas", sa.Text),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # 11. sv_equipment
    op.create_table(
        "sv_equipment",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("property_id", UUID(as_uuid=True), sa.ForeignKey("sv_properties.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("tipo", sa.String(50), nullable=False, index=True),
        sa.Column("marca", sa.String(100)),
        sa.Column("modelo", sa.String(100)),
        sa.Column("numero_serie", sa.String(100), index=True),
        sa.Column("capacidad", sa.String(100)),
        sa.Column("fecha_instalacion", sa.Date),
        sa.Column("fecha_garantia_fin", sa.Date),
        sa.Column("ubicacion", sa.String(200)),
        sa.Column("requiere_mantenimiento", sa.Boolean, server_default="true"),
        sa.Column("frecuencia_mantenimiento_dias", sa.Integer, server_default="180"),
        sa.Column("ultimo_mantenimiento", sa.Date),
        sa.Column("proximo_mantenimiento", sa.Date, index=True),
        sa.Column("estado", sa.String(20), server_default="operativo"),
        sa.Column("notas", sa.Text),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # 12. sv_quotes
    op.create_table(
        "sv_quotes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("numero", sa.String(50), unique=True, nullable=False),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("property_id", UUID(as_uuid=True), sa.ForeignKey("sv_properties.id"), nullable=True),
        sa.Column("equipment_id", UUID(as_uuid=True), sa.ForeignKey("sv_equipment.id"), nullable=True),
        sa.Column("technician_id", UUID(as_uuid=True), sa.ForeignKey("sv_technicians.id"), nullable=True),
        sa.Column("vertical_codigo", sa.String(50), index=True),
        sa.Column("titulo", sa.String(300), nullable=False),
        sa.Column("descripcion", sa.Text),
        sa.Column("estado", sa.String(20), server_default="borrador", index=True),
        sa.Column("fecha_cotizacion", sa.Date, server_default=sa.func.current_date()),
        sa.Column("fecha_validez", sa.Date),
        sa.Column("fecha_aprobacion", sa.Date),
        sa.Column("duracion_estimada_horas", sa.Numeric(8, 2)),
        sa.Column("fecha_inicio_estimada", sa.Date),
        sa.Column("subtmano_obra", sa.Numeric(15, 0), server_default="0"),
        sa.Column("subtotal_materiales", sa.Numeric(15, 0), server_default="0"),
        sa.Column("subtotal_equipos", sa.Numeric(15, 0), server_default="0"),
        sa.Column("subtotal_subcontratos", sa.Numeric(15, 0), server_default="0"),
        sa.Column("descuento_pct", sa.Numeric(5, 2), server_default="0"),
        sa.Column("descuento_monto", sa.Numeric(15, 0), server_default="0"),
        sa.Column("iva_pct", sa.Numeric(5, 2), server_default="10"),
        sa.Column("iva_monto", sa.Numeric(15, 0), server_default="0"),
        sa.Column("total", sa.Numeric(15, 0), server_default="0"),
        sa.Column("condiciones", sa.Text),
        sa.Column("tiempo_validez_dias", sa.Integer, server_default="15"),
        sa.Column("aprobado_por", sa.String(200)),
        sa.Column("metodo_pago_propuesto", sa.String(50)),
        sa.Column("notas_internas", sa.Text),
        sa.Column("pdf_url", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # 13. sv_quote_items
    op.create_table(
        "sv_quote_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("quote_id", UUID(as_uuid=True), sa.ForeignKey("sv_quotes.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("descripcion", sa.String(500), nullable=False),
        sa.Column("cantidad", sa.Numeric(10, 2), server_default="1"),
        sa.Column("unidad", sa.String(20), server_default="unidad"),
        sa.Column("precio_unitario", sa.Numeric(15, 0), server_default="0"),
        sa.Column("descuento_pct", sa.Numeric(5, 2), server_default="0"),
        sa.Column("subtotal", sa.Numeric(15, 0), server_default="0"),
        sa.Column("producto_id", UUID(as_uuid=True)),
        sa.Column("notas", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # 14. sv_quote_photos
    op.create_table(
        "sv_quote_photos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("quote_id", UUID(as_uuid=True), sa.ForeignKey("sv_quotes.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("url", sa.Text, nullable=False),
        sa.Column("descripcion", sa.String(200)),
        sa.Column("orden", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # 15. sv_appointments
    op.create_table(
        "sv_appointments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("property_id", UUID(as_uuid=True), sa.ForeignKey("sv_properties.id"), nullable=True),
        sa.Column("technician_id", UUID(as_uuid=True), sa.ForeignKey("sv_technicians.id"), nullable=True, index=True),
        sa.Column("quote_id", UUID(as_uuid=True), sa.ForeignKey("sv_quotes.id"), nullable=True),
        sa.Column("vertical_codigo", sa.String(50), index=True),
        sa.Column("titulo", sa.String(300), nullable=False),
        sa.Column("descripcion", sa.Text),
        sa.Column("tipo", sa.String(30), server_default="consulta"),
        sa.Column("estado", sa.String(20), server_default="agendada", index=True),
        sa.Column("fecha", sa.Date, nullable=False, index=True),
        sa.Column("hora_desde", sa.Time, nullable=False),
        sa.Column("hora_hasta", sa.Time),
        sa.Column("duracion_estimada_min", sa.Integer, server_default="60"),
        sa.Column("recordatorio_enviado", sa.Boolean, server_default="false"),
        sa.Column("confirmado_por_cliente", sa.Boolean, server_default="false"),
        sa.Column("motivo_cancelacion", sa.Text),
        sa.Column("notas_tecnico", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # 16. sv_work_orders
    op.create_table(
        "sv_work_orders",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("numero", sa.String(50), unique=True, nullable=False),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("property_id", UUID(as_uuid=True), sa.ForeignKey("sv_properties.id"), nullable=True),
        sa.Column("equipment_id", UUID(as_uuid=True), sa.ForeignKey("sv_equipment.id"), nullable=True),
        sa.Column("technician_id", UUID(as_uuid=True), sa.ForeignKey("sv_technicians.id"), nullable=True, index=True),
        sa.Column("appointment_id", UUID(as_uuid=True), sa.ForeignKey("sv_appointments.id"), nullable=True),
        sa.Column("quote_id", UUID(as_uuid=True), sa.ForeignKey("sv_quotes.id"), nullable=True),
        sa.Column("vertical_codigo", sa.String(50), index=True),
        sa.Column("titulo", sa.String(300), nullable=False),
        sa.Column("descripcion", sa.Text),
        sa.Column("estado", sa.String(20), server_default="agendada", index=True),
        sa.Column("prioridad", sa.String(20), server_default="normal"),
        sa.Column("fecha_creacion", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("fecha_programada", sa.Date, index=True),
        sa.Column("hora_desde", sa.Time),
        sa.Column("duracion_estimada_horas", sa.Numeric(6, 2)),
        sa.Column("fecha_inicio_real", sa.DateTime(timezone=True)),
        sa.Column("fecha_fin_real", sa.DateTime(timezone=True)),
        sa.Column("duracion_real_min", sa.Integer),
        sa.Column("lat_llegada", sa.Numeric(10, 7)),
        sa.Column("lng_llegada", sa.Numeric(10, 7)),
        sa.Column("subtmano_obra", sa.Numeric(15, 0), server_default="0"),
        sa.Column("subtotal_materiales", sa.Numeric(15, 0), server_default="0"),
        sa.Column("subtotal_equipos", sa.Numeric(15, 0), server_default="0"),
        sa.Column("descuento_monto", sa.Numeric(15, 0), server_default="0"),
        sa.Column("iva_monto", sa.Numeric(15, 0), server_default="0"),
        sa.Column("total", sa.Numeric(15, 0), server_default="0"),
        sa.Column("requiere_factura", sa.Boolean, server_default="true"),
        sa.Column("invoice_id", UUID(as_uuid=True)),
        sa.Column("firma_cliente_url", sa.Text),
        sa.Column("observaciones_tecnico", sa.Text),
        sa.Column("notas_internas", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # 17. sv_work_order_items
    op.create_table(
        "sv_work_order_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("work_order_id", UUID(as_uuid=True), sa.ForeignKey("sv_work_orders.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("producto_id", UUID(as_uuid=True)),
        sa.Column("descripcion", sa.String(500), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("cantidad", sa.Numeric(10, 2), server_default="1"),
        sa.Column("unidad", sa.String(20), server_default="unidad"),
        sa.Column("precio_unitario", sa.Numeric(15, 0), server_default="0"),
        sa.Column("subtotal", sa.Numeric(15, 0), server_default="0"),
        sa.Column("es_extra", sa.Boolean, server_default="false"),
        sa.Column("notas", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # 18. sv_work_order_photos
    op.create_table(
        "sv_work_order_photos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("work_order_id", UUID(as_uuid=True), sa.ForeignKey("sv_work_orders.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("url", sa.Text, nullable=False),
        sa.Column("tipo", sa.String(20), server_default="general"),
        sa.Column("descripcion", sa.String(200)),
        sa.Column("lat", sa.Numeric(10, 7)),
        sa.Column("lng", sa.Numeric(10, 7)),
        sa.Column("orden", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # 19. sv_time_entries
    op.create_table(
        "sv_time_entries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("work_order_id", UUID(as_uuid=True), sa.ForeignKey("sv_work_orders.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("technician_id", UUID(as_uuid=True), sa.ForeignKey("sv_technicians.id"), nullable=False, index=True),
        sa.Column("tipo", sa.String(30), server_default="trabajo"),
        sa.Column("inicio", sa.DateTime(timezone=True), nullable=False),
        sa.Column("fin", sa.DateTime(timezone=True)),
        sa.Column("duracion_min", sa.Integer),
        sa.Column("descripcion", sa.Text),
        sa.Column("facturable", sa.Boolean, server_default="true"),
        sa.Column("tarifa_aplicada", sa.Numeric(15, 0), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # 20. sv_service_contracts
    op.create_table(
        "sv_service_contracts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("numero", sa.String(50), unique=True, nullable=False),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("property_id", UUID(as_uuid=True), sa.ForeignKey("sv_properties.id"), nullable=True),
        sa.Column("vertical_codigo", sa.String(50), index=True),
        sa.Column("titulo", sa.String(300), nullable=False),
        sa.Column("descripcion", sa.Text),
        sa.Column("estado", sa.String(20), server_default="activo", index=True),
        sa.Column("fecha_inicio", sa.Date, nullable=False),
        sa.Column("fecha_fin", sa.Date),
        sa.Column("frecuencia", sa.String(20), server_default="mensual"),
        sa.Column("visitas_totales", sa.Integer, server_default="12"),
        sa.Column("visitas_realizadas", sa.Integer, server_default="0"),
        sa.Column("monto_mensual", sa.Numeric(15, 0), server_default="0"),
        sa.Column("monto_total", sa.Numeric(15, 0), server_default="0"),
        sa.Column("dia_facturacion", sa.Integer, server_default="1"),
        sa.Column("renovacion_auto", sa.Boolean, server_default="false"),
        sa.Column("alerta_vencimiento_dias", sa.Integer, server_default="30"),
        sa.Column("condiciones", sa.Text),
        sa.Column("firmado_por", sa.String(200)),
        sa.Column("fecha_firma", sa.Date),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # 21. sv_contract_visits
    op.create_table(
        "sv_contract_visits",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("contract_id", UUID(as_uuid=True), sa.ForeignKey("sv_service_contracts.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("fecha_programada", sa.Date, nullable=False, index=True),
        sa.Column("fecha_realizada", sa.Date),
        sa.Column("technician_id", UUID(as_uuid=True), sa.ForeignKey("sv_technicians.id"), nullable=True),
        sa.Column("work_order_id", UUID(as_uuid=True), sa.ForeignKey("sv_work_orders.id"), nullable=True),
        sa.Column("estado", sa.String(20), server_default="programada", index=True),
        sa.Column("titulo", sa.String(200)),
        sa.Column("checklist", JSONB),
        sa.Column("checklist_completado", JSONB),
        sa.Column("reporte_url", sa.Text),
        sa.Column("firma_cliente_url", sa.Text),
        sa.Column("observaciones", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # 22. sv_truck_inventory
    op.create_table(
        "sv_truck_inventory",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("technician_id", UUID(as_uuid=True), sa.ForeignKey("sv_technicians.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("producto_id", UUID(as_uuid=True)),
        sa.Column("sku", sa.String(50), index=True),
        sa.Column("descripcion", sa.String(200)),
        sa.Column("cantidad_actual", sa.Numeric(10, 2), server_default="0"),
        sa.Column("cantidad_minima", sa.Numeric(10, 2), server_default="0"),
        sa.Column("cantidad_maxima", sa.Numeric(10, 2), server_default="0"),
        sa.Column("costo_unitario", sa.Numeric(15, 0), server_default="0"),
        sa.Column("ubicacion_camion", sa.String(50)),
        sa.Column("necesita_reposicion", sa.Boolean, server_default="false"),
        sa.Column("ultima_reposicion", sa.Date),
        sa.Column("notas", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # 23. sv_inventory_movements
    op.create_table(
        "sv_inventory_movements",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("technician_id", UUID(as_uuid=True), sa.ForeignKey("sv_technicians.id"), nullable=False, index=True),
        sa.Column("truck_inventory_id", UUID(as_uuid=True), sa.ForeignKey("sv_truck_inventory.id", ondelete="CASCADE"), nullable=True, index=True),
        sa.Column("producto_id", UUID(as_uuid=True)),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("cantidad", sa.Numeric(10, 2), nullable=False),
        sa.Column("costo_unitario", sa.Numeric(15, 0), server_default="0"),
        sa.Column("costo_total", sa.Numeric(15, 0), server_default="0"),
        sa.Column("work_order_id", UUID(as_uuid=True), sa.ForeignKey("sv_work_orders.id"), nullable=True),
        sa.Column("motivo", sa.String(200)),
        sa.Column("notas", sa.Text),
        sa.Column("fecha", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # 24. sv_invoices
    op.create_table(
        "sv_invoices",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("work_order_id", UUID(as_uuid=True), sa.ForeignKey("sv_work_orders.id"), nullable=True, index=True),
        sa.Column("contract_id", UUID(as_uuid=True), sa.ForeignKey("sv_service_contracts.id"), nullable=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("numero", sa.String(50), unique=True, nullable=False),
        sa.Column("timbrado", sa.String(20)),
        sa.Column("cdc", sa.String(50), index=True),
        sa.Column("fecha_emision", sa.Date, nullable=False),
        sa.Column("fecha_vencimiento", sa.Date, index=True),
        sa.Column("subtotal", sa.Numeric(15, 0), server_default="0"),
        sa.Column("descuento", sa.Numeric(15, 0), server_default="0"),
        sa.Column("iva", sa.Numeric(15, 0), server_default="0"),
        sa.Column("total", sa.Numeric(15, 0), server_default="0"),
        sa.Column("monto_pagado", sa.Numeric(15, 0), server_default="0"),
        sa.Column("saldo", sa.Numeric(15, 0), server_default="0"),
        sa.Column("estado", sa.String(20), server_default="emitida", index=True),
        sa.Column("metodo_pago", sa.String(30)),
        sa.Column("sifen_enviada", sa.Boolean, server_default="false"),
        sa.Column("sifen_error", sa.Text),
        sa.Column("pdf_url", sa.Text),
        sa.Column("notas", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # 25. sv_invoice_payments
    op.create_table(
        "sv_invoice_payments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("invoice_id", UUID(as_uuid=True), sa.ForeignKey("sv_invoices.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("fecha", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("monto", sa.Numeric(15, 0), nullable=False),
        sa.Column("metodo_pago", sa.String(30), server_default="transferencia"),
        sa.Column("referencia", sa.String(100)),
        sa.Column("banco", sa.String(50)),
        sa.Column("comprobante_url", sa.Text),
        sa.Column("notas", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # 26. sv_quote_requests
    op.create_table(
        "sv_quote_requests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("property_id", UUID(as_uuid=True), sa.ForeignKey("sv_properties.id"), nullable=True),
        sa.Column("vertical_codigo", sa.String(50), index=True),
        sa.Column("nombre_contacto", sa.String(200), nullable=False),
        sa.Column("telefono", sa.String(50)),
        sa.Column("email", sa.String(200)),
        sa.Column("ciudad", sa.String(100)),
        sa.Column("direccion", sa.String(500)),
        sa.Column("lat", sa.Numeric(10, 7)),
        sa.Column("lng", sa.Numeric(10, 7)),
        sa.Column("descripcion", sa.Text, nullable=False),
        sa.Column("fotos_urls", ARRAY(sa.String)),
        sa.Column("estado", sa.String(20), server_default="nueva", index=True),
        sa.Column("prioridad", sa.String(20), server_default="normal"),
        sa.Column("fecha_preferida", sa.Date),
        sa.Column("franja_horaria", sa.String(50)),
        sa.Column("tecnico_asignado_id", UUID(as_uuid=True), sa.ForeignKey("sv_technicians.id"), nullable=True),
        sa.Column("quote_id", UUID(as_uuid=True), sa.ForeignKey("sv_quotes.id"), nullable=True),
        sa.Column("notas_internas", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # 27. sv_technician_reviews
    op.create_table(
        "sv_technician_reviews",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("technician_id", UUID(as_uuid=True), sa.ForeignKey("sv_technicians.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("work_order_id", UUID(as_uuid=True), sa.ForeignKey("sv_work_orders.id"), nullable=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False),
        sa.Column("calificacion", sa.Integer, nullable=False),
        sa.Column("comentario", sa.Text),
        sa.Column("aspectos", JSONB),
        sa.Column("recomendaria", sa.Boolean, server_default="true"),
        sa.Column("verificado", sa.Boolean, server_default="false"),
        sa.Column("respuesta_tecnico", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # 28. sv_technician_metrics
    op.create_table(
        "sv_technician_metrics",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("technician_id", UUID(as_uuid=True), sa.ForeignKey("sv_technicians.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("periodo", sa.String(7), nullable=False),
        sa.Column("total_trabajos", sa.Integer, server_default="0"),
        sa.Column("total_facturado", sa.Numeric(15, 0), server_default="0"),
        sa.Column("total_cobrado", sa.Numeric(15, 0), server_default="0"),
        sa.Column("horas_trabajadas", sa.Numeric(8, 2), server_default="0"),
        sa.Column("calificacion_promedio", sa.Numeric(3, 2), server_default="0"),
        sa.Column("primera_visita_exitosa_pct", sa.Numeric(5, 2), server_default="0"),
        sa.Column("tasa_retrabajo_pct", sa.Numeric(5, 2), server_default="0"),
        sa.Column("distancia_recorrida_km", sa.Numeric(10, 2), server_default="0"),
        sa.Column("combustible_pyg", sa.Numeric(15, 0), server_default="0"),
        sa.Column("comision_ganada", sa.Numeric(15, 0), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("technician_id", "periodo", name="uq_sv_tech_metric_period"),
    )


def downgrade() -> None:
    tables = [
        "sv_technician_metrics", "sv_technician_reviews", "sv_quote_requests",
        "sv_invoice_payments", "sv_invoices", "sv_inventory_movements",
        "sv_truck_inventory", "sv_contract_visits", "sv_service_contracts",
        "sv_time_entries", "sv_work_order_photos", "sv_work_order_items",
        "sv_work_orders", "sv_appointments", "sv_quote_photos", "sv_quote_items",
        "sv_quotes", "sv_equipment", "sv_properties", "sv_service_zones",
        "sv_team_members", "sv_teams", "sv_technician_availability",
        "sv_technician_certifications", "sv_technician_skills", "sv_technicians",
        "sv_skills", "sv_service_verticals",
    ]
    for t in tables:
        op.drop_table(t)
