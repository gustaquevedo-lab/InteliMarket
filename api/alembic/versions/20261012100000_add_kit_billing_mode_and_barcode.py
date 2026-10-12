"""add_kit_billing_mode_and_barcode

Revision ID: 20261012100000
Revises: 20261011153000
Create Date: 2026-10-12 10:00:00.000000

Agrega a la tabla product_kits:
1. modalidad_facturacion: 'item_unico' (factura 1 sola linea con IVA 10%) o 'desglosado' (desglosa componentes con IVA individual).
2. codigo_barra: codigo de barra propio del combo para escaneo en caja (POS).
3. sku: SKU identificador del kit.
"""
from typing import Sequence, Union
from alembic import op


revision: str = '20261012100000'
down_revision: Union[str, None] = '20261011153000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE product_kits
        ADD COLUMN IF NOT EXISTS modalidad_facturacion VARCHAR(30) NOT NULL DEFAULT 'item_unico',
        ADD COLUMN IF NOT EXISTS codigo_barra VARCHAR(50),
        ADD COLUMN IF NOT EXISTS sku VARCHAR(50);
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_product_kits_codigo_barra ON product_kits(codigo_barra);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_product_kits_sku ON product_kits(sku);")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_product_kits_sku;")
    op.execute("DROP INDEX IF EXISTS ix_product_kits_codigo_barra;")
    op.execute("""
        ALTER TABLE product_kits
        DROP COLUMN IF EXISTS sku,
        DROP COLUMN IF EXISTS codigo_barra,
        DROP COLUMN IF EXISTS modalidad_facturacion;
    """)
