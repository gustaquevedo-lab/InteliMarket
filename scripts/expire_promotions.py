#!/usr/bin/env python3
# Marca como "vencida" las promociones cuya fecha valido_hasta ya paso.
# No revierte precios el mismo -- ese UPDATE de estado dispara el trigger
# sync_promo_precio_fijo, que es el que efectivamente vuelve
# products.precio_venta a precio_regular. Pensado para correr por cron
# (ver crontab: no dispara nada solo con el paso del tiempo si nadie
# toca la fila de promotions).
import asyncio
from sqlalchemy import text
from api.src.db import engine


async def run():
    async with engine.begin() as conn:
        res = await conn.execute(text("""
            UPDATE promotions
            SET estado = 'vencida', updated_at = NOW()
            WHERE estado = 'activa'
              AND activo = true
              AND valido_hasta < CURRENT_DATE
            RETURNING id, nombre, valido_hasta;
        """))
        vencidas = res.fetchall()
        for v in vencidas:
            print(f"Vencida: {v[1]} (valido_hasta {v[2]})")
        print(f"Total promociones marcadas vencidas: {len(vencidas)}")


if __name__ == "__main__":
    asyncio.run(run())
