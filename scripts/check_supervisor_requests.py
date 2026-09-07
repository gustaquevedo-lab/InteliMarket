import asyncio
from sqlalchemy import text
from api.src.db import engine

async def check():
    async with engine.connect() as conn:
        # Pedidos en las ultimas 2 horas en PRODUCCION
        r = await conn.execute(text(
            "SELECT tipo, cajero_nombre, caja_nombre, estado, created_at "
            "FROM supervisor_auth_requests "
            "WHERE created_at >= NOW() - INTERVAL '2 hours' "
            "ORDER BY created_at DESC"
        ))
        rows = r.fetchall()
        if rows:
            print(f"=== {len(rows)} PEDIDOS EN LAS ULTIMAS 2 HORAS (PRODUCCION) ===")
            for row in rows:
                print(row)
        else:
            print("SIN pedidos en las ultimas 2 horas en PRODUCCION")

        # Ver las mas recientes en total
        r2 = await conn.execute(text(
            "SELECT tipo, cajero_nombre, caja_nombre, estado, created_at "
            "FROM supervisor_auth_requests "
            "ORDER BY created_at DESC LIMIT 5"
        ))
        print("\n=== ULTIMOS 5 PEDIDOS EN PRODUCCION ===")
        for row in r2.fetchall():
            print(row)

        # Verificar si hay tabla en sandbox schema
        r3 = await conn.execute(text(
            "SELECT COUNT(*) FROM information_schema.tables "
            "WHERE table_schema = 'sandbox' AND table_name = 'supervisor_auth_requests'"
        ))
        sandbox_exists = r3.scalar()
        print(f"\nTabla en sandbox schema: {bool(sandbox_exists)}")
        
        if sandbox_exists:
            r4 = await conn.execute(text(
                "SELECT tipo, cajero_nombre, caja_nombre, estado, created_at "
                "FROM sandbox.supervisor_auth_requests "
                "WHERE created_at >= NOW() - INTERVAL '2 hours' "
                "ORDER BY created_at DESC"
            ))
            sandbox_rows = r4.fetchall()
            print(f"Pedidos recientes en SANDBOX: {len(sandbox_rows)}")
            for row in sandbox_rows:
                print(row)

asyncio.run(check())
