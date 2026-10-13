import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

async def check_and_add_cash_sessions_columns():
    async with async_session_factory() as db:
        # Verificar columnas en cash_sessions
        res = await db.execute(text("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'cash_sessions';
        """))
        cols = {r[0]: r[1] for r in res.fetchall()}
        print("Columnas actuales en cash_sessions:", list(cols.keys()))

        if "monto_apertura_usd" not in cols:
            print("Agregando columna monto_apertura_usd...")
            await db.execute(text("ALTER TABLE cash_sessions ADD COLUMN monto_apertura_usd NUMERIC(15, 2) DEFAULT 0;"))
        if "monto_apertura_brl" not in cols:
            print("Agregando columna monto_apertura_brl...")
            await db.execute(text("ALTER TABLE cash_sessions ADD COLUMN monto_apertura_brl NUMERIC(15, 2) DEFAULT 0;"))

        # Actualizar las sesiones de hoy con sus fondos reales de apertura
        # - Evelin (914e7eaf-23c2-49e6-9ed0-6fa838b9d891): 500.000 Gs y 300 R$
        # - Tomasa (81225f58-1c20-43b6-9e28-4c5bc0ce6be1): 500.000 Gs y 300 R$
        # - Zunilda (c64d4688-9c20-45a6-8d45-97a4b6fcca7e): 0 Gs y 0 R$
        await db.execute(text("""
            UPDATE cash_sessions
            SET monto_apertura = 500000, monto_apertura_brl = 300.00, monto_apertura_usd = 0.00
            WHERE id = '914e7eaf-23c2-49e6-9ed0-6fa838b9d891';
        """))
        await db.execute(text("""
            UPDATE cash_sessions
            SET monto_apertura = 500000, monto_apertura_brl = 300.00, monto_apertura_usd = 0.00
            WHERE id = '81225f58-1c20-43b6-9e28-4c5bc0ce6be1';
        """))
        await db.execute(text("""
            UPDATE cash_sessions
            SET monto_apertura = 0, monto_apertura_brl = 0.00, monto_apertura_usd = 0.00
            WHERE id = 'c64d4688-9c20-45a6-8d45-97a4b6fcca7e';
        """))

        # Recalcular las diferencias en cash_counts con los fondos de apertura reales
        # - Evelin: Esperado PYG = 500k + 1.007.508 = 1.507.508. Contado = 1.333.000. Dif PYG = -174.508.
        #           Esperado BRL = 300 + 30 = 330. Contado = 330. Dif BRL = 0.00.
        await db.execute(text("""
            UPDATE cash_counts
            SET diferencia_brl = 0.00, diferencia = -174508
            WHERE session_id = '914e7eaf-23c2-49e6-9ed0-6fa838b9d891';
        """))

        # - Tomasa: Esperado PYG = 500k + 375.000 = 875.000. Contado = 755.000. Dif PYG = -120.000.
        #           Esperado BRL = 300 + 155 = 455. Contado = 455. Dif BRL = 0.00.
        await db.execute(text("""
            UPDATE cash_counts
            SET diferencia_brl = 0.00, diferencia = -120000
            WHERE session_id = '81225f58-1c20-43b6-9e28-4c5bc0ce6be1';
        """))

        # - Zunilda: Esperado PYG = 0 + 906.027 = 906.027. Contado = 638.892. Dif PYG = -267.135.
        #            Esperado BRL = 0 + 357.50 = 357.50. Contado = 339.50. Dif BRL = -18.00.
        await db.execute(text("""
            UPDATE cash_counts
            SET diferencia_brl = -18.00, diferencia = -267135
            WHERE session_id = 'c64d4688-9c20-45a6-8d45-97a4b6fcca7e';
        """))

        await db.commit()
        print("Columnas agregadas y sesiones actualizadas con fondos multimoneda reales.")

asyncio.run(check_and_add_cash_sessions_columns())
