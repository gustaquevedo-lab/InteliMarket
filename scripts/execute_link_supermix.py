import asyncio
import asyncpg
import uuid
from datetime import date

async def link_supermix():
    db_url = ''
    with open('/home/intellihouse/intelimarket/.env') as f:
        for line in f:
            if line.startswith('DATABASE_URL='):
                db_url = line.strip().split('=', 1)[1].strip("'\"")
                break
    clean_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')
    conn = await asyncpg.connect(clean_url)

    sup = await conn.fetchrow("SELECT id, razon_social, ruc, company_id FROM suppliers WHERE razon_social ILIKE '%super%mix%'")
    sup_id = sup['id']
    company_id = sup['company_id']
    timbrado = '16492901'
    fecha_emision = date(2026, 9, 22)
    fecha_nc = date(2026, 9, 24)

    mappings = [
        {
            'id': uuid.UUID('42fb51b8-24fd-410d-8559-6df256ac0d3c'),
            'old_num': 'AUTO-REC-20260924-004748',
            'new_num': '001-001-0224277',
            'total': 2971860,
        },
        {
            'id': uuid.UUID('0765863e-70ee-46ee-8885-5942b06dba92'),
            'old_num': 'AUTO-REC-20260924-004749',
            'new_num': '001-001-0224276',
            'total': 3378941,
        },
        {
            'id': uuid.UUID('dcd964b3-3e7a-4995-be62-f32f0b013199'),
            'old_num': 'AUTO-REC-20260924-004750',
            'new_num': '001-001-0224270',
            'total': 2118018,
        },
        {
            'id': uuid.UUID('4f4c4a64-92c1-4d50-9087-f0a8d531cc8d'),
            'old_num': 'AUTO-REC-20260925-004751',
            'new_num': '001-001-0224272',
            'total': 2263706,
        },
        {
            'id': uuid.UUID('ca258172-c0a0-41fe-a544-56358d796bc1'),
            'old_num': 'AUTO-REC-20260925-004752',
            'new_num': '001-001-0224271',
            'total': 2752650,
        },
        {
            'id': uuid.UUID('5c0e89dd-f576-4b25-9896-5f14a1034414'),
            'old_num': 'AUTO-REC-20260925-004753',
            'new_num': '001-001-0224275',
            'total': 5203557,
        },
        {
            'id': uuid.UUID('43f3f4fd-c181-446c-a762-efca200e6872'),
            'old_num': 'AUTO-REC-20260925-004754',
            'new_num': '001-001-0224273',
            'total': 3387178,
        },
        {
            'id': uuid.UUID('e5410840-eca8-4eb2-89c4-5a8d6cb1cbc2'),
            'old_num': 'AUTO-REC-20260925-004755',
            'new_num': '001-001-0224274',
            'total': 5147765,
        },
    ]

    print("=== INICIANDO VINCULACIÓN DE FACTURAS SUPER MIX S.A. ===")
    async with conn.transaction():
        # 1. Update the 8 AUTO-REC invoices
        for m in mappings:
            res = await conn.execute('''
                UPDATE supplier_invoices
                SET numero_factura = $1,
                    timbrado = $2,
                    fecha_emision = $3,
                    total = $4,
                    saldo_pendiente = $4,
                    concepto = 'Factura electrónica vinculada desde DTE INBOX de SUPER MIX S.A.',
                    updated_at = NOW()
                WHERE id = $5
            ''', m['new_num'], timbrado, fecha_emision, m['total'], m['id'])
            print(f"Factura {m['old_num']} -> {m['new_num']} (Total: {m['total']:,} Gs., Timbrado: {timbrado}): {res}")

        # 2. Register Credit Note 001-001-0014128 for 163.224 Gs.
        nc_num = '001-001-0014128'
        nc_exists = await conn.fetchrow('SELECT id FROM supplier_credit_notes WHERE supplier_id = $1 AND numero = $2', sup_id, nc_num)
        if not nc_exists:
            await conn.execute('''
                INSERT INTO supplier_credit_notes (
                    id, company_id, supplier_id, numero, numero_factura_origen, timbrado,
                    fecha, fecha_recepcion, motivo, motivo_categoria, impacto_contable,
                    monto, saldo_disponible, moneda, observaciones, cancelado, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5,
                    $6, $6, $7, $8, $9,
                    $10, $10, 'PYG', $11, false, NOW()
                )
            ''', company_id, sup_id, nc_num, '001-001-0224274', timbrado,
               fecha_nc, 'Diferencia / ajuste en recepción REC-20260925-004755',
               'faltante_recepcion', 'recuperacion_merma', 163224,
               'Nota de Crédito Electrónica recibida vía IMAP DTE')
            print(f"Nota de Crédito {nc_num} por ₲ 163.224 registrada exitosamente vinculada a 001-001-0224274.")
        else:
            print(f"Nota de Crédito {nc_num} ya existía en BD.")

        # 3. Link October reception REC-20261014-004890 to invoice 001-001-0228471
        rec_oct_id = uuid.UUID('9f5d356d-aa28-42fa-9770-8f4873595e36')
        inv_oct_id = uuid.UUID('7f9d4569-5eb6-4612-b666-7c84a1cb8b55')
        await conn.execute('''
            UPDATE supplier_invoices
            SET receipt_id = $1, updated_at = NOW()
            WHERE id = $2 AND receipt_id IS NULL
        ''', rec_oct_id, inv_oct_id)
        print("Recepción REC-20261014-004890 vinculada formalmente a factura 001-001-0228471.")

    print("\n=== VERIFICACIÓN POST-VINCULACIÓN ===")
    v_invs = await conn.fetch('''
        SELECT id, numero_factura, timbrado, total, saldo_pendiente, estado, fecha_emision, receipt_id
        FROM supplier_invoices
        WHERE supplier_id = $1 AND numero_factura LIKE '001-001-022427%'
        ORDER BY numero_factura
    ''', sup_id)
    for v in v_invs:
        print("  -> Factura:", {k: str(v) for k, v in dict(v).items()})

    v_ncs = await conn.fetch('''
        SELECT id, numero, timbrado, monto, saldo_disponible, numero_factura_origen
        FROM supplier_credit_notes
        WHERE supplier_id = $1
    ''', sup_id)
    for n in v_ncs:
        print("  -> NC:", {k: str(v) for k, v in dict(n).items()})

    await conn.close()

if __name__ == '__main__':
    asyncio.run(link_supermix())
