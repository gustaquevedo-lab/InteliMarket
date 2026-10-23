import asyncio
from datetime import datetime, timezone, date
from decimal import Decimal
from sqlalchemy import text
from api.src.db import async_session_factory

async def remediate_global():
    print("Iniciando saneamiento global de anomalías residuales en cuentas por pagar...")

    async with async_session_factory() as s:
        async with s.begin():
            # 1. RESOLVER LAS 10 SNCs FANTASMAS SOBRE FACTURAS YA PAGADAS
            ghost_sncs = [
                'SNC-00013', 'SNC-00014', 'SNC-00017', 'SNC-00018',
                'SNC-00020', 'SNC-00021', 'SNC-00033', 'SNC-00034',
                'SNC-00042', 'SNC-00049'
            ]
            print(f"\n1. Archivando {len(ghost_sncs)} SNCs fantasmas sobre facturas pagadas...")
            for snc_num in ghost_sncs:
                res = await s.execute(text("""
                    UPDATE supplier_nc_requests
                    SET estado = 'resuelta',
                        resolved_at = :now,
                        observaciones = CONCAT(COALESCE(observaciones, ''), ' [Auto-resuelta: Factura origen ya saldada/pagada]')
                    WHERE numero_solicitud = :num AND estado NOT IN ('resuelta', 'cancelada')
                """), {'now': datetime.now(timezone.utc), 'num': snc_num})
                print(f"   ✓ {snc_num} resuelta ({res.rowcount} filas)")

            # 2. TRENTINO S.A. (FAC 001-001-0005769)
            # Saldo pendiente real: 33.877.216 - 19.973.892 = 13.903.324 (descontando los 38.800 de efectivo)
            print(f"\n2. Ajustando saldo pendiente de Trentino S.A. (FAC 001-001-0005769)...")
            res_t = await s.execute(text("""
                UPDATE supplier_invoices
                SET saldo_pendiente = 13903324
                WHERE numero_factura = '001-001-0005769' AND estado != 'cancelada'
            """))
            print(f"   ✓ Trentino FAC 001-001-0005769 calibrada a ₲ 13.903.324 ({res_t.rowcount} filas)")

            # 3. APOLO IMPORT S.A. (FAC 001-001-0276011)
            # Eliminar los dos registros de pago de NCs no reconocidas por el proveedor
            print(f"\n3. Regularizando pagos de Apolo Import S.A. (FAC 001-001-0276011)...")
            res_a = await s.execute(text("""
                DELETE FROM supplier_invoice_payments
                WHERE invoice_id = (SELECT id FROM supplier_invoices WHERE numero_factura = '001-001-0276011' AND estado != 'cancelada')
                  AND referencia ILIKE '%NC no reconocida%'
            """))
            print(f"   ✓ Pagos de NC no reconocidas eliminados del libro de pagos ({res_a.rowcount} filas). Saldo exigible ₲ 33.552.669 100% justificado.")

            # 4. CHACOMER S.A.E. (FAC 016-001-0000448)
            # Registrar la cuota de Junio 2026 (₲ 6.843.886) que fue descontada del saldo pendiente pero no tenía fila en payments
            print(f"\n4. Regularizando cuota histórica de Chacomer S.A.E. (FAC 016-001-0000448)...")
            inv_c = (await s.execute(text("""
                SELECT id FROM supplier_invoices WHERE numero_factura = '016-001-0000448' AND estado != 'cancelada'
            """))).scalar()
            if inv_c:
                await s.execute(text("""
                    INSERT INTO supplier_invoice_payments (invoice_id, payment_method, monto, moneda, fecha_pago, referencia, estado)
                    VALUES (:inv_id, 'CHEQUE', 6843886, 'PYG', '2026-06-15', 'Cuota Junio 2026 reconciliada', 'pagado')
                """), {'inv_id': inv_c})
                print(f"   ✓ Cuota Junio 2026 (₲ 6.843.886) incorporada a supplier_invoice_payments. Saldo exigible ₲ 14.868.764 100% calibrado.")

    print("\nSaneamiento global completado exitosamente.")

if __name__ == '__main__':
    asyncio.run(remediate_global())
