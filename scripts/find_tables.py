import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

async def find_tables():
    async with async_session_factory() as db:
        res = await db.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"))
        tables = [r[0] for r in res.fetchall()]
        print("TABLAS:", [t for t in tables if any(k in t for k in ['caja', 'pos', 'timb', 'fact', 'turno', 'secu', 'punto'])])

asyncio.run(find_tables())
