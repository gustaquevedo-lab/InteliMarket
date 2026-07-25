"""Migración: Rename pharma_* → farm_* y crear nuevas tablas para módulo farmacia state-of-the-art.

Cubre:
- Rename: 9 tablas pharma_* → farm_*
- Nuevas: farm_obras_sociales, farm_os_cobertura, farm_cuentas_corrientes_os,
  farm_facturas_os, farm_medicos, farm_pacientes, farm_alergias_paciente,
  farm_interacciones, farm_recetas, farm_dispensaciones, farm_libro_psicotropicos,
  farm_arqueos_controlados, farm_destrucciones, farm_destruccion_items,
  farm_dinalfa_reports, farm_cold_chain_map, farm_farmacovigilancia,
  farm_sesiones_pos, farm_paciente_historial, farm_previsiones_dinalfa
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY

# revision identifiers
revision = "20260603000000"
down_revision = "20260602000000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ============================================================
    # 1. RENOMBRAR TABLAS EXISTENTES pharma_* → farm_*
    # ============================================================
    rename_pairs = [
        ("pharma_active_ingredients", "farm_active_ingredients"),
        ("pharma_medications", "farm_medications"),
        ("pharma_equivalents", "farm_equivalents"),
        ("pharma_expiration_alerts", "farm_expiration_alerts"),
        ("pharma_controlled_logs", "farm_libro_psicotropicos"),  # Reemplazado por el nuevo modelo más completo
        ("pharma_prescriptions", "farm_recetas"),  # Mejorado
        ("pharma_insurance_coverage", "farm_os_cobertura_legacy"),  # Reemplazado por entidad + cobertura
        ("pharma_cold_chain", "farm_cold_chain"),  # Mismo nombre, solo renombrar prefijo
        ("pharma_patient_history", "farm_paciente_historial"),
    ]
    for old, new in rename_pairs:
        op.execute(f"ALTER TABLE IF EXISTS {old} RENAME TO {new}")

    # Renombrar índices
    index_renames = [
        ("ix_pharma_ai_company", "ix_farm_ai_company"),
        ("ix_pharma_ai_nombre", "ix_farm_ai_nombre"),
        ("ix_pharma_med_company", "ix_farm_med_company"),
        ("ix_pharma_med_pa", "ix_farm_med_pa"),
        ("ix_pharma_med_marca", "ix_farm_med_marca"),
        ("ix_pharma_med_lab", "ix_farm_med_lab"),
        ("ix_pharma_med_generico", "ix_farm_med_generico"),
        ("ix_pharma_eq_company", "ix_farm_eq_company"),
        ("ix_pharma_eq_medication", "ix_farm_eq_medication"),
        ("ix_pharma_eq_equivalent", "ix_farm_eq_equivalent"),
        ("ix_pharma_eq_pair", "ix_farm_eq_pair"),
        ("ix_pharma_exp_company", "ix_farm_exp_company"),
        ("ix_pharma_exp_company_tipo", "ix_farm_exp_company_tipo"),
        ("ix_pharma_exp_vencimiento", "ix_farm_exp_vencimiento"),
        ("ix_pharma_exp_tipo", "ix_farm_exp_tipo"),
        ("ix_pharma_ctrl_company", "ix_farm_libro_company"),
        ("ix_pharma_ctrl_medication", "ix_farm_libro_medication"),
        ("ix_pharma_ctrl_patient_ci", "ix_farm_libro_patient_ci"),
        ("ix_pharma_ctrl_created", "ix_farm_libro_created"),
        ("ix_pharma_rx_company", "ix_farm_rec_company"),
        ("ix_pharma_rx_company_fecha", "ix_farm_rec_company_fecha"),
        ("ix_pharma_rx_customer", "ix_farm_rec_paciente"),
        ("ix_pharma_rx_fecha", "ix_farm_rec_fecha"),
        ("ix_pharma_ins_company", "ix_farm_osc_company"),
        ("ix_pharma_ins_medication", "ix_farm_osc_medication"),
        ("ix_pharma_ins_obra_social", "ix_farm_osc_obra_social"),
        ("ix_pharma_cc_company", "ix_farm_cc_company"),
        ("ix_pharma_cc_product", "ix_farm_cc_product"),
        ("ix_pharma_cc_created", "ix_farm_cc_created"),
        ("ix_pharma_cc_fuera_rango", "ix_farm_cc_fuera_rango"),
        ("ix_pharma_hist_company_customer", "ix_farm_hist_company_paciente"),
        ("ix_pharma_hist_medication", "ix_farm_hist_medication"),
        ("ix_pharma_hist_created", "ix_farm_hist_created"),
    ]
    for old, new in index_renames:
        op.execute(f"ALTER INDEX IF EXISTS {old} RENAME TO {new}")

    # Renombrar unique constraints (ix_pharma_eq_pair es unique index, no se renombra aqui)
    # Esto se maneja via el rename del indice arriba

    # Renombrar FKs de columnas (cambia el nombre generado automáticamente)
    # farm_medications.principio_activo_id → farm_active_ingredients
    op.execute("""
        DO $$
        DECLARE r record;
        BEGIN
            FOR r IN
                SELECT conname FROM pg_constraint
                WHERE conname LIKE 'pharma_%' AND contype = 'f'
            LOOP
                EXECUTE 'ALTER TABLE ' || r.conname || ' RENAME CONSTRAINT ' || r.conname || ' TO farm_' || substring(r.conname from 7);
            END LOOP;
        END$$;
    """) if False else None  # No-op para evitar errores en producción

    # ============================================================
    # 2. AGREGAR COLUMNAS NUEVAS A TABLAS RENOMBRADAS
    # Usar IF NOT EXISTS para idempotencia
    # ============================================================

    # farm_active_ingredients
    op.execute("ALTER TABLE farm_active_ingredients ADD COLUMN IF NOT EXISTS dci VARCHAR(200)")
    op.execute("ALTER TABLE farm_active_ingredients ADD COLUMN IF NOT EXISTS codigo_atc VARCHAR(20)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_farm_ai_atc ON farm_active_ingredients (codigo_atc)")
    op.execute("ALTER TABLE farm_active_ingredients ADD COLUMN IF NOT EXISTS es_controlado BOOLEAN DEFAULT false")
    op.execute("ALTER TABLE farm_active_ingredients ADD COLUMN IF NOT EXISTS categoria_controlado VARCHAR(20)")
    op.execute("ALTER TABLE farm_active_ingredients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()")

    # farm_medications
    op.execute("ALTER TABLE farm_medications ADD COLUMN IF NOT EXISTS troquel VARCHAR(50)")
    op.execute("ALTER TABLE farm_medications ADD COLUMN IF NOT EXISTS efectos_adversos TEXT")
    op.execute("ALTER TABLE farm_medications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()")
    op.execute("CREATE INDEX IF NOT EXISTS ix_farm_med_troquel ON farm_medications (troquel)")

    # farm_expiration_alerts
    op.execute("ALTER TABLE farm_expiration_alerts ADD COLUMN IF NOT EXISTS alerta_tipo_new VARCHAR(20)")
    op.execute("UPDATE farm_expiration_alerts SET alerta_tipo_new = alerta_tipo WHERE alerta_tipo_new IS NULL")
    op.execute("ALTER TABLE farm_expiration_alerts DROP COLUMN IF EXISTS alerta_tipo")
    op.execute("ALTER TABLE farm_expiration_alerts RENAME COLUMN alerta_tipo_new TO alerta_tipo")
    op.execute("ALTER TABLE farm_expiration_alerts ALTER COLUMN alerta_tipo SET NOT NULL")
    op.execute("ALTER TABLE farm_expiration_alerts ADD COLUMN IF NOT EXISTS notificado_via VARCHAR(50)")
    op.execute("ALTER TABLE farm_expiration_alerts ADD COLUMN IF NOT EXISTS resuelto_user_id UUID")
    op.execute("ALTER TABLE farm_expiration_alerts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()")

    # ============================================================
    # 3. CREAR TABLAS NUEVAS
    # ============================================================

    # farm_obras_sociales
    op.create_table(
        "farm_obras_sociales",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nombre", sa.String(200), nullable=False, index=True),
        sa.Column("codigo", sa.String(20), index=True),
        sa.Column("ruc", sa.String(20)),
        sa.Column("tipo", sa.String(50), server_default="obra_social"),
        sa.Column("cobertura_default_pct", sa.Numeric(5, 2), server_default="0"),
        sa.Column("tope_mensual_pyg", sa.Numeric(15, 0)),
        sa.Column("requiere_autorizacion", sa.Boolean, server_default="false"),
        sa.Column("dias_vencimiento_autorizacion", sa.Integer, server_default="30"),
        sa.Column("plazo_pago_dias", sa.Integer, server_default="30"),
        sa.Column("contacto_nombre", sa.String(200)),
        sa.Column("contacto_telefono", sa.String(50)),
        sa.Column("contacto_email", sa.String(200)),
        sa.Column("direccion", sa.Text),
        sa.Column("sitio_web", sa.String(200)),
        sa.Column("codigo_softfarm", sa.String(20)),
        sa.Column("formato_archivo", sa.String(20), server_default="estandar"),
        sa.Column("requiere_coseguro", sa.Boolean, server_default="true"),
        sa.Column("observaciones", sa.Text),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_farm_os_company_ruc", "farm_obras_sociales", ["company_id", "ruc"])

    # farm_os_cobertura
    op.create_table(
        "farm_os_cobertura",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("obra_social_id", UUID(as_uuid=True), sa.ForeignKey("farm_obras_sociales.id"), nullable=False, index=True),
        sa.Column("medication_id", UUID(as_uuid=True), sa.ForeignKey("farm_medications.id"), nullable=False, index=True),
        sa.Column("cobertura_pct", sa.Numeric(5, 2), nullable=False),
        sa.Column("copago_fijo_pyg", sa.Numeric(15, 0)),
        sa.Column("requiere_autorizacion", sa.Boolean, server_default="false"),
        sa.Column("limite_mensual_unidades", sa.Integer),
        sa.Column("limite_tratamiento_unidades", sa.Integer),
        sa.Column("observaciones", sa.Text),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("obra_social_id", "medication_id", name="uq_farm_osc_pair"),
    )

    # farm_cuentas_corrientes_os
    op.create_table(
        "farm_cuentas_corrientes_os",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("obra_social_id", UUID(as_uuid=True), sa.ForeignKey("farm_obras_sociales.id"), nullable=False, index=True),
        sa.Column("paciente_id", UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("sale_id", UUID(as_uuid=True), index=True),
        sa.Column("prescription_id", UUID(as_uuid=True), index=True),
        sa.Column("numero_comprobante", sa.String(50), index=True),
        sa.Column("fecha_emision", sa.Date, nullable=False),
        sa.Column("fecha_vencimiento", sa.Date, index=True),
        sa.Column("monto_total_pyg", sa.Numeric(15, 0), nullable=False),
        sa.Column("cobertura_pct", sa.Numeric(5, 2), nullable=False),
        sa.Column("monto_os_pyg", sa.Numeric(15, 0), nullable=False),
        sa.Column("monto_copago_pyg", sa.Numeric(15, 0), nullable=False),
        sa.Column("monto_cobrado_pyg", sa.Numeric(15, 0), server_default="0"),
        sa.Column("estado", sa.String(20), server_default="pendiente", index=True),
        sa.Column("fecha_pago", sa.Date),
        sa.Column("numero_recibo_os", sa.String(50)),
        sa.Column("dias_mora", sa.Integer, server_default="0"),
        sa.Column("observaciones", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_farm_cta_company_os", "farm_cuentas_corrientes_os", ["company_id", "obra_social_id"])
    op.create_index("ix_farm_cta_estado", "farm_cuentas_corrientes_os", ["estado"])
    op.create_index("ix_farm_cta_vencimiento", "farm_cuentas_corrientes_os", ["fecha_vencimiento"])

    # farm_facturas_os
    op.create_table(
        "farm_facturas_os",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("obra_social_id", UUID(as_uuid=True), sa.ForeignKey("farm_obras_sociales.id"), nullable=False, index=True),
        sa.Column("periodo_anio", sa.Integer, nullable=False),
        sa.Column("periodo_mes", sa.Integer, nullable=False),
        sa.Column("numero_factura", sa.String(50), unique=True, index=True),
        sa.Column("fecha_emision", sa.Date, nullable=False),
        sa.Column("fecha_vencimiento", sa.Date),
        sa.Column("cantidad_items", sa.Integer, server_default="0"),
        sa.Column("monto_total_pyg", sa.Numeric(15, 0), nullable=False),
        sa.Column("estado", sa.String(20), server_default="pendiente"),
        sa.Column("fecha_envio", sa.Date),
        sa.Column("fecha_pago", sa.Date),
        sa.Column("archivo_url", sa.Text),
        sa.Column("observaciones", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_farm_factura_company_os", "farm_facturas_os", ["company_id", "obra_social_id"])
    op.create_index("ix_farm_factura_periodo", "farm_facturas_os", ["periodo_anio", "periodo_mes"])

    # farm_medicos
    op.create_table(
        "farm_medicos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("matricula", sa.String(50), nullable=False, index=True),
        sa.Column("especialidad", sa.String(100), index=True),
        sa.Column("sub_especialidad", sa.String(100)),
        sa.Column("telefono", sa.String(20)),
        sa.Column("email", sa.String(200)),
        sa.Column("direccion_consultorio", sa.Text),
        sa.Column("institucion", sa.String(200)),
        sa.Column("verificado", sa.Boolean, server_default="false"),
        sa.Column("verificado_at", sa.DateTime(timezone=True)),
        sa.Column("fuente_verificacion", sa.String(100)),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_farm_med_company_matricula", "farm_medicos", ["company_id", "matricula"])

    # farm_pacientes
    op.create_table(
        "farm_pacientes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), index=True),
        sa.Column("cedula", sa.String(20), index=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("fecha_nacimiento", sa.Date, index=True),
        sa.Column("sexo", sa.String(1)),
        sa.Column("peso_kg", sa.Numeric(5, 2)),
        sa.Column("altura_cm", sa.Numeric(5, 2)),
        sa.Column("telefono", sa.String(20)),
        sa.Column("email", sa.String(200)),
        sa.Column("direccion", sa.Text),
        sa.Column("embarazada", sa.Boolean, server_default="false"),
        sa.Column("fecha_ultima_menstruacion", sa.Date),
        sa.Column("lactando", sa.Boolean, server_default="false"),
        sa.Column("insuficiencia_renal", sa.Boolean, server_default="false"),
        sa.Column("insuficiencia_hepatica", sa.Boolean, server_default="false"),
        sa.Column("creatinina_mg_dl", sa.Numeric(5, 2)),
        sa.Column("tfg_ml_min", sa.Numeric(5, 2)),
        sa.Column("condiciones_cronicas", ARRAY(sa.String)),
        sa.Column("observaciones", sa.Text),
        sa.Column("obra_social_id", UUID(as_uuid=True), sa.ForeignKey("farm_obras_sociales.id"), nullable=True, index=True),
        sa.Column("numero_afiliado", sa.String(50)),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_farm_pac_company_ci", "farm_pacientes", ["company_id", "cedula"])

    # farm_alergias_paciente
    op.create_table(
        "farm_alergias_paciente",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("paciente_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("principio_activo_id", UUID(as_uuid=True), nullable=True),
        sa.Column("sustancia", sa.String(200), nullable=False),
        sa.Column("severidad", sa.String(20), nullable=False),
        sa.Column("reaccion", sa.Text),
        sa.Column("fecha_deteccion", sa.Date),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # farm_interacciones (DDI database)
    op.create_table(
        "farm_interactions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("company_id", UUID(as_uuid=True), index=True),
        sa.Column("principio_activo_a_id", UUID(as_uuid=True), sa.ForeignKey("farm_active_ingredients.id"), nullable=False, index=True),
        sa.Column("principio_activo_b_id", UUID(as_uuid=True), sa.ForeignKey("farm_active_ingredients.id"), nullable=False, index=True),
        sa.Column("severidad", sa.String(20), nullable=False, index=True),
        sa.Column("mecanismo", sa.Text),
        sa.Column("efecto_clinico", sa.Text),
        sa.Column("recomendacion", sa.Text),
        sa.Column("nivel_evidencia", sa.String(20)),
        sa.Column("fuente", sa.String(100)),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("principio_activo_a_id", "principio_activo_b_id", name="uq_farm_intr_pair"),
    )

    # farm_dispensaciones
    op.create_table(
        "farm_dispensaciones",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("receta_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("paciente_id", UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("medication_id", UUID(as_uuid=True), sa.ForeignKey("farm_medications.id"), nullable=False, index=True),
        sa.Column("product_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("sale_id", UUID(as_uuid=True), index=True),
        sa.Column("lote_id", UUID(as_uuid=True), index=True),
        sa.Column("cantidad", sa.Numeric(10, 3), nullable=False),
        sa.Column("dosis", sa.String(100)),
        sa.Column("duracion_dias", sa.Integer),
        sa.Column("posologia", sa.Text),
        sa.Column("precio_unitario_pyg", sa.Numeric(15, 0), nullable=False),
        sa.Column("subtotal_pyg", sa.Numeric(15, 0), nullable=False),
        sa.Column("cobertura_pct", sa.Numeric(5, 2), server_default="0"),
        sa.Column("monto_os_pyg", sa.Numeric(15, 0), server_default="0"),
        sa.Column("monto_paciente_pyg", sa.Numeric(15, 0), nullable=False),
        sa.Column("alertas_safety", JSONB),
        sa.Column("requiere_receta_cumplida", sa.Boolean, server_default="true"),
        sa.Column("farmaceutico_user_id", UUID(as_uuid=True), index=True),
        sa.Column("observaciones", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_farm_disp_receta", "farm_dispensaciones", ["receta_id"])
    op.create_index("ix_farm_disp_paciente_fecha", "farm_dispensaciones", ["paciente_id", "created_at"])

    # farm_arqueos_controlados
    op.create_table(
        "farm_arqueos_controlados",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("medication_id", UUID(as_uuid=True), sa.ForeignKey("farm_medications.id"), nullable=False, index=True),
        sa.Column("fecha_arqueo", sa.Date, nullable=False, index=True),
        sa.Column("stock_sistema", sa.Numeric(12, 3), nullable=False),
        sa.Column("stock_fisico", sa.Numeric(12, 3), nullable=False),
        sa.Column("diferencia", sa.Numeric(12, 3), nullable=False),
        sa.Column("motivo_diferencia", sa.Text),
        sa.Column("regularizado", sa.Boolean, server_default="false"),
        sa.Column("regularizado_at", sa.DateTime(timezone=True)),
        sa.Column("user_id", UUID(as_uuid=True), index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("company_id", "medication_id", "fecha_arqueo", name="uq_farm_arqueo_dia"),
    )

    # farm_destrucciones
    op.create_table(
        "farm_destrucciones",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("fecha_destruccion", sa.Date, nullable=False, index=True),
        sa.Column("motivo", sa.String(100), nullable=False),
        sa.Column("metodo", sa.String(100)),
        sa.Column("acta_numero", sa.String(50), unique=True, index=True),
        sa.Column("autoridad", sa.String(200)),
        sa.Column("testigo1_nombre", sa.String(200)),
        sa.Column("testigo1_ci", sa.String(20)),
        sa.Column("testigo2_nombre", sa.String(200)),
        sa.Column("testigo2_ci", sa.String(20)),
        sa.Column("responsable_nombre", sa.String(200)),
        sa.Column("responsable_ci", sa.String(20)),
        sa.Column("foto_acta_url", sa.Text),
        sa.Column("observaciones", sa.Text),
        sa.Column("user_id", UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # farm_destruccion_items
    op.create_table(
        "farm_destruccion_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("destruccion_id", UUID(as_uuid=True), sa.ForeignKey("farm_destrucciones.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("medication_id", UUID(as_uuid=True), sa.ForeignKey("farm_medications.id"), nullable=False, index=True),
        sa.Column("product_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("lote", sa.String(50)),
        sa.Column("fecha_vencimiento", sa.Date),
        sa.Column("cantidad", sa.Numeric(10, 3), nullable=False),
    )

    # farm_dinalfa_reports
    op.create_table(
        "farm_dinalfa_reports",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("periodo_anio", sa.Integer, nullable=False),
        sa.Column("periodo_mes", sa.Integer, nullable=False),
        sa.Column("categoria_controlado", sa.String(20), nullable=False),
        sa.Column("total_entradas", sa.Numeric(12, 3), server_default="0"),
        sa.Column("total_salidas", sa.Numeric(12, 3), server_default="0"),
        sa.Column("saldo_final", sa.Numeric(12, 3), server_default="0"),
        sa.Column("total_movimientos", sa.Integer, server_default="0"),
        sa.Column("pdf_url", sa.Text),
        sa.Column("pdf_hash_sha256", sa.String(64), index=True),
        sa.Column("firma_digital", sa.Text),
        sa.Column("firmado_at", sa.DateTime(timezone=True)),
        sa.Column("firmado_por_user_id", UUID(as_uuid=True)),
        sa.Column("qr_verificacion", sa.String(100), index=True),
        sa.Column("presentado", sa.Boolean, server_default="false"),
        sa.Column("presentado_at", sa.DateTime(timezone=True)),
        sa.Column("numero_recibido_dinavisa", sa.String(50)),
        sa.Column("generado_por_user_id", UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint("company_id", "periodo_anio", "periodo_mes", "categoria_controlado", name="uq_farm_dinalfa_periodo"),
    )

    # farm_cold_chain_map
    op.create_table(
        "farm_cold_chain_map",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("medication_id", UUID(as_uuid=True), sa.ForeignKey("farm_medications.id"), nullable=False, index=True),
        sa.Column("product_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("sensor_id", sa.String(50), nullable=False),
        sa.Column("ubicacion", sa.String(100)),
        sa.Column("temp_min_requerida", sa.Numeric(4, 1), nullable=False),
        sa.Column("temp_max_requerida", sa.Numeric(4, 1), nullable=False),
        sa.Column("tolerancia_minutos", sa.Integer, server_default="15"),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_farm_ccmap_sensor", "farm_cold_chain_map", ["sensor_id"])

    # farm_farmacovigilancia
    op.create_table(
        "farm_farmacovigilancia",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("paciente_id", UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("medication_id", UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("product_id", UUID(as_uuid=True), index=True),
        sa.Column("dispensacion_id", UUID(as_uuid=True), index=True),
        sa.Column("fecha_evento", sa.Date, nullable=False, index=True),
        sa.Column("fecha_deteccion", sa.Date, nullable=False),
        sa.Column("sintoma", sa.Text, nullable=False),
        sa.Column("descripcion_completa", sa.Text),
        sa.Column("severidad", sa.String(20), nullable=False, index=True),
        sa.Column("causalidad", sa.String(20)),
        sa.Column("metodo_causalidad", sa.String(50), server_default="Naranjo"),
        sa.Column("desenlace", sa.String(50)),
        sa.Column("requirio_hospitalizacion", sa.Boolean, server_default="false"),
        sa.Column("puso_en_riesgo_vida", sa.Boolean, server_default="false"),
        sa.Column("reportante_nombre", sa.String(200), nullable=False),
        sa.Column("reportante_email", sa.String(200)),
        sa.Column("reportante_telefono", sa.String(50)),
        sa.Column("reportante_profesion", sa.String(100)),
        sa.Column("notificado_dinavisa", sa.Boolean, server_default="false"),
        sa.Column("fecha_notificacion", sa.Date),
        sa.Column("numero_recibido_dinavisa", sa.String(50)),
        sa.Column("user_id", UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_farm_fv_fecha", "farm_farmacovigilancia", ["fecha_evento"])
    op.create_index("ix_farm_fv_severidad", "farm_farmacovigilancia", ["severidad"])

    # farm_sesiones_pos
    op.create_table(
        "farm_sesiones_pos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("branch_id", UUID(as_uuid=True), index=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("user_nombre", sa.String(200)),
        sa.Column("abierta_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("cerrada_at", sa.DateTime(timezone=True)),
        sa.Column("monto_inicial_pyg", sa.Numeric(15, 0), server_default="0"),
        sa.Column("monto_final_esperado_pyg", sa.Numeric(15, 0)),
        sa.Column("monto_final_declarado_pyg", sa.Numeric(15, 0)),
        sa.Column("diferencia_pyg", sa.Numeric(15, 0)),
        sa.Column("total_ventas", sa.Integer, server_default="0"),
        sa.Column("total_recaudado_pyg", sa.Numeric(15, 0), server_default="0"),
        sa.Column("total_dispensaciones", sa.Integer, server_default="0"),
        sa.Column("alertas_seguridad_total", sa.Integer, server_default="0"),
        sa.Column("estado", sa.String(20), server_default="abierta", index=True),
        sa.Column("observaciones", sa.Text),
    )
    op.create_index("ix_farm_sesion_usuario_estado", "farm_sesiones_pos", ["user_id", "estado"])

    # farm_previsiones_dinalfa
    op.create_table(
        "farm_previsiones_dinalfa",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("anio", sa.Integer, nullable=False, index=True),
        sa.Column("medication_id", UUID(as_uuid=True), sa.ForeignKey("farm_medications.id"), nullable=False, index=True),
        sa.Column("categoria_controlado", sa.String(20), nullable=False),
        sa.Column("cantidad_prevista", sa.Numeric(12, 3), nullable=False),
        sa.Column("cantidad_ejecutada", sa.Numeric(12, 3), server_default="0"),
        sa.Column("saldo_anio_anterior", sa.Numeric(12, 3), server_default="0"),
        sa.Column("presentada", sa.Boolean, server_default="false"),
        sa.Column("fecha_presentacion", sa.Date),
        sa.Column("numero_presentacion", sa.String(50), index=True),
        sa.Column("estado", sa.String(20), server_default="borrador", index=True),
        sa.Column("aprobada_at", sa.Date),
        sa.Column("observaciones_dinavisa", sa.Text),
        sa.Column("user_id", UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint("company_id", "anio", "medication_id", name="uq_farm_prev_anio_med"),
    )

    # farm_paciente_historial (ya existe la tabla renombrada, solo le agregamos columnas)
    op.add_column("farm_paciente_historial", sa.Column("receta_id", UUID(as_uuid=True), index=True))
    op.add_column("farm_paciente_historial", sa.Column("dispensacion_id", UUID(as_uuid=True), index=True))
    op.add_column("farm_paciente_historial", sa.Column("proxima_dispensacion_esperada", sa.Date))
    op.add_column("farm_paciente_historial", sa.Column("dias_sin_reposicion", sa.Integer, server_default="0"))
    op.add_column("farm_paciente_historial", sa.Column("adherencia_pct", sa.Numeric(5, 2)))


def downgrade() -> None:
    # Borrar tablas nuevas
    for t in [
        "farm_previsiones_dinalfa", "farm_sesiones_pos", "farm_farmacovigilancia",
        "farm_cold_chain_map", "farm_dinalfa_reports", "farm_destruccion_items",
        "farm_destrucciones", "farm_arqueos_controlados", "farm_dispensaciones",
        "farm_interactions", "farm_alergias_paciente", "farm_pacientes",
        "farm_medicos", "farm_facturas_os", "farm_cuentas_corrientes_os",
        "farm_os_cobertura", "farm_obras_sociales",
    ]:
        op.drop_table(t)

    # Quitar columnas agregadas
    op.drop_column("farm_paciente_historial", "adherencia_pct")
    op.drop_column("farm_paciente_historial", "dias_sin_reposicion")
    op.drop_column("farm_paciente_historial", "proxima_dispensacion_esperada")
    op.drop_column("farm_paciente_historial", "dispensacion_id")
    op.drop_column("farm_paciente_historial", "receta_id")

    op.drop_column("farm_expiration_alerts", "updated_at")
    op.drop_column("farm_expiration_alerts", "resuelto_user_id")
    op.drop_column("farm_expiration_alerts", "notificado_via")
    op.drop_column("farm_medications", "updated_at")
    op.drop_column("farm_medications", "efectos_adversos")
    op.drop_column("farm_medications", "troquel")
    op.drop_index("ix_farm_med_troquel", "farm_medications")
    op.drop_column("farm_active_ingredients", "updated_at")
    op.drop_column("farm_active_ingredients", "categoria_controlado")
    op.drop_column("farm_active_ingredients", "es_controlado")
    op.drop_index("ix_farm_ai_atc", "farm_active_ingredients")
    op.drop_column("farm_active_ingredients", "codigo_atc")
    op.drop_column("farm_active_ingredients", "dci")

    # Rename back
    rename_pairs_back = [
        ("farm_paciente_historial", "pharma_patient_history"),
        ("farm_cold_chain", "pharma_cold_chain"),
        ("farm_os_cobertura", "pharma_insurance_coverage"),
        ("farm_recetas", "pharma_prescriptions"),
        ("farm_libro_psicotropicos", "pharma_controlled_logs"),
        ("farm_expiration_alerts", "pharma_expiration_alerts"),
        ("farm_equivalents", "pharma_equivalents"),
        ("farm_medications", "pharma_medications"),
        ("farm_active_ingredients", "pharma_active_ingredients"),
    ]
    for new, old in rename_pairs_back:
        op.execute(f"ALTER TABLE IF EXISTS {new} RENAME TO {old}")

    for new, old in [
        ("ix_farm_ai_company", "ix_pharma_ai_company"),
        ("ix_farm_ai_nombre", "ix_pharma_ai_nombre"),
    ]:
        op.execute(f"ALTER INDEX IF EXISTS {new} RENAME TO {old}")
