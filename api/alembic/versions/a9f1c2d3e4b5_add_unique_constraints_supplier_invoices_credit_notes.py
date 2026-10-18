"""add_unique_constraints_supplier_invoices_credit_notes

Revision ID: a9f1c2d3e4b5
Revises: fbd661dae429
Create Date: 2026-10-18 18:30:00.000000

Contexto:
- Se detectaron 287 facturas y 37 NC duplicadas en producción originadas
  por re-ejecuciones del sync de Nemuha sin control de unicidad en BD.
- Se agrega un UNIQUE INDEX parcial en supplier_invoices y supplier_credit_notes
  sobre (company_id, supplier_id, numero_factura/numero, timbrado) solo cuando
  timbrado no es nulo/vacío.
- El índice es parcial para permitir registros manuales sin timbrado (ej. 
  facturas de proveedores informales) sin bloquearse entre sí.
- La limpieza de duplicados existentes se realiza vía script dedup_and_constrain.sql
  ANTES de aplicar esta migración.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a9f1c2d3e4b5'
down_revision: Union[str, None] = 'fbd661dae429'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Unique parcial en supplier_invoices: solo cuando timbrado no es nulo/vacío
    # Esto previene doble ingreso de la misma factura fiscal (mismo comprobante + timbrado)
    # sin interferir con registros manuales sin timbrado.
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_invoices_numero_timbrado
            ON supplier_invoices (company_id, supplier_id, numero_factura, timbrado)
            WHERE timbrado IS NOT NULL AND timbrado != ''
    """)

    # Unique parcial en supplier_credit_notes: solo NC activas con timbrado
    # Previene duplicación de NC de proveedor con mismo número y timbrado.
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_credit_notes_numero_timbrado
            ON supplier_credit_notes (company_id, supplier_id, numero, timbrado)
            WHERE timbrado IS NOT NULL AND timbrado != '' AND cancelado = false
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_supplier_invoices_numero_timbrado")
    op.execute("DROP INDEX IF EXISTS uq_supplier_credit_notes_numero_timbrado")
