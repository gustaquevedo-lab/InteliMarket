"""Add naturaleza_economica to expenses and create internal_requisitions tables

Revision ID: 20261013140000
Revises: 20261012170000
Create Date: 2026-10-13 14:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20261013140000"
down_revision = "20261012170000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Columnas en la tabla expenses ────────────────────────────────────
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    expense_cols = [c["name"] for c in inspector.get_columns("expenses")]

    if "naturaleza_economica" not in expense_cols:
        op.add_column(
            "expenses",
            sa.Column("naturaleza_economica", sa.String(40), nullable=True, server_default="OPEX_GASTO_OPERATIVO")
        )
    if "production_area" not in expense_cols:
        op.add_column(
            "expenses",
            sa.Column("production_area", sa.String(40), nullable=True)
        )
    if "periodo_devengado" not in expense_cols:
        op.add_column(
            "expenses",
            sa.Column("periodo_devengado", sa.String(10), nullable=True)
        )
    if "cuota_actual" not in expense_cols:
        op.add_column(
            "expenses",
            sa.Column("cuota_actual", sa.Integer(), nullable=True)
        )
    if "total_cuotas" not in expense_cols:
        op.add_column(
            "expenses",
            sa.Column("total_cuotas", sa.Integer(), nullable=True)
        )
    if "requisicion_id" not in expense_cols:
        op.add_column(
            "expenses",
            sa.Column("requisicion_id", postgresql.UUID(as_uuid=True), nullable=True)
        )

    # ── 2. Tabla internal_requisitions ──────────────────────────────────────
    tables = inspector.get_table_names()
    if "internal_requisitions" not in tables:
        op.create_table(
            "internal_requisitions",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("numero_requisicion", sa.String(30), nullable=False),
            sa.Column("area_destino", sa.String(40), nullable=False),
            sa.Column("solicitante_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("solicitante_nombre", sa.String(150), nullable=False),
            sa.Column("motivo", sa.Text(), nullable=True),
            sa.Column("orden_produccion_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("receta_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("estado", sa.String(30), nullable=False, server_default="PENDIENTE_APROBACION"),
            sa.Column("fecha_solicitud", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("aprobado_por", sa.String(150), nullable=True),
            sa.Column("fecha_aprobacion", sa.DateTime(timezone=True), nullable=True),
            sa.Column("sale_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("numero_factura_pos", sa.String(50), nullable=True),
            sa.Column("total_costo_estimado", sa.Numeric(14, 2), server_default="0", nullable=False),
            sa.Column("notas", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        )
        op.create_index("ix_internal_requisitions_company_estado", "internal_requisitions", ["company_id", "estado"])
        op.create_index("ix_internal_requisitions_company_numero", "internal_requisitions", ["company_id", "numero_requisicion"])

    # ── 3. Tabla internal_requisition_items ─────────────────────────────────
    if "internal_requisition_items" not in tables:
        op.create_table(
            "internal_requisition_items",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("requisition_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("internal_requisitions.id", ondelete="CASCADE"), nullable=False),
            sa.Column("producto_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("cantidad", sa.Numeric(10, 3), nullable=False),
            sa.Column("unidad_medida", sa.String(20), server_default="UN", nullable=False),
            sa.Column("costo_unitario", sa.Numeric(12, 2), server_default="0", nullable=False),
            sa.Column("precio_salon", sa.Numeric(12, 2), server_default="0", nullable=False),
            sa.Column("notas", sa.String(255), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        )
        op.create_index("ix_internal_requisition_items_requisition_id", "internal_requisition_items", ["requisition_id"])


def downgrade() -> None:
    op.drop_table("internal_requisition_items")
    op.drop_table("internal_requisitions")
    op.drop_column("expenses", "requisicion_id")
    op.drop_column("expenses", "total_cuotas")
    op.drop_column("expenses", "cuota_actual")
    op.drop_column("expenses", "periodo_devengado")
    op.drop_column("expenses", "production_area")
    op.drop_column("expenses", "naturaleza_economica")
