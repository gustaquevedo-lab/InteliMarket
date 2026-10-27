import asyncio
from decimal import Decimal
from sqlalchemy import text
from api.src.db import engine

GONZALITO_ID = 'a2f37cf3-caa5-42b5-84cd-270a549d5a73'

async def main():
    async with engine.connect() as conn:
        print("=" * 80)
        print("AUDITORÍA DEFINITIVA DE ESTADO DE CUENTA - CASA GONZALITO S.R.L.")
        print("=" * 80)
        
        # 1. Facturas Activas
        invoices = (await conn.execute(text("""
            SELECT id, numero_factura, fecha_emision, fecha_vencimiento,
                   total, saldo_pendiente, estado, cdc, receipt_id
            FROM supplier_invoices
            WHERE supplier_id = :sid AND estado != 'cancelada'
            ORDER BY fecha_emision ASC, numero_factura ASC
        """), {"sid": GONZALITO_ID})).mappings().all()

        print(f"\n1. FACTURAS ACTIVAS / EXIGIBLES ({len(invoices)} encontradas):")
        print(f"{'NÚMERO':<20} | {'FECHA':<10} | {'TOTAL FACIAL':<14} | {'SALDO PENDIENTE':<16} | {'ESTADO':<10} | {'ORIGEN'}")
        print("-" * 85)
        total_facial_sum = Decimal(0)
        saldo_pendiente_sum = Decimal(0)
        for inv in invoices:
            total_facial_sum += inv['total']
            saldo_pendiente_sum += inv['saldo_pendiente']
            print(f"{inv['numero_factura']:<20} | {str(inv['fecha_emision']):<10} | {inv['total']:>14,f} | {inv['saldo_pendiente']:>16,f} | {inv['estado']:<10} | {('REC:' + str(inv['receipt_id'])[:8]) if inv['receipt_id'] else 'SIFEN/MANUAL'}")

        print("-" * 85)
        print(f"TOTALES FACTURAS: FACIAL = {total_facial_sum:,.0f} Gs. | SALDO PENDIENTE = {saldo_pendiente_sum:,.0f} Gs.")

        # 2. Facturas Canceladas / Duplicadas
        cancelled = (await conn.execute(text("""
            SELECT id, numero_factura, total, saldo_pendiente, estado
            FROM supplier_invoices
            WHERE supplier_id = :sid AND estado = 'cancelada'
            ORDER BY numero_factura ASC
        """), {"sid": GONZALITO_ID})).mappings().all()

        print(f"\n2. FACTURAS CANCELADAS / DEPURADAS ({len(cancelled)} encontradas):")
        for c in cancelled:
            print(f"   - {c['numero_factura']}: Total {c['total']:,.0f} Gs. | Saldo: {c['saldo_pendiente']:,.0f} Gs.")

        # 3. Notas de Crédito y Aplicaciones
        ncs = (await conn.execute(text("""
            SELECT id, numero, timbrado, fecha, monto, saldo_disponible, cancelado, motivo, numero_factura_origen
            FROM supplier_credit_notes
            WHERE supplier_id = :sid
            ORDER BY fecha ASC, numero ASC
        """), {"sid": GONZALITO_ID})).mappings().all()

        print(f"\n3. NOTAS DE CRÉDITO ({len(ncs)} encontradas):")
        total_nc_monto = Decimal(0)
        total_nc_saldo = Decimal(0)
        for nc in ncs:
            if not nc['cancelado']:
                total_nc_monto += nc['monto']
                total_nc_saldo += nc['saldo_disponible']
            status = 'CANCELADA' if nc['cancelado'] else ('DISPONIBLE' if nc['saldo_disponible'] > 0 else 'APLICADA AL 100%')
            print(f"\n   NC: {nc['numero']} | Timbrado: {nc['timbrado']} | Fecha: {nc['fecha']} | Monto: {nc['monto']:,.0f} Gs. | Estado: {status}")
            print(f"       Factura Origen declarada: {nc['numero_factura_origen'] or 'N/A'} | Motivo: {nc['motivo'] or 'N/A'}")

            # Check applications
            apps = (await conn.execute(text("""
                SELECT a.id, a.monto_aplicado, a.fecha, a.observaciones,
                       i.numero_factura, i.total as fac_total, i.saldo_pendiente as fac_saldo
                FROM supplier_credit_note_applications a
                JOIN supplier_invoices i ON a.invoice_id = i.id
                WHERE a.credit_note_id = :ncid
            """), {"ncid": nc['id']})).mappings().all()

            if apps:
                for app in apps:
                    print(f"       -> Aplicada a Factura: {app['numero_factura']} | Monto Aplicado: {app['monto_aplicado']:,.0f} Gs. | Fecha: {app['fecha']} | Obs: {app['observaciones']}")
            else:
                if not nc['cancelado']:
                    print(f"       [!] ALERTA: NC SIN APLICACIÓN A FACTURA ESPECÍFICA (Saldo libre: {nc['saldo_disponible']:,.0f} Gs.)")

        # 4. Pagos Realizados
        payments = (await conn.execute(text("""
            SELECT p.id, p.monto, p.fecha_pago, p.payment_method, p.referencia, p.estado,
                   i.numero_factura
            FROM supplier_invoice_payments p
            JOIN supplier_invoices i ON p.invoice_id = i.id
            WHERE i.supplier_id = :sid
            ORDER BY p.fecha_pago ASC
        """), {"sid": GONZALITO_ID})).mappings().all()
        print(f"\n4. PAGOS REGISTRADOS ({len(payments)} encontrados):")
        for p in payments:
            print(f"   - Pago a Fac {p['numero_factura']} ({p['fecha_pago']}): {p['monto']:,.0f} Gs. via {p['payment_method']} | Ref: {p['referencia']} | Estado: {p['estado']}")

        # 5. Resumen Consolidado de Deuda
        print("\n" + "=" * 80)
        print("5. CONSOLIDADO DE CUENTA CORRIENTE (REGLA 13):")
        print(f"   - Suma Facial Facturas Activas:   {total_facial_sum:>15,.0f} Gs.")
        print(f"   - Suma NCs Aplicadas a Facturas:  {sum([nc['monto'] for nc in ncs if not nc['cancelado']]):>15,.0f} Gs.")
        print(f"   - Saldo Real Pendiente en Cuenta: {saldo_pendiente_sum:>15,.0f} Gs.")
        print(f"   - NCs Flotantes Sin Aplicar:      {total_nc_saldo:>15,.0f} Gs.")
        print("=" * 80)

asyncio.run(main())
