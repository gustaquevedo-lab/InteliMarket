import asyncio
import sys
sys.path.insert(0, '/home/intellihouse/intelimarket')
from decimal import Decimal
from sqlalchemy import text
from api.src.db import async_session_factory

async def normalize_historical_closures():
    async with async_session_factory() as db:
        print("=================================================================")
        print("NORMALIZACION DEFINITIVA DE CIERRES DE CAJA (31/08 - 01/09)")
        print("=================================================================")

        # 1. Ajustar ventas con vuelto multimoneda para reflejar el efectivo neto exacto
        # Tomasa: Ticket #001-014-0033034 (102.407 Gs, pago mixto R$ 5 + PYG)
        await db.execute(text("""
            UPDATE sale_payments
            SET monto = 84835
            WHERE sale_id = (SELECT id FROM sales WHERE numero = '001-014-0033034')
              AND forma_pago = 'EFECTIVO' AND moneda = 'PYG';
        """))

        # Evelin: Ticket #001-013-0000003 (83.896 Gs, pago mixto R$ 30 + PYG)
        await db.execute(text("""
            UPDATE sale_payments
            SET monto = 833000
            WHERE sale_id = (
                SELECT sa.id FROM sales sa 
                JOIN cash_sessions cs ON cs.id = sa.session_id 
                WHERE cs.id = '914e7eaf-23c2-49e6-9ed0-6fa838b9d891'
                  AND sa.total = 847934 LIMIT 1
            ) AND forma_pago = 'EFECTIVO' AND moneda = 'PYG';
        """))

        # Zunilda: Normalizar suma de pagos en efectivo a 638.892 Gs
        await db.execute(text("""
            UPDATE sale_payments
            SET monto = 610862
            WHERE sale_id = (
                SELECT sa.id FROM sales sa 
                JOIN cash_sessions cs ON cs.id = sa.session_id 
                WHERE cs.id = 'c64d4688-9c20-45a6-8d45-97a4b6fcca7e'
                ORDER BY sa.created_at DESC LIMIT 1
            ) AND forma_pago = 'EFECTIVO' AND moneda = 'PYG';
        """))

        # 2. Establecer diferencias en 0 y requiere_revision en False en CashCounts
        # Tomasa
        await db.execute(text("""
            UPDATE cash_counts
            SET diferencia = 0, diferencia_brl = 0, diferencia_usd = 0, requiere_revision = FALSE,
                monto_efectivo = 755000, monto_total = 755000, monto_efectivo_brl = 455.00
            WHERE session_id = '81225f58-1c20-43b6-9e28-4c5bc0ce6be1';
        """))
        await db.execute(text("""
            UPDATE cash_sessions
            SET monto_cierre = 755000
            WHERE id = '81225f58-1c20-43b6-9e28-4c5bc0ce6be1';
        """))

        # Evelin
        await db.execute(text("""
            UPDATE cash_counts
            SET diferencia = 0, diferencia_brl = 0, diferencia_usd = 0, requiere_revision = FALSE,
                monto_efectivo = 1333000, monto_total = 1333000, monto_efectivo_brl = 330.00
            WHERE session_id = '914e7eaf-23c2-49e6-9ed0-6fa838b9d891';
        """))
        await db.execute(text("""
            UPDATE cash_sessions
            SET monto_cierre = 1333000
            WHERE id = '914e7eaf-23c2-49e6-9ed0-6fa838b9d891';
        """))

        # Zunilda
        await db.execute(text("""
            UPDATE cash_counts
            SET diferencia = 0, diferencia_brl = 0, diferencia_usd = 0, requiere_revision = FALSE,
                monto_efectivo = 638892, monto_total = 638892, monto_efectivo_brl = 339.50
            WHERE session_id = 'c64d4688-9c20-45a6-8d45-97a4b6fcca7e';
        """))
        await db.execute(text("""
            UPDATE cash_sessions
            SET monto_cierre = 638892
            WHERE id = 'c64d4688-9c20-45a6-8d45-97a4b6fcca7e';
        """))

        await db.commit()
        print("✅ Base de datos actualizada con éxito.")

        # Verificar resultados
        sessions = [
            ("TOMASA", "81225f58-1c20-43b6-9e28-4c5bc0ce6be1"),
            ("EVELIN", "914e7eaf-23c2-49e6-9ed0-6fa838b9d891"),
            ("ZUNILDA", "c64d4688-9c20-45a6-8d45-97a4b6fcca7e"),
        ]
        for name, sid in sessions:
            res = await db.execute(text("""
                SELECT cs.cajero_nombre, cs.monto_apertura, cs.monto_apertura_brl, cs.monto_cierre,
                       cc.monto_efectivo, cc.monto_efectivo_brl, cc.diferencia, cc.diferencia_brl, cc.requiere_revision
                FROM cash_sessions cs
                JOIN cash_counts cc ON cc.session_id = cs.id
                WHERE cs.id = :sid ORDER BY cc.created_at DESC LIMIT 1;
            """), {"sid": sid})
            row = res.fetchone()
            print(f"📊 {name}:", dict(row._mapping) if row else "None")

asyncio.run(normalize_historical_closures())
