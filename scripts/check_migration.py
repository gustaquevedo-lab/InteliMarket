"""Check farm state after partial migration."""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DB_URL = "postgresql+asyncpg://intelimarket:intelimarket@postgres:5432/intelimarket"

async def main():
    e = create_async_engine(DB_URL)
    async with e.connect() as c:
        r = await c.execute(text("SELECT version_num FROM alembic_version"))
        print(f"alembic version: {r.scalar()}")

        r = await c.execute(text("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name LIKE 'farm_%' ORDER BY table_name
        """))
        tables = [row[0] for row in r]
        print(f"farm_* tables ({len(tables)}):")
        for t in tables:
            print(f"  - {t}")

        # Check farm_medications new columns
        r = await c.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'farm_medications'
            AND column_name IN ('efectos_adversos', 'troquel', 'updated_at')
        """))
        print(f"farm_medications extra cols: {[row[0] for row in r]}")

        r = await c.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'farm_active_ingredients'
            AND column_name IN ('dci', 'codigo_atc', 'es_controlado', 'categoria_controlado', 'updated_at')
        """))
        print(f"farm_active_ingredients extra cols: {[row[0] for row in r]}")

    await e.dispose()

asyncio.run(main())
