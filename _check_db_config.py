import asyncio, asyncpg, json

async def check():
    conn = await asyncpg.connect('postgresql://intelimarket:intelimarket_dev@intelimarket-db:5432/intelimarket')
    row = await conn.fetchrow(
        "SELECT id, nombre, config FROM tenants WHERE id = '00000000-0000-0000-0000-000000000001'"
    )
    if row:
        config = json.loads(row['config']) if row['config'] else {}
        print(f'Tenant: {row["nombre"]}')
        print(f'Vertical slug: {config.get("vertical_slug")}')
        print(f'Enabled features: {len(config.get("enabled_features", []))}')
        print(f'Custom features: {config.get("custom_features")}')
    else:
        print('Tenant not found')
    await conn.close()

asyncio.run(check())
