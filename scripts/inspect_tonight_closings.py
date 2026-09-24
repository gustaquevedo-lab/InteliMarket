import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

async def inspect_tonight_closings():
    async with async_session_factory() as db:
        print("=== AUDITORIA DE CIERRES Y ARQUEOS REGISTRADOS HOY ===")
        res = await db.execute(text("""
            SELECT cs.id, cs.cajero_nombre, cr.nombre as caja, cs.monto_apertura, cs.monto_cierre,
                   cs.fecha_apertura, cs.fecha_cierre, cs.estado,
                   cc.monto_efectivo as contado_pyg, cc.monto_efectivo_usd, cc.monto_efectivo_brl,
                   cc.diferencia as dif_pyg, cc.diferencia_brl, cc.requiere_revision
            FROM cash_sessions cs
            JOIN cash_registers cr ON cs.register_id = cr.id
            LEFT JOIN cash_counts cc ON cs.id = cc.session_id
            WHERE cs.fecha_apertura >= '2026-08-31 00:00:00'
            ORDER BY cs.fecha_apertura DESC;
        """))
        cols = list(res.keys())
        rows = res.fetchall()
        for r in rows:
            print(dict(zip(cols, r)))

asyncio.run(inspect_tonight_closings())
