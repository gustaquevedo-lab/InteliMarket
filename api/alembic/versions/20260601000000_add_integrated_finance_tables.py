"""Add Integrated Financial Management tables (withholding, accounting close, scoring, collection, account plan)

Revision ID: 20260601000000
Revises: 20260531230000
Create Date: 2026-06-01 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "20260601000000"
down_revision: Union[str, None] = "20260531230000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Withholding Config
    op.create_table(
        "withholding_configs",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("supplier_id", UUID(as_uuid=True), nullable=False),
        sa.Column("tipo", sa.String(10), nullable=False),
        sa.Column("activo", sa.Boolean(), server_default="true"),
        sa.Column("categoria", sa.String(30)),
        sa.Column("tasa", sa.Numeric(5, 2), nullable=False),
        sa.Column("base_minima", sa.Numeric(15, 0), server_default="0"),
        sa.Column("exento_hasta", sa.Numeric(15, 0), server_default="0"),
        sa.Column("regimen", sa.String(50)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("company_id", "supplier_id", "tipo", name="uq_withholding_supplier_tipo"),
    )

    # Withholding Documents
    op.create_table(
        "withholding_documents",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("supplier_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("invoice_id", UUID(as_uuid=True), nullable=False),
        sa.Column("tipo", sa.String(10), nullable=False),
        sa.Column("numero_documento", sa.String(30)),
        sa.Column("cdc", sa.String(64)),
        sa.Column("fecha_emision", sa.Date(), nullable=False, server_default=sa.func.current_date()),
        sa.Column("periodo_fiscal", sa.String(7), nullable=False),
        sa.Column("base_imponible", sa.Numeric(15, 0), nullable=False),
        sa.Column("tasa", sa.Numeric(5, 2), nullable=False),
        sa.Column("monto_retenido", sa.Numeric(15, 0), nullable=False),
        sa.Column("moneda", sa.String(3), server_default="PYG"),
        sa.Column("estado", sa.String(20), server_default="pendiente"),
        sa.Column("xml_enviado", sa.Text()),
        sa.Column("xml_respuesta", sa.Text()),
        sa.Column("fecha_envio_sifen", sa.DateTime(timezone=True)),
        sa.Column("fecha_respuesta_sifen", sa.DateTime(timezone=True)),
        sa.Column("notas", sa.Text()),
        sa.Column("created_by", UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("company_id", "numero_documento", name="uq_withholding_doc_numero"),
    )

    # Account Plan (Chart of Accounts)
    op.create_table(
        "account_plans",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("codigo", sa.String(20), nullable=False),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("nivel", sa.Integer(), server_default="1"),
        sa.Column("padre_id", UUID(as_uuid=True), sa.ForeignKey("account_plans.id")),
        sa.Column("acepta_asientos", sa.Boolean(), server_default="true"),
        sa.Column("activo", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("company_id", "codigo", name="uq_account_plan_codigo"),
    )

    # Accounting Periods
    op.create_table(
        "accounting_periods",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("anio", sa.Integer(), nullable=False),
        sa.Column("mes", sa.Integer(), nullable=False),
        sa.Column("fecha_inicio", sa.Date(), nullable=False),
        sa.Column("fecha_fin", sa.Date(), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False, server_default="abierto"),
        sa.Column("fecha_apertura", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("fecha_cierre", sa.DateTime(timezone=True)),
        sa.Column("cerrado_por", UUID(as_uuid=True)),
        sa.Column("observaciones", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("company_id", "anio", "mes", name="uq_accounting_period"),
    )

    # Accounting Entries
    op.create_table(
        "accounting_entries",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("period_id", UUID(as_uuid=True), sa.ForeignKey("accounting_periods.id"), nullable=False),
        sa.Column("account_id", UUID(as_uuid=True), sa.ForeignKey("account_plans.id"), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False, server_default=sa.func.current_date()),
        sa.Column("tipo", sa.String(10), nullable=False),
        sa.Column("monto", sa.Numeric(15, 0), nullable=False),
        sa.Column("concepto", sa.String(300)),
        sa.Column("referencia_tipo", sa.String(30)),
        sa.Column("referencia_id", UUID(as_uuid=True)),
        sa.Column("asiento_numero", sa.String(20)),
        sa.Column("created_by", UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Collection Actions
    op.create_table(
        "collection_actions",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("receivable_id", UUID(as_uuid=True)),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False, server_default=sa.func.current_date()),
        sa.Column("resultado", sa.String(30)),
        sa.Column("notas", sa.Text()),
        sa.Column("contacto", sa.String(100)),
        sa.Column("proximo_contacto", sa.Date()),
        sa.Column("compromiso_pago", sa.Date()),
        sa.Column("monto_comprometido", sa.Numeric(15, 0)),
        sa.Column("created_by", UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Customer Scores
    op.create_table(
        "customer_scores",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False),
        sa.Column("score", sa.Integer(), server_default="100"),
        sa.Column("pago_puntual", sa.Numeric(5, 2), server_default="100"),
        sa.Column("dias_mora_promedio", sa.Numeric(6, 1), server_default="0"),
        sa.Column("antiguedad_dias", sa.Integer(), server_default="0"),
        sa.Column("total_compras", sa.Numeric(15, 0), server_default="0"),
        sa.Column("total_pagos", sa.Numeric(15, 0), server_default="0"),
        sa.Column("veces_mora", sa.Integer(), server_default="0"),
        sa.Column("ultima_actualizacion", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("company_id", "customer_id", name="uq_customer_score_company"),
    )


def downgrade() -> None:
    op.drop_table("customer_scores")
    op.drop_table("collection_actions")
    op.drop_table("accounting_entries")
    op.drop_table("accounting_periods")
    op.drop_table("account_plans")
    op.drop_table("withholding_documents")
    op.drop_table("withholding_configs")
