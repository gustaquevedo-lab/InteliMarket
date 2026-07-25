"""add loyalty, bancard, dinelco, email tables

Revision ID: 20260608000000
Revises: 20260607000000
Create Date: 2026-06-08 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260608000000"
down_revision = "20260607000000"
branch_labels = None
depends_on = None


def upgrade():
    # 1. LOYALTY_CONFIG
    op.create_table(
        "loyalty_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("puntos_por_guarani", sa.Integer, nullable=False, server_default="1"),
        sa.Column("guarani_por_punto", sa.Integer, nullable=False, server_default="100"),
        sa.Column("vencimiento_dias", sa.Integer, nullable=False, server_default="365"),
        sa.Column("canje_minimo_puntos", sa.Integer, nullable=False, server_default="100"),
        sa.Column("bienvenida_puntos", sa.Integer, nullable=False, server_default="50"),
        sa.Column("cumpleanos_puntos", sa.Integer, nullable=False, server_default="200"),
        sa.Column("crear_en_venta", sa.Boolean, server_default="true"),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    # 2. LOYALTY_POINTS
    op.create_table(
        "loyalty_points",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("puntos", sa.Integer, nullable=False),
        sa.Column("referencia_tipo", sa.String(50)),
        sa.Column("referencia_id", sa.String(100)),
        sa.Column("descripcion", sa.Text),
        sa.Column("vence_en", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    # 3. LOYALTY_REWARDS
    op.create_table(
        "loyalty_rewards",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("descripcion", sa.Text),
        sa.Column("puntos_requeridos", sa.Integer, nullable=False),
        sa.Column("tipo_recompensa", sa.String(50), nullable=False),
        sa.Column("valor_recompensa", sa.Numeric(15, 0)),
        sa.Column("stock", sa.Integer),
        sa.Column("imagen_url", sa.Text),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    # 4. BANCARD_TRANSACTIONS
    op.create_table(
        "bancard_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("order_id", sa.String(100), nullable=False, index=True),
        sa.Column("amount", sa.BigInteger, nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="PYG"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("token", sa.String(200)),
        sa.Column("process_id", sa.String(100), index=True),
        sa.Column("checkout_url", sa.Text),
        sa.Column("authorization_code", sa.String(50)),
        sa.Column("card_last4", sa.String(10)),
        sa.Column("card_brand", sa.String(30)),
        sa.Column("terminal_id", sa.String(50)),
        sa.Column("payment_type", sa.String(20), nullable=False, server_default="virtual"),
        sa.Column("webhook_data", sa.Text),
        sa.Column("error_message", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    # 5. DINELCO_TRANSACTIONS
    op.create_table(
        "dinelco_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("order_id", sa.String(100), nullable=False, index=True),
        sa.Column("amount", sa.BigInteger, nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="PYG"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("payment_id", sa.String(100), index=True),
        sa.Column("checkout_url", sa.Text),
        sa.Column("customer_email", sa.String(200)),
        sa.Column("customer_name", sa.String(200)),
        sa.Column("installments", sa.Integer, server_default="1"),
        sa.Column("authorization_code", sa.String(50)),
        sa.Column("card_last4", sa.String(10)),
        sa.Column("card_brand", sa.String(30)),
        sa.Column("webhook_data", sa.Text),
        sa.Column("error_message", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    # 6. EMAIL_LOGS
    op.create_table(
        "email_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("to_email", sa.String(200), nullable=False),
        sa.Column("subject", sa.String(300), nullable=False),
        sa.Column("tipo", sa.String(50), nullable=False),
        sa.Column("referencia_id", sa.String(100)),
        sa.Column("success", sa.Boolean, nullable=False),
        sa.Column("error_message", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    tables = [
        "email_logs",
        "dinelco_transactions",
        "bancard_transactions",
        "loyalty_rewards",
        "loyalty_points",
        "loyalty_config",
    ]
    for t in tables:
        op.drop_table(t)
