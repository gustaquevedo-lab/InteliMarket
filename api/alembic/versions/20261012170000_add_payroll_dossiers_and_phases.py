"""Add payroll_dossiers and payroll_dossier_phases tables

Revision ID: 20261012110000
Revises: xxxx_add_crm
Create Date: 2026-10-12 11:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20261012170000"
down_revision = "20261012160000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── payroll_dossiers ────────────────────────────────────────────────────
    op.create_table(
        "payroll_dossiers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("periodo", sa.String(7), nullable=False),
        sa.Column("sueldok_run_id", sa.String(200), nullable=True),
        sa.Column("masa_salarial_bruta", sa.Numeric(18, 0), nullable=False, server_default="0"),
        sa.Column("total_neto", sa.Numeric(18, 0), nullable=False, server_default="0"),
        sa.Column("total_ips_obrero", sa.Numeric(18, 0), nullable=False, server_default="0"),
        sa.Column("total_ips_patronal", sa.Numeric(18, 0), nullable=False, server_default="0"),
        sa.Column("total_anticipos", sa.Numeric(18, 0), nullable=False, server_default="0"),
        sa.Column("total_extra_club", sa.Numeric(18, 0), nullable=False, server_default="0"),
        sa.Column("total_uniformes", sa.Numeric(18, 0), nullable=False, server_default="0"),
        sa.Column("total_convenios_terceros", sa.Numeric(18, 0), nullable=False, server_default="0"),
        sa.Column("total_judiciales", sa.Numeric(18, 0), nullable=False, server_default="0"),
        sa.Column("estado", sa.String(30), nullable=False, server_default="borrador"),
        sa.Column("observaciones", sa.Text, nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_payroll_dossiers_company_periodo",
                    "payroll_dossiers", ["company_id", "periodo"])
    op.create_index("ix_payroll_dossiers_estado",
                    "payroll_dossiers", ["company_id", "estado"])

    # ── payroll_dossier_phases ───────────────────────────────────────────────
    op.create_table(
        "payroll_dossier_phases",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("dossier_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("phase_type", sa.String(100), nullable=False),
        sa.Column("phase_label", sa.String(200), nullable=True),
        sa.Column("monto", sa.Numeric(18, 0), nullable=False, server_default="0"),
        sa.Column("estado", sa.String(30), nullable=False, server_default="pendiente"),
        sa.Column("payment_order_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("collection_receipt_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("metadata", postgresql.JSONB, nullable=True),
        sa.Column("fecha_vencimiento", sa.Date, nullable=True),
        sa.Column("pdf_storage_key", sa.String(500), nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("executed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["dossier_id"], ["payroll_dossiers.id"],
                                ondelete="CASCADE"),
    )
    op.create_index("ix_payroll_dossier_phases_dossier",
                    "payroll_dossier_phases", ["dossier_id"])
    op.create_index("ix_payroll_dossier_phases_estado",
                    "payroll_dossier_phases", ["dossier_id", "estado"])
    op.create_index("ix_payroll_dossier_phases_payment_order",
                    "payroll_dossier_phases", ["payment_order_id"])


def downgrade() -> None:
    op.drop_table("payroll_dossier_phases")
    op.drop_table("payroll_dossiers")
