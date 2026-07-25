"""add financial module tables (AP, banking, cash flow, budgets, payment runs)

Revision ID: 20260525040000
Revises: 20260525030000
Create Date: 2026-05-25 04:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260525040000"
down_revision: Union[str, None] = "20260525030000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "supplier_invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("numero_factura", sa.String(50), nullable=False),
        sa.Column("timbrado", sa.String(20)),
        sa.Column("cdc", sa.String(64)),
        sa.Column("fecha_emision", sa.Date(), nullable=False),
        sa.Column("fecha_recepcion", sa.Date(), server_default=sa.func.current_date()),
        sa.Column("fecha_vencimiento", sa.Date(), nullable=False),
        sa.Column("subtotal", sa.Numeric(15, 0), server_default="0"),
        sa.Column("descuento", sa.Numeric(15, 0), server_default="0"),
        sa.Column("iva_10", sa.Numeric(15, 0), server_default="0"),
        sa.Column("iva_5", sa.Numeric(15, 0), server_default="0"),
        sa.Column("total", sa.Numeric(15, 0), nullable=False),
        sa.Column("saldo_pendiente", sa.Numeric(15, 0), nullable=False),
        sa.Column("moneda", sa.String(3), server_default="PYG"),
        sa.Column("tipo_cambio", sa.Numeric(10, 2), server_default="1"),
        sa.Column("purchase_order_id", postgresql.UUID(as_uuid=True)),
        sa.Column("receipt_id", postgresql.UUID(as_uuid=True)),
        sa.Column("condicion", sa.String(20), server_default="credito"),
        sa.Column("tipo_comprobante", sa.String(20), server_default="factura"),
        sa.Column("estado", sa.String(20), nullable=False, server_default="pendiente"),
        sa.Column("concepto", sa.String(300)),
        sa.Column("notas", sa.Text()),
        sa.Column("created_by", postgresql.UUID(as_uuid=True)),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "supplier_invoice_payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("supplier_invoices.id"), nullable=False, index=True),
        sa.Column("payment_method", sa.String(30), nullable=False),
        sa.Column("monto", sa.Numeric(15, 0), nullable=False),
        sa.Column("moneda", sa.String(3), server_default="PYG"),
        sa.Column("fecha_pago", sa.Date(), nullable=False, server_default=sa.func.current_date()),
        sa.Column("referencia", sa.String(100)),
        sa.Column("comprobante_url", sa.String(500)),
        sa.Column("bank_account_id", postgresql.UUID(as_uuid=True)),
        sa.Column("estado", sa.String(20), server_default="pendiente"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "bank_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("banco", sa.String(100), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("numero_cuenta", sa.String(50), nullable=False),
        sa.Column("moneda", sa.String(3), server_default="PYG"),
        sa.Column("saldo_inicial", sa.Numeric(15, 2), server_default="0"),
        sa.Column("saldo_actual", sa.Numeric(15, 2), server_default="0"),
        sa.Column("titular", sa.String(200)),
        sa.Column("activo", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "bank_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("bank_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bank_accounts.id"), nullable=False, index=True),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("tipo", sa.String(10), nullable=False),
        sa.Column("monto", sa.Numeric(15, 2), nullable=False),
        sa.Column("moneda", sa.String(3), server_default="PYG"),
        sa.Column("descripcion", sa.String(300)),
        sa.Column("referencia", sa.String(100)),
        sa.Column("contraparte", sa.String(200)),
        sa.Column("conciliado", sa.Boolean(), server_default="false"),
        sa.Column("fecha_conciliacion", sa.DateTime(timezone=True)),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True)),
        sa.Column("categoria", sa.String(30), server_default="otros"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "cash_flow_projections",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("saldo_inicial", sa.Numeric(15, 2), server_default="0"),
        sa.Column("ingresos_estimados", sa.Numeric(15, 2), server_default="0"),
        sa.Column("egresos_estimados", sa.Numeric(15, 2), server_default="0"),
        sa.Column("saldo_final_proyectado", sa.Numeric(15, 2), server_default="0"),
        sa.Column("ingresos_reales", sa.Numeric(15, 2)),
        sa.Column("egresos_reales", sa.Numeric(15, 2)),
        sa.Column("saldo_final_real", sa.Numeric(15, 2)),
        sa.Column("fuente", sa.String(20), server_default="automatico"),
        sa.Column("notas", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_unique_constraint("uq_cashflow_company_date", "cash_flow_projections", ["company_id", "fecha"])
    op.create_table(
        "budgets",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("periodo", sa.String(7), nullable=False),
        sa.Column("categoria", sa.String(100)),
        sa.Column("monto_presupuestado", sa.Numeric(15, 2), nullable=False),
        sa.Column("monto_ejecutado", sa.Numeric(15, 2), server_default="0"),
        sa.Column("monto_disponible", sa.Numeric(15, 2)),
        sa.Column("area", sa.String(50), server_default="general"),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "payment_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("fecha_programada", sa.Date(), nullable=False),
        sa.Column("total_monto", sa.Numeric(15, 2), server_default="0"),
        sa.Column("estado", sa.String(20), nullable=False, server_default="borrador"),
        sa.Column("metodo_pago", sa.String(30)),
        sa.Column("bank_account_id", postgresql.UUID(as_uuid=True)),
        sa.Column("created_by", postgresql.UUID(as_uuid=True)),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "payment_run_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("payment_run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("payment_runs.id"), nullable=False, index=True),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("supplier_invoices.id"), nullable=False),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("monto_programado", sa.Numeric(15, 2), nullable=False),
        sa.Column("monto_pagado", sa.Numeric(15, 2)),
        sa.Column("estado", sa.String(20), server_default="pendiente"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_constraint("uq_cashflow_company_date", "cash_flow_projections", type_="unique")
    op.drop_table("payment_run_items")
    op.drop_table("payment_runs")
    op.drop_table("budgets")
    op.drop_table("cash_flow_projections")
    op.drop_table("bank_transactions")
    op.drop_table("bank_accounts")
    op.drop_table("supplier_invoice_payments")
    op.drop_table("supplier_invoices")
