"""Fix remaining column mismatches and run seed."""
import asyncio
import asyncpg

COLUMN_ADDITIONS = {
    'suppliers': ['grupo VARCHAR(50)'],
    'customers': [],
    'products': [],
    'sales': ['numero_timbrado VARCHAR(20)', 'tipo_comprobante VARCHAR(20)'],
    'purchase_orders': ['tipo_compra VARCHAR(20)'],
}

async def main():
    conn = await asyncpg.connect('postgresql://intelimarket:intelimarket@db:5432/intelimarket')
    
    for tbl, cols in COLUMN_ADDITIONS.items():
        for col_def in cols:
            col_name = col_def.split()[0]
            exists = await conn.fetchval(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name=$1 AND column_name=$2",
                tbl, col_name
            )
            if not exists:
                sql = "ALTER TABLE {} ADD COLUMN {}".format(tbl, col_def)
                try:
                    await conn.execute(sql)
                    print("Added: {}.{}".format(tbl, col_name))
                except Exception as e:
                    print("Failed {}: {}".format(tbl, e))
    
    await conn.close()
    print("Done")

asyncio.run(main())
