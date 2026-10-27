import asyncio
from decimal import Decimal
from sqlalchemy import text
from api.src.db import engine

GONZALITO_ID = 'a2f37cf3-caa5-42b5-84cd-270a549d5a73'

async def main():
    async with engine.connect() as conn:
        print("=== FACTURAS PENDIENTES DE PAGO (CON SALDO > 0) ===")
        invoices = (await conn.execute(text("""
            SELECT id, numero_factura, fecha_emision, fecha_vencimiento,
                   total, saldo_pendiente, estado
            FROM supplier_invoices
            WHERE supplier_id = :sid AND estado != 'cancelada' AND saldo_pendiente > 0
            ORDER BY fecha_emision ASC, numero_factura ASC
        """), {"sid": GONZALITO_ID})).mappings().all()

        total_facial = Decimal(0)
        total_saldo = Decimal(0)
        for inv in invoices:
            total_facial += inv['total']
            total_saldo += inv['saldo_pendiente']
            # Get NCs applied
            apps = (await conn.execute(text("""
                SELECT nc.numero as nc_num, a.monto_aplicado
                FROM supplier_credit_note_applications a
                JOIN supplier_credit_notes nc ON a.credit_note_id = nc.id
                WHERE a.invoice_id = :inv_id
            """), {"inv_id": inv['id']})).mappings().all()
            nc_desc = ", ".join([f"NC {a['nc_num']}: -{a['monto_aplicado']:,.0f}" for a in apps]) if apps else "Sin NC"

            # Get payments applied
            pmts = (await conn.execute(text("""
                SELECT monto, payment_method, referencia
                FROM supplier_invoice_payments
                WHERE invoice_id = :inv_id AND estado != 'anulado'
            """), {"inv_id": inv['id']})).mappings().all()
            pmt_desc = ", ".join([f"Pago: -{p['monto']:,.0f} ({p['payment_method']})" for p in pmts]) if pmts else "Sin pagos"

            print(f"FAC {inv['numero_factura']} ({inv['fecha_emision']}) | Total Facial: {inv['total']:>12,.0f} Gs. | Saldo Pend: {inv['saldo_pendiente']:>12,.0f} Gs.")
            if apps:
                print(f"    └─ NCs Aplicadas: {nc_desc}")
            if pmts:
                print(f"    └─ Pagos Registrados: {pmt_desc}")

        print("-" * 75)
        print(f"TOTAL FACTURAS CON SALDO: {len(invoices)}")
        print(f"TOTAL VALOR FACIAL:       {total_facial:>15,.0f} Gs.")
        print(f"TOTAL SALDO PENDIENTE:    {total_saldo:>15,.0f} Gs.")
        print("=" * 75)

        # Check all SIFEN NCs
        print("\n=== TODAS LAS NOTAS DE CRÉDITO SIFEN ===")
        ncs = (await conn.execute(text("""
            SELECT nc.id, nc.numero, nc.timbrado, nc.fecha, nc.monto, nc.saldo_disponible, nc.cancelado,
                   nc.numero_factura_origen, nc.motivo
            FROM supplier_credit_notes nc
            WHERE nc.supplier_id = :sid
            ORDER BY nc.fecha ASC, nc.numero ASC
        """), {"sid": GONZALITO_ID})).mappings().all()

        for nc in ncs:
            apps = (await conn.execute(text("""
                SELECT i.numero_factura, a.monto_aplicado, a.observaciones
                FROM supplier_credit_note_applications a
                JOIN supplier_invoices i ON a.invoice_id = i.id
                WHERE a.credit_note_id = :nc_id
            """), {"nc_id": nc['id']})).mappings().all()
            app_str = "; ".join([f"FAC {a['numero_factura']} (Gs. {a['monto_aplicado']:,.0f})" for a in apps]) if apps else "NINGUNA"
            status = "CANCELADA" if nc['cancelado'] else ("100% APLICADA" if nc['saldo_disponible'] == 0 else f"SALDO LIBRE: {nc['saldo_disponible']:,.0f}")
            print(f"NC {nc['numero']} ({nc['fecha']}) | Monto: {nc['monto']:>10,.0f} Gs. | Saldo Disp: {nc['saldo_disponible']:>10,.0f} Gs. | Estado: {status}")
            print(f"    └─ Ref Origen: {nc['numero_factura_origen']} | Aplicada a: {app_str}")

asyncio.run(main())
