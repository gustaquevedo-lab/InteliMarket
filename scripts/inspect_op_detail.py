import asyncio
import asyncpg
import json

async def check():
    db_url = ''
    with open('/home/intellihouse/intelimarket/.env') as f:
        for line in f:
            if line.startswith('DATABASE_URL='):
                db_url = line.strip().split('=', 1)[1].strip("'\"")
                break
    clean_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')
    conn = await asyncpg.connect(clean_url)

    inv1_id = '3ae60aee-ef77-48f6-b97d-37499fdb3792'
    sip = await conn.fetch('SELECT * FROM supplier_invoice_payments WHERE invoice_id = $1', inv1_id)
    print('SUPPLIER INVOICE PAYMENTS:')
    for s in sip:
        print({k: str(v) for k, v in dict(s).items()})

    await conn.close()

if __name__ == '__main__':
    asyncio.run(check())
