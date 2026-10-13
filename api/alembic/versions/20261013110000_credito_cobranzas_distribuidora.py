"""Crédito y Cobranzas distribuidora — pagares, delivery_notes, AR extensions

Revision ID: 20261013110000
Revises: 20261012100000
Create Date: 2026-10-13 11:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20261013110000"
down_revision = "20261012100000"
branch_labels = None
depends_on = None


def upgrade():
    # ── pagares ──────────────────────────────────────────────────────────────
    op.create_table(
        "pagares",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("receivable_account_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("numero_pagare", sa.String(30), nullable=False),
        sa.Column("monto_original", sa.Numeric(15, 0), nullable=False),
        sa.Column("saldo_pendiente", sa.Numeric(15, 0), nullable=False),
        sa.Column("fecha_emision", sa.Date(), nullable=False),
        sa.Column("fecha_vencimiento", sa.Date(), nullable=False),
        sa.Column("motivo", sa.Text(), nullable=True),
        sa.Column("estado", sa.String(20), nullable=False, server_default="vigente"),
        sa.Column("cobrador_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_pagares_company", "pagares", ["company_id"])
    op.create_index("ix_pagares_customer", "pagares", ["customer_id"])

    # ── pagare_payments ───────────────────────────────────────────────────────
    op.create_table(
        "pagare_payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("pagare_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("pagares.id"), nullable=False),
        sa.Column("receivable_payment_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("monto_aplicado", sa.Numeric(15, 0), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("observaciones", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_pagare_payments_pagare", "pagare_payments", ["pagare_id"])

    # ── delivery_notes ────────────────────────────────────────────────────────
    op.create_table(
        "delivery_notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sale_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("numero_nota", sa.String(30), nullable=False),
        sa.Column("numero_factura_ref", sa.String(30), nullable=True),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("monto", sa.Numeric(15, 0), nullable=False),
        sa.Column("concepto", sa.String(50), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("vendedor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("cobrador_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("estado", sa.String(20), nullable=False, server_default="pendiente"),
        sa.Column("aplicada_en_cobro_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_delivery_notes_company", "delivery_notes", ["company_id"])
    op.create_index("ix_delivery_notes_customer", "delivery_notes", ["customer_id"])

    # ── accounts_receivable extensions ────────────────────────────────────────
    op.add_column("accounts_receivable", sa.Column("cobrador_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("accounts_receivable", sa.Column("route_id", postgresql.UUID(as_uuid=True), nullable=True))

    # ── receivable_payments extensions ───────────────────────────────────────
    op.add_column("receivable_payments", sa.Column("cobrador_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("receivable_payments", sa.Column("delivery_note_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("receivable_payments", sa.Column("delivery_note_monto", sa.Numeric(15, 0), nullable=True))


def downgrade():
    op.drop_column("receivable_payments", "delivery_note_monto")
    op.drop_column("receivable_payments", "delivery_note_id")
    op.drop_column("receivable_payments", "cobrador_id")
    op.drop_column("accounts_receivable", "route_id")
    op.drop_column("accounts_receivable", "cobrador_id")
    op.drop_index("ix_delivery_notes_customer", table_name="delivery_notes")
    op.drop_index("ix_delivery_notes_company", table_name="delivery_notes")
    op.drop_table("delivery_notes")
    op.drop_index("ix_pagare_payments_pagare", table_name="pagare_payments")
    op.drop_table("pagare_payments")
    op.drop_index("ix_pagares_customer", table_name="pagares")
    op.drop_index("ix_pagares_company", table_name="pagares")
    op.drop_table("pagares")
