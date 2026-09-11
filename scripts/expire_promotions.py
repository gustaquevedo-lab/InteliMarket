#!/usr/bin/env python3
# Marca como "vencida" las promociones cuya fecha valido_hasta ya paso.
# No revierte precios el mismo -- ese UPDATE de estado dispara el trigger
# sync_promo_precio_fijo, que es el que efectivamente vuelve
# products.precio_venta a precio_regular. Pensado para correr por cron
# (ver crontab: no dispara nada solo con el paso del tiempo si nadie
# toca la fila de promotions).
#
# El trigger corre en SQL puro, fuera de cualquier sesion de SQLAlchemy --
# asi que nada le avisa a la balanza que el precio volvio al regular. Este
# script, despues del UPDATE, reconsulta los productos pesables de cada
# promo vencida (tipo precio_fijo_oferta con producto_ids) y empuja el
# precio ya revertido a las balanzas.
import asyncio
import logging

from sqlalchemy import text, select
from api.src.db import engine, async_session_factory
from api.src.products.models import Product
from api.src.integrations.scales import service as scales_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def run():
    async with engine.begin() as conn:
        res = await conn.execute(text("""
            UPDATE promotions
            SET estado = 'vencida', updated_at = NOW()
            WHERE estado = 'activa'
              AND activo = true
              AND valido_hasta < CURRENT_DATE
            RETURNING id, nombre, valido_hasta, company_id, tipo, producto_ids;
        """))
        vencidas = res.fetchall()
        for v in vencidas:
            print(f"Vencida: {v[1]} (valido_hasta {v[2]})")
        print(f"Total promociones marcadas vencidas: {len(vencidas)}")

    pesables_a_revertir = [
        v for v in vencidas if v[4] == "precio_fijo_oferta" and v[5]
    ]
    if not pesables_a_revertir:
        return

    async with async_session_factory() as db:
        producto_ids = {pid for v in pesables_a_revertir for pid in (v[5] or [])}
        r = await db.execute(select(Product).where(Product.id.in_(producto_ids)))
        for prod in r.scalars().all():
            if not prod.plu_balanza:
                continue
            company_id = next(str(v[3]) for v in pesables_a_revertir if prod.id in (v[5] or []))
            try:
                await scales_service.auto_sync_product(db, company_id, prod)
                print(f"Balanza actualizada (precio revertido): {prod.nombre}")
            except Exception as e:
                logger.warning("Auto PLU sync (revertir promo vencida) fallo para producto %s: %s", prod.id, e)


if __name__ == "__main__":
    asyncio.run(run())
