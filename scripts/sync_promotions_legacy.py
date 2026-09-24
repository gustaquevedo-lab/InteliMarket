#!/usr/bin/env python3
"""Sincronización dedicada e instantánea de promociones desde MySQL Ñemuha a PostgreSQL Intelimarket."""

import os
import sys
import time

os.environ["TZ"] = "America/Asuncion"
try:
    time.tzset()
except Exception:
    pass

import asyncio
import logging

from api.src.db import async_session_factory
from api.src.nemuha_connector.service import sync_promotions

COMPANY_ID = "00000000-0000-0000-0000-000000000010"  # Supermercado Extra

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("sync_promotions_legacy")


async def main() -> int:
    t0 = time.time()
    log.info("Iniciando sincronización de promociones legacy (MySQL Ñemuha -> PostgreSQL)...")
    
    async with async_session_factory() as db:
        res = await sync_promotions(db, COMPANY_ID, return_details=True)
        await db.commit()
        elapsed = time.time() - t0
        
        log.info(
            "Sincronización finalizada en %.2fs: "
            "Evaluados=%d | Importados=%d | Actualizados=%d | Desactivados (eliminadas/expiradas)=%d | Total Cambios=%d",
            elapsed,
            res["total_evaluados"],
            res["importados"],
            res["actualizados"],
            res["desactivados"],
            res["total_cambios"],
        )
        return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
