import asyncio
import asyncpg
import json

async def execute_unification():
    db_url = ''
    with open('/home/intellihouse/intelimarket/.env') as f:
        for line in f:
            if line.startswith('DATABASE_URL='):
                db_url = line.strip().split('=', 1)[1].strip("'\"")
                break
    clean_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')
    conn = await asyncpg.connect(clean_url)

    inv_provisoria_id = '3ae60aee-ef77-48f6-b97d-37499fdb3792'
    inv_legal_id = 'b4ad0836-971b-4a75-8f4d-7cff533d6be8'
    op_id = '65954f36-190f-44bd-b0f6-445d9fbf3459'
    receipt_id = '05f271e3-971c-4cda-b54f-617880d52393'

    print("=== INICIANDO SANEAMIENTO Y UNIFICACIÓN DE FACTURA PETRONOR ===")
    
    async with conn.transaction():
        # 1. Update allocation to point to legal invoice
        al_updated = await conn.execute('''
            UPDATE supplier_payment_order_allocations
            SET invoice_id = $1,
                saldo_anterior = 2090000,
                monto_aplicado = 2090000,
                saldo_restante = 0
            WHERE payment_order_id = $2 AND invoice_id = $3
        ''', inv_legal_id, op_id, inv_provisoria_id)
        print(f"1. Allocation reasignada: {al_updated}")

        # 2. Update supplier_invoice_payments to point to legal invoice
        sip_updated = await conn.execute('''
            UPDATE supplier_invoice_payments
            SET invoice_id = $1
            WHERE invoice_id = $2
        ''', inv_legal_id, inv_provisoria_id)
        print(f"2. Pago de factura reasignado: {sip_updated}")

        # 3. Update legal invoice: receipt_id, estado='pagada', saldo_pendiente=0
        inv_updated = await conn.execute('''
            UPDATE supplier_invoices
            SET receipt_id = $1,
                estado = 'pagada',
                saldo_pendiente = 0,
                updated_at = NOW()
            WHERE id = $2
        ''', receipt_id, inv_legal_id)
        print(f"3. Factura legal actualizada a PAGADA (saldo 0): {inv_updated}")

        # 4. Delete items of provisoria invoice
        items_deleted = await conn.execute('''
            DELETE FROM supplier_invoice_items
            WHERE invoice_id = $1
        ''', inv_provisoria_id)
        print(f"4. Items de factura provisoria eliminados: {items_deleted}")

        # 5. Delete provisoria invoice
        inv_deleted = await conn.execute('''
            DELETE FROM supplier_invoices
            WHERE id = $1
        ''', inv_provisoria_id)
        print(f"5. Factura provisoria 'Petronor gas' eliminada: {inv_deleted}")

    print("\n=== VERIFICACIÓN POST-UNIFICACIÓN ===")
    # Verify legal invoice
    legal = await conn.fetchrow('''
        SELECT id, numero_factura, timbrado, total, saldo_pendiente, estado, receipt_id, updated_at
        FROM supplier_invoices WHERE id = $1
    ''', inv_legal_id)
    print("FACTURA LEGAL:", {k: str(v) for k, v in dict(legal).items()})

    # Verify provisoria is gone
    provisoria = await conn.fetchrow('SELECT id, numero_factura FROM supplier_invoices WHERE id = $1', inv_provisoria_id)
    print("FACTURA PROVISORIA EN BD:", provisoria)

    # Verify OP allocations
    allocs = await conn.fetch('''
        SELECT spoa.*, si.numero_factura, si.timbrado
        FROM supplier_payment_order_allocations spoa
        JOIN supplier_invoices si ON si.id = spoa.invoice_id
        WHERE spoa.payment_order_id = $1
    ''', op_id)
    for a in allocs:
        print("OP ALLOCATION:", {k: str(v) for k, v in dict(a).items()})

    # Verify OP disbursements (cheque)
    disbs = await conn.fetch('''
        SELECT id, forma_pago, monto, numero_cheque, fecha_cheque_vencimiento
        FROM supplier_payment_order_disbursements
        WHERE payment_order_id = $1
    ''', op_id)
    for d in disbs:
        print("OP DISBURSEMENT:", {k: str(v) for k, v in dict(d).items()})

    # Verify all pending invoices for Petronor
    pending = await conn.fetch('''
        SELECT id, numero_factura, total, saldo_pendiente, estado
        FROM supplier_invoices
        WHERE supplier_id = 'e2d1cbe4-d0ac-4ac3-b69f-2090b3a6d889' AND saldo_pendiente > 0
    ''')
    print("FACTURAS PENDIENTES PETRONOR RESTANTES:", len(pending))
    for p in pending:
        print(" ", {k: str(v) for k, v in dict(p).items()})

    await conn.close()

if __name__ == '__main__':
    asyncio.run(execute_unification())
