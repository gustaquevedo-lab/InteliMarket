import os
import time
os.environ['TZ'] = 'America/Asuncion'
try:
    time.tzset()
except Exception:
    pass

import asyncio
import logging
import sys

from api.src.db import async_session_factory
from api.src.nemuha_connector import service

COMPANY_ID = "00000000-0000-0000-0000-000000000010"  # tenant piloto Supermercado

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)
log = logging.getLogger("sync_nemuha")


async def main() -> int:
    async with async_session_factory() as db:
        run = await service.run_sync(db, COMPANY_ID)
        log.info("status=%s rows_synced=%s errors=%s", run.status, run.rows_synced, run.errors)
        return 0 if run.status != "error" else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
