"""Add Supermercado Fase 1 tables (Rotisería, HACCP, Auditorías, Equipos)

Revision ID: 20260601270000
Revises: 20260601260000
Create Date: 2026-06-02 02:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision: str = "20260601270000"
down_revision: Union[str, None] = "20260601260000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ============================================================
    # ROTISERÍA
    # ============================================================

    op.create_table(
        "supermer_rotiseria_recipes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("descripcion", sa.Text()),
        sa.Column("area", sa.String(20), nullable=False),
        sa.Column("holding_method", sa.String(20), nullable=False),
        sa.Column("factor_coccion", sa.Numeric(5, 4), nullable=False, server_default=sa.text("1.0")),
        sa.Column("factor_merma_coccion", sa.Numeric(5, 4)),
        sa.Column("producto_terminado_id", UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("cantidad_esperada", sa.Numeric(12, 3), nullable=False),
        sa.Column("unidad_medida", sa.String(20), server_default=sa.text("'unidad'")),
        sa.Column("temp_min_conservacion", sa.Numeric(5, 1)),
        sa.Column("temp_max_conservacion", sa.Numeric(5, 1)),
        sa.Column("tiempo_maximo_exhibicion_hs", sa.Numeric(4, 1)),
        sa.Column("requiere_etiquetado", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("alérgenos", sa.JSON()),
        sa.Column("costo_estimado_porcion", sa.Numeric(12, 2)),
        sa.Column("precio_sugerido", sa.Numeric(12, 2)),
        sa.Column("margen_objetivo_pct", sa.Numeric(5, 2)),
        sa.Column("activa", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "supermer_rotiseria_recipe_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("receta_id", UUID(as_uuid=True), sa.ForeignKey("supermer_rotiseria_recipes.id"), nullable=False),
        sa.Column("producto_id", UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("cantidad", sa.Numeric(12, 3), nullable=False),
        sa.Column("unidad_medida", sa.String(20)),
        sa.Column("es_opcional", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_rotiseria_recipe_items_receta", "supermer_rotiseria_recipe_items", ["receta_id"])

    op.create_table(
        "supermer_rotiseria_plans",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("fecha", sa.Date(), nullable=False, index=True),
        sa.Column("receta_id", UUID(as_uuid=True), sa.ForeignKey("supermer_rotiseria_recipes.id"), nullable=False),
        sa.Column("cantidad_objetivo", sa.Numeric(12, 3), nullable=False),
        sa.Column("cantidad_producida", sa.Numeric(12, 3)),
        sa.Column("estado", sa.String(20), server_default=sa.text("'planificada'")),
        sa.Column("hora_inicio", sa.DateTime(timezone=True)),
        sa.Column("hora_fin", sa.DateTime(timezone=True)),
        sa.Column("responsable_id", UUID(as_uuid=True)),
        sa.Column("notas", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_rotiseria_plan_fecha_company", "supermer_rotiseria_plans", ["company_id", "fecha"])

    op.create_table(
        "supermer_rotiseria_temp_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("plan_id", UUID(as_uuid=True), sa.ForeignKey("supermer_rotiseria_plans.id"), nullable=False),
        sa.Column("punto_control", sa.String(100), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("temperatura", sa.Numeric(5, 1), nullable=False),
        sa.Column("temp_min_requerida", sa.Numeric(5, 1)),
        sa.Column("temp_max_requerida", sa.Numeric(5, 1)),
        sa.Column("conforme", sa.Boolean()),
        sa.Column("registrado_por", UUID(as_uuid=True)),
        sa.Column("registrado_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("observaciones", sa.Text()),
    )
    op.create_index("ix_rotiseria_temp_plan", "supermer_rotiseria_temp_logs", ["plan_id"])

    op.create_table(
        "supermer_rotiseria_labels",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("plan_id", UUID(as_uuid=True), sa.ForeignKey("supermer_rotiseria_plans.id"), nullable=False),
        sa.Column("producto_id", UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("cantidad", sa.Numeric(12, 3), nullable=False),
        sa.Column("lote_codigo", sa.String(50), nullable=False),
        sa.Column("fecha_elaboracion", sa.Date(), nullable=False),
        sa.Column("fecha_vencimiento", sa.Date(), nullable=False),
        sa.Column("ingredientes", sa.Text()),
        sa.Column("alérgenos", sa.JSON()),
        sa.Column("informacion_nutricional", sa.JSON()),
        sa.Column("precio_unitario", sa.Numeric(12, 2)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "supermer_rotiseria_markdowns",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("label_batch_id", UUID(as_uuid=True), sa.ForeignKey("supermer_rotiseria_labels.id"), nullable=False),
        sa.Column("producto_id", UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("precio_original", sa.Numeric(12, 2), nullable=False),
        sa.Column("descuento_sugerido_pct", sa.Numeric(5, 2)),
        sa.Column("precio_markdown", sa.Numeric(12, 2)),
        sa.Column("motivo", sa.String(50)),
        sa.Column("aplicado", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ============================================================
    # HACCP
    # ============================================================

    op.create_table(
        "supermer_haccp_plans",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("area", sa.String(50), nullable=False, index=True),
        sa.Column("descripcion", sa.Text()),
        sa.Column("version", sa.Integer(), server_default=sa.text("1")),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_haccp_plan_area_company", "supermer_haccp_plans", ["company_id", "area"])

    op.create_table(
        "supermer_haccp_critical_points",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("plan_id", UUID(as_uuid=True), sa.ForeignKey("supermer_haccp_plans.id"), nullable=False),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("riesgo", sa.String(20), nullable=False),
        sa.Column("limite_inferior", sa.Numeric(8, 2)),
        sa.Column("limite_superior", sa.Numeric(8, 2)),
        sa.Column("unidad", sa.String(20)),
        sa.Column("frecuencia_monitoreo_min", sa.Integer()),
        sa.Column("metodo_monitoreo", sa.String(200)),
        sa.Column("accion_correctiva_template", sa.Text()),
        sa.Column("sensor_ids", sa.JSON()),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("orden", sa.Integer(), server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_haccp_cp_plan", "supermer_haccp_critical_points", ["plan_id", "orden"])

    op.create_table(
        "supermer_haccp_monitoring_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("critical_point_id", UUID(as_uuid=True), sa.ForeignKey("supermer_haccp_critical_points.id"), nullable=False),
        sa.Column("valor", sa.Numeric(8, 2), nullable=False),
        sa.Column("conforme", sa.Boolean(), nullable=False),
        sa.Column("fuente", sa.String(20), server_default=sa.text("'manual'")),
        sa.Column("sensor_id", UUID(as_uuid=True)),
        sa.Column("registrado_por", UUID(as_uuid=True)),
        sa.Column("registrado_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("observaciones", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_haccp_monitoring_cp", "supermer_haccp_monitoring_logs", ["critical_point_id", "registrado_at"])

    op.create_table(
        "supermer_haccp_corrective_actions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("monitoring_log_id", UUID(as_uuid=True), sa.ForeignKey("supermer_haccp_monitoring_logs.id"), nullable=False),
        sa.Column("critical_point_id", UUID(as_uuid=True), sa.ForeignKey("supermer_haccp_critical_points.id"), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=False),
        sa.Column("accion_tomada", sa.Text(), nullable=False),
        sa.Column("responsable_id", UUID(as_uuid=True), nullable=False),
        sa.Column("producto_afectado_id", UUID(as_uuid=True), sa.ForeignKey("products.id")),
        sa.Column("disposicion", sa.String(50)),
        sa.Column("cantidad_afectada", sa.Numeric(12, 3)),
        sa.Column("costo_perdida", sa.Numeric(12, 2)),
        sa.Column("resuelto", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("resuelto_at", sa.DateTime(timezone=True)),
        sa.Column("resuelto_por", UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ============================================================
    # AUDITORÍAS
    # ============================================================

    op.create_table(
        "supermer_audit_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("descripcion", sa.Text()),
        sa.Column("area", sa.String(20), nullable=False, index=True),
        sa.Column("schedule", sa.String(20), nullable=False),
        sa.Column("peso_porcentual", sa.Numeric(5, 2), server_default=sa.text("100.0")),
        sa.Column("puntaje_minimo_aprobacion", sa.Numeric(5, 2), server_default=sa.text("70.0")),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("version", sa.Integer(), server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_audit_template_area_company", "supermer_audit_templates", ["company_id", "area"])

    op.create_table(
        "supermer_audit_template_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("template_id", UUID(as_uuid=True), sa.ForeignKey("supermer_audit_templates.id"), nullable=False),
        sa.Column("orden", sa.Integer(), nullable=False),
        sa.Column("pregunta", sa.String(500), nullable=False),
        sa.Column("tipo_respuesta", sa.String(20), nullable=False),
        sa.Column("peso", sa.Numeric(5, 2), server_default=sa.text("1.0")),
        sa.Column("opciones", sa.JSON()),
        sa.Column("instrucciones", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_audit_template_items_template", "supermer_audit_template_items", ["template_id", "orden"])

    op.create_table(
        "supermer_audit_executions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("template_id", UUID(as_uuid=True), sa.ForeignKey("supermer_audit_templates.id"), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False, index=True),
        sa.Column("hora", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ejecutado_por", UUID(as_uuid=True), nullable=False),
        sa.Column("puntaje_total", sa.Numeric(8, 2)),
        sa.Column("puntaje_maximo", sa.Numeric(8, 2)),
        sa.Column("porcentaje", sa.Numeric(5, 2)),
        sa.Column("aprobado", sa.Boolean()),
        sa.Column("estado", sa.String(20), server_default=sa.text("'en_curso'")),
        sa.Column("supervisor_id", UUID(as_uuid=True)),
        sa.Column("notas_generales", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_audit_executions_fecha_company", "supermer_audit_executions", ["company_id", "fecha"])

    op.create_table(
        "supermer_audit_answers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("execution_id", UUID(as_uuid=True), sa.ForeignKey("supermer_audit_executions.id"), nullable=False),
        sa.Column("template_item_id", UUID(as_uuid=True), sa.ForeignKey("supermer_audit_template_items.id"), nullable=False),
        sa.Column("valor", sa.String(500), nullable=False),
        sa.Column("conforme", sa.Boolean()),
        sa.Column("foto_url", sa.String(500)),
        sa.Column("observaciones", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_audit_answers_execution", "supermer_audit_answers", ["execution_id"])

    # ============================================================
    # MANTENIMIENTO DE EQUIPOS
    # ============================================================

    op.create_table(
        "supermer_equipment",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("categoria", sa.String(30), nullable=False, index=True),
        sa.Column("marca", sa.String(100)),
        sa.Column("modelo", sa.String(100)),
        sa.Column("numero_serie", sa.String(100)),
        sa.Column("codigo_inventario", sa.String(50)),
        sa.Column("area", sa.String(50)),
        sa.Column("ubicacion", sa.String(200)),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("fecha_instalacion", sa.Date()),
        sa.Column("fecha_ultimo_mantenimiento", sa.Date()),
        sa.Column("fecha_proximo_mantenimiento", sa.Date()),
        sa.Column("capacidad", sa.String(100)),
        sa.Column("eficiencia_energetica", sa.String(10)),
        sa.Column("consumo_estimado_kwh", sa.Numeric(8, 2)),
        sa.Column("temp_min_operacion", sa.Numeric(5, 1)),
        sa.Column("temp_max_operacion", sa.Numeric(5, 1)),
        sa.Column("alerta_habilitada", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("proveedor_mantenimiento", sa.String(200)),
        sa.Column("garantia_vencimiento", sa.Date()),
        sa.Column("costo_adquisicion", sa.Numeric(12, 2)),
        sa.Column("prioridad", sa.String(10), server_default=sa.text("'media'")),
        sa.Column("notas", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "supermer_equipment_schedules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("equipo_id", UUID(as_uuid=True), sa.ForeignKey("supermer_equipment.id"), nullable=False),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("frecuencia_dias", sa.Integer(), nullable=False),
        sa.Column("frecuencia_instrucciones", sa.Text()),
        sa.Column("tareas", sa.JSON(), nullable=False),
        sa.Column("duracion_estimada_min", sa.Integer()),
        sa.Column("prioridad", sa.String(10), server_default=sa.text("'media'")),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "supermer_equipment_work_orders",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("equipo_id", UUID(as_uuid=True), sa.ForeignKey("supermer_equipment.id"), nullable=False),
        sa.Column("schedule_id", UUID(as_uuid=True), sa.ForeignKey("supermer_equipment_schedules.id")),
        sa.Column("numero_ot", sa.String(50), nullable=False),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("prioridad", sa.String(10), server_default=sa.text("'media'")),
        sa.Column("estado", sa.String(20), server_default=sa.text("'pendiente'")),
        sa.Column("descripcion_falla", sa.Text()),
        sa.Column("sintomas", sa.JSON()),
        sa.Column("asignado_a", UUID(as_uuid=True)),
        sa.Column("fecha_programada", sa.Date()),
        sa.Column("fecha_inicio", sa.DateTime(timezone=True)),
        sa.Column("fecha_fin", sa.DateTime(timezone=True)),
        sa.Column("horas_trabajadas", sa.Numeric(6, 2)),
        sa.Column("costo_repuestos", sa.Numeric(12, 2)),
        sa.Column("costo_mano_obra", sa.Numeric(12, 2)),
        sa.Column("costo_total", sa.Numeric(12, 2)),
        sa.Column("diagnostico", sa.Text()),
        sa.Column("acciones_realizadas", sa.Text()),
        sa.Column("repuestos_utilizados", sa.JSON()),
        sa.Column("resultado", sa.String(20)),
        sa.Column("requiere_seguimiento", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("notas", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_equipment_wo_estado", "supermer_equipment_work_orders", ["company_id", "estado"])

    op.create_table(
        "supermer_equipment_alerts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("equipo_id", UUID(as_uuid=True), sa.ForeignKey("supermer_equipment.id"), nullable=False),
        sa.Column("tipo", sa.String(50), nullable=False),
        sa.Column("severidad", sa.String(20), server_default=sa.text("'media'")),
        sa.Column("mensaje", sa.Text(), nullable=False),
        sa.Column("resuelta", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("resuelta_at", sa.DateTime(timezone=True)),
        sa.Column("resuelta_por", UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    tables = [
        "supermer_equipment_alerts",
        "supermer_equipment_work_orders",
        "supermer_equipment_schedules",
        "supermer_equipment",
        "supermer_audit_answers",
        "supermer_audit_executions",
        "supermer_audit_template_items",
        "supermer_audit_templates",
        "supermer_haccp_corrective_actions",
        "supermer_haccp_monitoring_logs",
        "supermer_haccp_critical_points",
        "supermer_haccp_plans",
        "supermer_rotiseria_markdowns",
        "supermer_rotiseria_labels",
        "supermer_rotiseria_temp_logs",
        "supermer_rotiseria_plans",
        "supermer_rotiseria_recipe_items",
        "supermer_rotiseria_recipes",
    ]
    for t in tables:
        op.drop_table(t)
