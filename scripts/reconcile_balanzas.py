#!/usr/bin/env python3
# RESPALDO del vigilante de precios de balanza (api/src/integrations/scales/watcher.py).
#
# El camino principal es en tiempo real: los triggers de la base avisan (NOTIFY) y el vigilante
# transmite en segundos, sin cron. Este script hace la misma pasada (api/src/integrations/scales/
# reconciler.py) por si el vigilante estuvo caido (reinicio del API, etc.) y, con --full, refresca
# el catalogo completo (las balanzas no se pueden leer de vuelta, es la unica forma de acotar
# divergencias). Comparte /tmp/reconcile_balanzas.lock con el vigilante (el cron lo toma con flock -n).
#
#   --full     fuerza carga completa a todas las balanzas
#   --dry-run  solo informa diferencias, no transmite
#   --scale X  limita a balanzas cuyo nombre contenga X
import argparse
import asyncio
import logging

from api.src.db import async_session_factory
from api.src.integrations.scales.reconciler import reconciliar_todas

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("reconcile_balanzas")


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--full", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--scale", help="solo balanzas cuyo nombre contenga este texto")
    args = ap.parse_args()
    for r in await reconciliar_todas(async_session_factory, full=args.full, dry=args.dry_run, solo=args.scale):
        log.info(str(r))


if __name__ == "__main__":
    asyncio.run(main())
