#!/usr/bin/env python3
"""
Script para Resetear / Re-Clonar el Sandbox desde Producción en 1 Clic
Vuelve a copiar todos los datos reales (productos, fotos, clientes) al esquema sandbox
eliminando cualquier venta o prueba anterior.
"""

import asyncio, asyncpg

async def reset_sandbox():
    print("🔄 Reseteando entorno Sandbox desde Producción...")
    conn = await asyncpg.connect("postgresql://intelimarket:password@localhost:5432/intelimarket")
    
    tables = await conn.fetch("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'")
    print(f"📦 Re-clonando {len(tables)} tablas de producción a sandbox...")
    
    for r in tables:
        t = r["table_name"]
        await conn.execute(f"DROP TABLE IF EXISTS sandbox.{t} CASCADE")
        await conn.execute(f"CREATE TABLE sandbox.{t} (LIKE public.{t} INCLUDING ALL)")
        await conn.execute(f"INSERT INTO sandbox.{t} SELECT * FROM public.{t}")
        
    await conn.close()
    print("🎉 Entorno Sandbox 100% reseteado y sincronizado con producción limpia!")

if __name__ == "__main__":
    asyncio.run(reset_sandbox())
