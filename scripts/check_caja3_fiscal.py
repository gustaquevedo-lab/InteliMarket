import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

async def check_sequences():
    async with async_session_factory() as db:
        # 1. Ver terminales POS y secuencias fiscales en Postgres
        res = await db.execute(text("""
            SELECT id, codigo, nombre, punto_emision, ultimo_numero, proximo_numero, activo 
            FROM pos_terminals 
            ORDER BY punto_emision ASC
        """))
        print("=== POS TERMINALS EN POSTGRES ===")
        for r in res.fetchall():
            print(f"ID: {r[0]} | Codigo: {r[1]} | Nombre: {r[2]} | Punto: {r[3]} | Ultimo: {r[4]} | Proximo: {r[5]} | Activo: {r[6]}")

        # 2. Ver si hay tabla de timbrados / secuencias fiscales
        res_timb = await db.execute(text("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'pos_terminals'
        """))
        print("\n=== COLUMNAS POS_TERMINALS ===")
        for r in res_timb.fetchall():
            print(f"{r[0]} ({r[1]})")

        # 3. Ver tablas relacionadas a timbrados o secuencias
        res_tables = await db.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name ILIKE '%timb%' OR table_name ILIKE '%secu%' OR table_name ILIKE '%fact%'
        """))
        print("\n=== TABLAS FISCALES / FACTURAS ===")
        for r in res_tables.fetchall():
            print(r[0])

asyncio.run(check_sequences())
