"""Script para sincronizar e importar todo el lote de Finanzas, Tesorería, Cuentas por Cobrar,
Cuentas por Pagar, Bancos, Cajas y Movimientos desde el 1 de Agosto de 2026 (2026-08-01).

Este script permite al negocio cerrar la brecha con el sistema legacy y operar 100% en InteliMarket
de forma totalmente idempotente (sin duplicar registros ni corromper saldos).
"""
import os
import time
os.environ['TZ'] = 'America/Asuncion'
try:
    time.tzset()
except Exception:
    pass

import asyncio
from datetime import date
import logging
import sys

from api.src.db import async_session_factory
from api.src.nemuha_connector import service

COMPANY_ID = "00000000-0000-0000-0000-000000000010"  # tenant piloto Supermercado Extra

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)
log = logging.getLogger("sync_legacy_august")


async def main() -> int:
    since_date = date(2026, 8, 1)
    modules = service.FINANCE_TREASURY_MODULES
    log.info("================================================================================")
    log.info("Iniciando actualización integral desde el legacy (Ñemuha) con fecha corte: %s", since_date)
    log.info("Módulos a sincronizar (%d): %s", len(modules), ", ".join(modules))
    log.info("================================================================================")
    
    async with async_session_factory() as db:
        run = await service.run_sync(
            db, 
            COMPANY_ID, 
            since=since_date, 
            modules=modules
        )
        
        log.info("--------------------------------------------------------------------------------")
        log.info("RESULTADO FINAL: Status=%s", run.status)
        log.info("Registros sincronizados por módulo:")
        for mod, count in run.rows_synced.items():
            log.info("  - %-30s: %d", mod, count)
        if run.errors:
            log.warning("Errores encontrados:")
            for mod, err in run.errors.items():
                log.warning("  - %-30s: %s", mod, err)
        log.info("--------------------------------------------------------------------------------")
        return 0 if run.status != "error" else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
