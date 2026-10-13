"""Script de saneamiento de facturas de proveedores:
1. Absorbe micro-diferencias de cambio (<= 5.000 Gs) en facturas amortizadas mediante Órdenes de Pago (Lotes Brasil y pagos en divisas).
   - Establece saldo_pendiente = 0 y estado = 'pagada'.
   - Ajusta saldo_restante = 0 en allocations.
   - Suma la diferencia a diferencia_cambio en la Orden de Pago.
2. Restaura el saldo real de las facturas que fueron sobreescritas por el cron legacy (OPs del 18 y 19 de septiembre).
"""

import asyncio
from decimal import Decimal
from sqlalchemy import text
from api.src.db import async_session_factory


async def reconcile():
    async with async_session_factory() as db:
        print("==> Iniciando saneamiento de saldos de proveedores...")

        # 1. Facturas con micro-remanentes <= 5.000 Gs tras OP pagada (Lotes Brasil / conversiones)
        q_micro = text("""
            SELECT si.id, si.numero_factura, si.saldo_pendiente, si.total, spo.id as op_id, spo.numero_orden,
                   spoa.id as alloc_id, spoa.monto_aplicado
            FROM supplier_invoices si
            JOIN supplier_payment_order_allocations spoa ON spoa.invoice_id = si.id
            JOIN supplier_payment_orders spo ON spo.id = spoa.payment_order_id
            WHERE spo.estado = 'pagado'
              AND si.saldo_pendiente > 0
              AND si.saldo_pendiente <= 5000
            ORDER BY si.created_at DESC
        """)
        rows_micro = (await db.execute(q_micro)).fetchall()
        print(f"==> Encontradas {len(rows_micro)} facturas con micro-saldos de diferencia de cambio.")

        for r in rows_micro:
            diff = r.saldo_pendiente
            print(f"  * Cerrando factura {r.numero_factura} (OP: {r.numero_orden}): saldo pendiente ₲ {diff:,.0f} absorbido como Dif. Cambio.")
            
            # Actualizar factura
            await db.execute(text("""
                UPDATE supplier_invoices
                SET saldo_pendiente = 0,
                    saldo_pendiente_brl = 0,
                    estado = 'pagada',
                    updated_at = now()
                WHERE id = :id
            """), {"id": r.id})

            # Actualizar allocation
            await db.execute(text("""
                UPDATE supplier_payment_order_allocations
                SET saldo_restante = 0
                WHERE id = :alloc_id
            """), {"alloc_id": r.alloc_id})

            # Imputar diferencia de cambio en la OP
            await db.execute(text("""
                UPDATE supplier_payment_orders
                SET diferencia_cambio = COALESCE(diferencia_cambio, 0) + :diff
                WHERE id = :op_id
            """), {"diff": diff, "op_id": r.op_id})

            # Registrar renglón de disbursement de diferencia_cambio
            disb_exists = await db.execute(text("""
                SELECT id FROM supplier_payment_order_disbursements
                WHERE payment_order_id = :op_id AND forma_pago = 'diferencia_cambio'
            """), {"op_id": r.op_id})
            row_disb = disb_exists.first()
            if row_disb:
                await db.execute(text("""
                    UPDATE supplier_payment_order_disbursements
                    SET monto_pyg = monto_pyg + :diff,
                        monto = monto + :diff
                    WHERE id = :did
                """), {"diff": diff, "did": row_disb.id})
            else:
                await db.execute(text("""
                    INSERT INTO supplier_payment_order_disbursements (
                        id, payment_order_id, forma_pago, monto, moneda, tipo_cambio, monto_pyg, observaciones, created_at
                    ) VALUES (
                        gen_random_uuid(), :op_id, 'diferencia_cambio', :diff, 'PYG', 1, :diff, 'Ajuste de Redondeo / Diferencia de Cambio Lote Brasil', now()
                    )
                """), {"op_id": r.op_id, "diff": diff})

        # 2. Facturas sobreescritas por el cron legacy (OP-20260918-0001, OP-20260918-0004, OP-20260919-0001)
        q_legacy = text("""
            SELECT si.id, si.numero_factura, si.total, si.saldo_pendiente,
                   SUM(spoa.monto_aplicado + spoa.monto_retencion) as total_amortizado_ops
            FROM supplier_invoices si
            JOIN supplier_payment_order_allocations spoa ON spoa.invoice_id = si.id
            JOIN supplier_payment_orders spo ON spo.id = spoa.payment_order_id
            WHERE spo.estado = 'pagado'
              AND si.numero_factura IN (
                  '18051640 - 001-006-0002165',
                  '18675141 - 001-001-0000456',
                  '16871740 - 001-001-0196093',
                  '16871723 - 001-001-0193987'
              )
            GROUP BY si.id, si.numero_factura, si.total, si.saldo_pendiente
        """)
        rows_legacy = (await db.execute(q_legacy)).fetchall()
        print(f"==> Verificando {len(rows_legacy)} facturas del 18-19 sep afectadas por cron legacy...")

        for r in rows_legacy:
            saldo_correcto = max(Decimal("0"), r.total - r.total_amortizado_ops)
            estado_correcto = "pagada" if saldo_correcto <= Decimal("0") else "parcial"
            print(f"  * Factura {r.numero_factura}: Total ₲ {r.total:,.0f}, Amortizado OPs ₲ {r.total_amortizado_ops:,.0f} -> Nuevo Saldo: ₲ {saldo_correcto:,.0f} ({estado_correcto})")
            await db.execute(text("""
                UPDATE supplier_invoices
                SET saldo_pendiente = :saldo,
                    estado = :estado,
                    updated_at = now()
                WHERE id = :id
            """), {"saldo": saldo_correcto, "estado": estado_correcto, "id": r.id})

        await db.commit()
        print("✓ Saneamiento completado exitosamente.")


if __name__ == "__main__":
    asyncio.run(reconcile())
