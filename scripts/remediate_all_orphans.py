import asyncio
import asyncpg
import uuid
from decimal import Decimal, ROUND_HALF_UP
from datetime import timedelta

async def main():
    db_url = ''
    with open('/home/intellihouse/intelimarket/.env') as f:
        for line in f:
            if line.startswith('DATABASE_URL='):
                db_url = line.strip().split('=', 1)[1].strip("'\"")
                break

    clean_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')
    conn = await asyncpg.connect(clean_url)

    orphan_recs = await conn.fetch("""
        SELECT pr.id, pr.numero, pr.fecha, pr.total, pr.proveedor_ref, pr.supplier_id,
               pr.company_id, pr.user_id, pr.observaciones, pr.purchase_order_id,
               s.razon_social, s.plazo_pago_dias
        FROM purchase_receipts pr
        JOIN suppliers s ON s.id = pr.supplier_id
        LEFT JOIN supplier_invoices si ON si.receipt_id = pr.id
        WHERE si.id IS NULL
          AND pr.estado = 'completado'
          AND pr.fecha >= '2026-10-01'
        ORDER BY s.razon_social, pr.fecha ASC
    """)

    print(f"Orphan receipts to remediate: {len(orphan_recs)}")

    async with conn.transaction():
        for rec in orphan_recs:
            rid = rec['id']
            # double check if an invoice with receipt_id exists
            ex = await conn.fetchrow("SELECT id FROM supplier_invoices WHERE receipt_id = $1", rid)
            if ex:
                continue

            inv_id = uuid.uuid4()
            numero_factura = f"AUTO-{rec['numero']}"
            fecha_emision = rec['fecha'].date()
            plazo = rec['plazo_pago_dias'] or 30
            fecha_vencimiento = fecha_emision + timedelta(days=plazo)
            total = Decimal(str(rec['total']))
            iva_10 = (total / Decimal("11")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            subtotal = total - iva_10

            obs_txt = rec['observaciones'] or ''
            ref_txt = rec['proveedor_ref'] or ''
            concepto = f"Recepción de mercadería {rec['numero']} - Ref: {numero_factura}"
            if ref_txt:
                concepto += f" [Muelle: {ref_txt}]"
            if obs_txt:
                concepto += f" - Obs: {obs_txt}"

            await conn.execute("""
                INSERT INTO supplier_invoices (
                    id, company_id, supplier_id, numero_factura, timbrado, cdc,
                    fecha_emision, fecha_recepcion, fecha_vencimiento,
                    subtotal, descuento, iva_10, iva_5, total, saldo_pendiente,
                    moneda, tipo_cambio, purchase_order_id, receipt_id,
                    condicion, tipo_comprobante, estado, concepto, notas,
                    created_by, approved_by, created_at, updated_at,
                    bloqueada_para_pago, motivo_bloqueo, monto_retenido_nc, requiere_nc
                ) VALUES (
                    $1, $2, $3, $4, NULL, NULL,
                    $5, $5, $6,
                    $7, 0, $8, 0, $9, $9,
                    'PYG', 1.0, $10, $11,
                    'credito', 'factura', 'aprobada', $12, NULL,
                    $13, NULL, $14, $14,
                    FALSE, NULL, 0, FALSE
                )
            """, inv_id, rec['company_id'], rec['supplier_id'], numero_factura,
                 fecha_emision, fecha_vencimiento, subtotal, iva_10, total,
                 rec['purchase_order_id'], rec['id'], concepto, rec['user_id'], rec['fecha'])

            # Add invoice items
            items = await conn.fetch("""
                SELECT pri.*, p.nombre
                FROM purchase_receipt_items pri
                LEFT JOIN products p ON p.id = pri.product_id
                WHERE pri.receipt_id = $1
            """, rid)

            for itm in items:
                cant = Decimal(str(itm['cantidad_recibida'] or 0)) + Decimal(str(itm['cantidad_rechazada'] or 0))
                costo = Decimal(str(itm['costo_unitario'] or 0))
                item_tot = (cant * costo).quantize(Decimal("1"))
                desc = itm['nombre'] or f"Producto {str(itm['product_id'])[:8]}"

                await conn.execute("""
                    INSERT INTO supplier_invoice_items (
                        id, invoice_id, product_id, cantidad, precio_unitario,
                        descuento, iva_tasa, total, descripcion
                    ) VALUES (
                        $1, $2, $3, $4, $5,
                        0, 10, $6, $7
                    )
                """, uuid.uuid4(), inv_id, itm['product_id'], cant, costo, item_tot, desc)

            print(f"Created {numero_factura} ({rec['razon_social']}) Total: {total:,.0f} Gs.")

    # Verification
    rem = await conn.fetchval("""
        SELECT COUNT(*)
        FROM purchase_receipts pr
        LEFT JOIN supplier_invoices si ON si.receipt_id = pr.id
        WHERE si.id IS NULL
          AND pr.estado = 'completado'
          AND pr.fecha >= '2026-10-01'
    """)
    print(f"\nRemaining orphan receipts in October: {rem}")

    await conn.close()

asyncio.run(main())
