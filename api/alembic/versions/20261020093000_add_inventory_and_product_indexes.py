"""add inventory and product performance indexes

Revision ID: 20261020093000
Revises: 20261019180000
Create Date: 2026-10-20 09:30:00.000000

Indices criticos para acelerar el catalogo de productos y el modulo de inventario:
- inventory_movements (~920.000 filas): company_id + created_at, product_id, warehouse_id, tipo
- inventory_adjustment_items: adjustment_id, product_id
- stock_transfers y stock_transfer_items: company_id, transfer_id, product_id
- warehouses y product_categories: company_id
- purchase_orders y purchase_receipt_items: company_id, receipt_id
"""
from typing import Sequence, Union
from alembic import op

revision: str = '20261020093000'
down_revision: Union[str, None] = '20261019180000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Movimientos de inventario (tabla masiva: ~920k filas, antes sin ningun indice secundario)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_inventory_movements_comp_created
        ON inventory_movements (company_id, created_at DESC);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_inventory_movements_comp_prod_created
        ON inventory_movements (company_id, product_id, created_at DESC);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_inventory_movements_comp_tipo_created
        ON inventory_movements (company_id, tipo, created_at DESC);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_inventory_movements_prod_created
        ON inventory_movements (product_id, created_at DESC);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_inventory_movements_wh_created
        ON inventory_movements (warehouse_id, created_at DESC);
    """)

    # 2. Ajustes y detalles de ajuste
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_inventory_adjustment_items_adj_id
        ON inventory_adjustment_items (adjustment_id);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_inventory_adjustment_items_prod_id
        ON inventory_adjustment_items (product_id);
    """)

    # 3. Transferencias de stock y detalles
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_stock_transfers_comp_created
        ON stock_transfers (company_id, created_at DESC);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_stock_transfers_warehouses
        ON stock_transfers (warehouse_origen_id, warehouse_destino_id);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_stock_transfer_items_transfer_id
        ON stock_transfer_items (transfer_id);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_stock_transfer_items_product_id
        ON stock_transfer_items (product_id);
    """)

    # 4. Depositos y Categorias de productos
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_warehouses_company_id
        ON warehouses (company_id);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_product_categories_company_id
        ON product_categories (company_id);
    """)

    # 5. Compras y recepciones vinculadas a productos
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_purchase_orders_company_id
        ON purchase_orders (company_id);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_purchase_receipt_items_receipt_id
        ON purchase_receipt_items (receipt_id);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_inventory_movements_comp_created;")
    op.execute("DROP INDEX IF EXISTS ix_inventory_movements_comp_prod_created;")
    op.execute("DROP INDEX IF EXISTS ix_inventory_movements_comp_tipo_created;")
    op.execute("DROP INDEX IF EXISTS ix_inventory_movements_prod_created;")
    op.execute("DROP INDEX IF EXISTS ix_inventory_movements_wh_created;")
    op.execute("DROP INDEX IF EXISTS ix_inventory_adjustment_items_adj_id;")
    op.execute("DROP INDEX IF EXISTS ix_inventory_adjustment_items_prod_id;")
    op.execute("DROP INDEX IF EXISTS ix_stock_transfers_comp_created;")
    op.execute("DROP INDEX IF EXISTS ix_stock_transfers_warehouses;")
    op.execute("DROP INDEX IF EXISTS ix_stock_transfer_items_transfer_id;")
    op.execute("DROP INDEX IF EXISTS ix_stock_transfer_items_product_id;")
    op.execute("DROP INDEX IF EXISTS ix_warehouses_company_id;")
    op.execute("DROP INDEX IF EXISTS ix_product_categories_company_id;")
    op.execute("DROP INDEX IF EXISTS ix_purchase_orders_company_id;")
    op.execute("DROP INDEX IF EXISTS ix_purchase_receipt_items_receipt_id;")
