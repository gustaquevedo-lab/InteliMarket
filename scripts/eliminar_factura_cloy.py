"""Script para eliminar de forma segura y auditada la factura inexistente 001-001-0028878-CLOY.
InteliMarket — Extra Supermercado

Proveedor: DISTRIBUIDORA SANTA MARIA E.A.S. (19232411-7f71-499c-9602-e087479682c6)
Factura ID: 03e3662e-65a8-4b46-adc9-b44c43d7f7a8
Número: 001-001-0028878-CLOY
Monto: 362.538 Gs.

Acciones:
1. Respaldo de seguridad en audit_deleted_supplier_invoices_20261028
2. Eliminación de supplier_invoice_items (5 ítems de jabones Cloy)
3. Eliminación de supplier_invoices (1 fila)
4. La deuda del proveedor se reduce en 362.538 Gs (de 74.828.409 Gs a 74.465.871 Gs)

Modo de uso:
    python scripts/eliminar_factura_cloy.py --dry-run
    python scripts/eliminar_factura_cloy.py --apply
"""

import sys
import asyncio
from decimal import Decimal
import argparse

from api.src.db import async_session_factory
from sqlalchemy import text

INVOICE_ID = "03e3662e-65a8-4b46-adc9-b44c43d7f7a8"
SUPPLIER_ID = "19232411-7f71-499c-9602-e087479682c6"


async def main(dry_run: bool = True):
    print("=" * 80)
    print("ELIMINACIÓN AUDITADA DE FACTURA INEXISTENTE: 001-001-0028878-CLOY")
    print(f"Modo: {'DRY-RUN (Simulación sin cambios)' if dry_run else 'APLICAR EN PRODUCCIÓN'}")
    print("=" * 80)

    async with async_session_factory() as session:
        # 1. Verificar factura
        res = await session.execute(text("""
            SELECT si.id, si.numero_factura, s.razon_social, si.total, si.saldo_pendiente, si.fecha_emision, si.estado, si.receipt_id
            FROM supplier_invoices si
            JOIN suppliers s ON s.id = si.supplier_id
            WHERE si.id = :id
        """), {"id": INVOICE_ID})
        inv = res.fetchone()

        if not inv:
            print("❌ La factura ya no existe en supplier_invoices.")
            return

        print(f"Factura encontrada:")
        print(f"  ID: {inv[0]}")
        print(f"  Número: {inv[1]}")
        print(f"  Proveedor: {inv[2]}")
        print(f"  Total: {inv[3]:,.0f} Gs.")
        print(f"  Saldo pendiente: {inv[4]:,.0f} Gs.")
        print(f"  Fecha emisión: {inv[5]}")
        print(f"  Estado: {inv[6]}")
        print(f"  Recepción ID: {inv[7]}")

        # 2. Verificar items
        res_items = await session.execute(text("""
            SELECT sii.id, sii.product_id, p.sku, sii.descripcion, sii.cantidad, sii.precio_unitario, sii.total
            FROM supplier_invoice_items sii
            LEFT JOIN products p ON p.id = sii.product_id
            WHERE sii.invoice_id = :id
        """), {"id": INVOICE_ID})
        items = res_items.fetchall()
        print(f"\nItems asociados ({len(items)}):")
        for it in items:
            print(f"  - SKU {it[2]} | Cant: {it[4]} | Unit: {it[5]:,.0f} | Total: {it[6]:,.0f} Gs.")

        # 3. Verificar pagos / NC aplicadas
        res_pay = await session.execute(text("""
            SELECT COUNT(*) FROM supplier_invoice_payments WHERE invoice_id = :id
        """), {"id": INVOICE_ID})
        pay_count = res_pay.scalar()
        if pay_count > 0:
            print(f"⚠️ ADVERTENCIA: La factura tiene {pay_count} pagos asociados.")
        else:
            print("\n✓ Sin pagos ni NCs aplicadas (saldo 100% libre).")

        # 4. Saldo actual del proveedor
        res_bal = await session.execute(text("""
            SELECT 
                SUM(CASE WHEN estado NOT IN ('anulada', 'cancelada') THEN total ELSE 0 END) as total_debitos,
                SUM(CASE WHEN estado NOT IN ('anulada', 'cancelada') THEN saldo_pendiente ELSE 0 END) as total_saldo
            FROM supplier_invoices
            WHERE supplier_id = :sup_id
        """), {"sup_id": SUPPLIER_ID})
        bal = res_bal.fetchone()
        tot_deb = Decimal(str(bal[0] or 0))
        tot_sal = Decimal(str(bal[1] or 0))
        print(f"\nDeuda actual en facturas con {inv[2]}:")
        print(f"  Total facturado: {tot_deb:,.0f} Gs.")
        print(f"  Saldo pendiente: {tot_sal:,.0f} Gs.")
        print(f"  Saldo posterior a eliminación: {tot_sal - inv[4]:,.0f} Gs. (-{inv[4]:,.0f} Gs.)")

        if dry_run:
            print("\n[INFO] Ejecución en DRY-RUN finalizada. No se modificó ningún dato.")
            print("Para aplicar la eliminación real, ejecute con: --apply")
            return

        # 5. Aplicar eliminación con tabla de respaldo
        print("\n[EJECUCIÓN] Creando tabla de respaldo si no existe...")
        await session.execute(text("""
            CREATE TABLE IF NOT EXISTS audit_deleted_supplier_invoices_20261028 (
                deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                invoice_id UUID,
                supplier_id UUID,
                numero_factura VARCHAR,
                total NUMERIC,
                saldo_pendiente NUMERIC,
                fecha_emision DATE,
                datos_completos JSONB
            );
        """))

        # Insertar respaldo
        await session.execute(text("""
            INSERT INTO audit_deleted_supplier_invoices_20261028 (
                invoice_id, supplier_id, numero_factura, total, saldo_pendiente, fecha_emision, datos_completos
            )
            SELECT 
                id, supplier_id, numero_factura, total, saldo_pendiente, fecha_emision,
                to_jsonb(si.*)
            FROM supplier_invoices si
            WHERE id = :id;
        """), {"id": INVOICE_ID})

        # Eliminar items
        del_items = await session.execute(text("""
            DELETE FROM supplier_invoice_items WHERE invoice_id = :id;
        """), {"id": INVOICE_ID})
        print(f"✓ Eliminados {del_items.rowcount} items de la factura.")

        # Eliminar factura
        del_inv = await session.execute(text("""
            DELETE FROM supplier_invoices WHERE id = :id;
        """), {"id": INVOICE_ID})
        print(f"✓ Eliminada la factura de compra (rowcount: {del_inv.rowcount}).")

        await session.commit()
        print("\n[ÉXITO] Factura 001-001-0028878-CLOY eliminada exitosamente y respaldada en auditoría.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Eliminar factura inexistente 001-001-0028878-CLOY")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--dry-run", action="store_true", help="Simular sin modificar")
    group.add_argument("--apply", action="store_true", help="Aplicar eliminación real")
    args = parser.parse_args()

    asyncio.run(main(dry_run=args.dry_run))
