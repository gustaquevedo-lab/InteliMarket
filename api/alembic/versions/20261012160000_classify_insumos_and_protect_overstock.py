"""classify_insumos_and_protect_overstock

Revision ID: 20261012160000
Revises: 20261012150000
Create Date: 2026-10-12 16:00:00.000000

Clasifica formalmente en el catalogo de productos todos los insumos de produccion interna
(panaderia, carniceria, bolsas internas de empaque) con tipo_producto = 'insumo' y tipo = 'insumo',
asegurando que los motores de Finanzas (CFO) y Marketing (CMO) nunca los sugieran para liquidacion comercial en POS.
"""
from typing import Sequence, Union
from alembic import op


revision: str = '20261012160000'
down_revision: Union[str, None] = '20261012150000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Clasificar insumos de produccion y empaque en public y sandbox
    op.execute("""
        UPDATE products
        SET tipo_producto = 'insumo',
            tipo = 'insumo'
        WHERE (
            nombre ILIKE '%INSUMO%'
            OR nombre ILIKE '%P/INSUMO%'
            OR nombre ILIKE '%(INSUMO)%'
            OR nombre ILIKE '%BOLSA%INTERNA%'
            OR nombre ILIKE '%USO INTERNO%'
        )
        AND (tipo_producto != 'insumo' OR tipo != 'insumo');
    """)

    # 2. Corregir cualquier texto historico en inter_agent_directives que citara Harina Maestra
    op.execute("""
        UPDATE inter_agent_directives
        SET mensaje = REPLACE(mensaje, 'Harina Maestra, ', '')
        WHERE mensaje ILIKE '%Harina Maestra%';
    """)


def downgrade() -> None:
    pass
