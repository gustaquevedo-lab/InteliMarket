"""Find tables referenced in seed that don't exist in DB"""
import re
import asyncpg
import asyncio

async def main():
    conn = await asyncpg.connect('postgresql://intelimarket:intelimarket_dev@db:5432/intelimarket')
    existing = set()
    for r in await conn.fetch("SELECT tablename FROM pg_tables WHERE schemaname='public'"):
        existing.add(r['tablename'])
    
    content = open('/app/api/seed_supermer.py').read()
    refs = set(re.findall(r'INSERT INTO (\w+)', content))
    
    missing = sorted(refs - existing)
    if missing:
        print("Missing tables:")
        for t in missing:
            print(f'  {t}')
    else:
        print("All tables exist!")
    
    await conn.close()

asyncio.run(main())
