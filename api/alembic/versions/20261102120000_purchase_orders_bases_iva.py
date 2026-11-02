"""bases fiscales de compras (gravada 10 / 5 / exenta) para el libro IVA de compras

NULL = comprobante sin desglose fiscal conocido (legacy antes de 2016): el libro no lo supone.

Revision ID: 20261102120000
Revises: 20261102100000
Create Date: 2026-11-02 12:00:00.000000

"""
from alembic import op

revision = "20261102120000"
down_revision = "20261102100000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE purchase_orders
            ADD COLUMN IF NOT EXISTS base_gravada_10 NUMERIC(15,0),
            ADD COLUMN IF NOT EXISTS base_gravada_5 NUMERIC(15,0),
            ADD COLUMN IF NOT EXISTS base_exenta NUMERIC(15,0)
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE purchase_orders
            DROP COLUMN IF EXISTS base_gravada_10,
            DROP COLUMN IF EXISTS base_gravada_5,
            DROP COLUMN IF EXISTS base_exenta
    """)
