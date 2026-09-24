#!/usr/bin/env python3
"""
Cierre automático de sesiones de caja huérfanas o sin movimiento.
Ejecución diaria programada a las 23:59:59 (America/Asuncion) o a demanda.
- Sesiones abiertas con 0 ventas y 0 movimientos se descartan como 'sin_movimiento'.
- Sesiones abiertas con ventas pendientes de cierre se cierran automáticamente a fin de jornada.
"""
import asyncio
import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from sqlalchemy import text
from api.src.db import engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("autoclose_stale_sessions")

TZ_ASUNCION = ZoneInfo("America/Asuncion")


async def run():
    logger.info("Iniciando revisión de sesiones de caja abiertas...")
    now_asuncion = datetime.now(TZ_ASUNCION)
    hoy_str = now_asuncion.strftime("%Y-%m-%d")

    async with engine.begin() as conn:
        # 1. Sesiones abiertas con 0 ventas y 0 movimientos -> marcar como 'sin_movimiento'
        res_zero = await conn.execute(text("""
            UPDATE cash_sessions cs
            SET estado = 'sin_movimiento',
                fecha_cierre = COALESCE(cs.fecha_cierre, cs.fecha_apertura),
                observaciones = COALESCE(cs.observaciones, '') || ' [Cierre nocturno automático: sin ventas ni movimientos]'
            WHERE cs.estado IN ('abierta', 'pausada')
              AND (SELECT count(*) FROM sales s WHERE s.session_id = cs.id) = 0
              AND (SELECT count(*) FROM cash_drop_requests d WHERE d.session_id = cs.id) = 0
              AND (SELECT count(*) FROM cash_handoffs h WHERE h.session_id = cs.id) = 0
            RETURNING cs.id, cs.cajero_nombre, cs.fecha_apertura;
        """))
        closed_zero = res_zero.fetchall()
        for r in closed_zero:
            logger.info("Sesión sin movimiento descartada: %s (Cajero: %s, Apertura: %s)", r[0], r[1], r[2])
        logger.info("Total sesiones sin movimiento descartadas: %d", len(closed_zero))

        # 2. Sesiones abiertas de jornadas anteriores que sí tuvieron ventas pero nunca se cerraron
        res_sales = await conn.execute(text("""
            UPDATE cash_sessions cs
            SET estado = 'cerrada',
                fecha_cierre = timezone('utc', (cs.fecha_apertura AT TIME ZONE 'America/Asuncion')::date + time '23:59:59'),
                observaciones = COALESCE(cs.observaciones, '') || ' [Cierre nocturno automático por cambio de jornada]'
            WHERE cs.estado IN ('abierta', 'pausada')
              AND (cs.fecha_apertura AT TIME ZONE 'America/Asuncion')::date < (now() AT TIME ZONE 'America/Asuncion')::date
            RETURNING cs.id, cs.cajero_nombre, cs.fecha_apertura;
        """))
        closed_sales = res_sales.fetchall()
        for r in closed_sales:
            logger.info("Sesión con ventas de jornada anterior cerrada automáticamente: %s (Cajero: %s, Apertura: %s)", r[0], r[1], r[2])
        logger.info("Total sesiones de jornadas anteriores cerradas: %d", len(closed_sales))


if __name__ == "__main__":
    asyncio.run(run())
