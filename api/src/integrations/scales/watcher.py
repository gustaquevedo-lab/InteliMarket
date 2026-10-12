"""Vigilante de precios de balanza (tiempo real, sin cron).

La base de datos avisa (LISTEN/NOTIFY, triggers trg_notify_balanza_precio en `products` y
trg_notify_balanza_promo en `promotions`) cada vez que cambia el precio / nombre / PLU / estado
de un producto pesable, o una promocion. Sin importar quien lo cambio: pantalla, otro trigger
SQL, el sync de Nemuha, un script o SQL a mano. El vigilante agrupa rafagas (DEBOUNCE) y corre
el reconciliador, que calcula el precio que cobra la caja y transmite solo lo que difiere.

Los cambios por tiempo (una promo que arranca/termina por fecha, dia de semana u horario) no
generan ningun evento en la base: para esos el vigilante hace una pasada propia cada
HEARTBEAT segundos. El cron (scripts/reconcile_balanzas.py) queda solo de respaldo y comparte
el lock /tmp/reconcile_balanzas.lock para no abrir dos sesiones a la vez contra una balanza
(el equipo acepta una sola).

Corre dentro del API, solo en la instancia con scheduler (ver lifespan en main.py).
"""
import asyncio
import fcntl
import logging
import time
from typing import Optional

import asyncpg

from api.src.config import settings
from api.src.db import async_session_factory
from api.src.integrations.scales.reconciler import reconciliar_todas

log = logging.getLogger("balanza_watcher")

CANALES = ("balanza_precio", "balanza_promo")
DEBOUNCE = 2.0          # s: agrupa rafagas de cambios (ej. sync masivo) en una sola pasada
HEARTBEAT = 30.0        # s: pasada propia para cambios por tiempo (fecha/dia/horario de promos)
LOCK_PATH = "/tmp/reconcile_balanzas.lock"
BACKOFF_MIN, BACKOFF_MAX = 30.0, 300.0


class BalanzaWatcher:
    def __init__(self) -> None:
        self._dirty = asyncio.Event()
        self._tasks: list[asyncio.Task] = []
        self._espera: dict[str, tuple[float, float]] = {}  # scale_id -> (no_antes_de, delay)
        self.ultima_pasada: Optional[float] = None

    # ── arranque / parada ──────────────────────────────────────────────
    def start(self) -> None:
        if self._tasks:
            return
        self._tasks = [asyncio.create_task(self._escuchar(), name="balanza_listen"),
                       asyncio.create_task(self._trabajar(), name="balanza_worker")]
        log.info("Vigilante de precios de balanza iniciado (canales %s, debounce %.0fs, heartbeat %.0fs)",
                 ",".join(CANALES), DEBOUNCE, HEARTBEAT)

    async def stop(self) -> None:
        for t in self._tasks:
            t.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks = []

    # ── escucha de eventos de la base ──────────────────────────────────
    def _on_notify(self, *_args) -> None:
        self._dirty.set()

    async def _escuchar(self) -> None:
        dsn = settings.database_url.replace("postgresql+asyncpg://", "postgresql://", 1)
        while True:
            conn = None
            try:
                conn = await asyncpg.connect(dsn, server_settings={"timezone": "America/Asuncion"})
                for canal in CANALES:
                    await conn.add_listener(canal, self._on_notify)
                self._dirty.set()  # al (re)conectar: pasada de recuperacion por si se perdio algun aviso
                log.info("Vigilante escuchando %s", ",".join(CANALES))
                while True:
                    await asyncio.sleep(30)
                    await conn.execute("SELECT 1")  # detecta conexion caida
            except asyncio.CancelledError:
                raise
            except Exception as e:  # noqa: BLE001
                log.warning("Vigilante: conexion de escucha caida (%s); reintento en 5 s", e)
                await asyncio.sleep(5)
            finally:
                if conn is not None:
                    try:
                        await conn.close(timeout=2)
                    except Exception:  # noqa: BLE001
                        pass

    # ── trabajo ────────────────────────────────────────────────────────
    async def _trabajar(self) -> None:
        self._dirty.set()  # pasada de recuperacion al arrancar
        while True:
            try:
                por_evento = True
                try:
                    await asyncio.wait_for(self._dirty.wait(), timeout=HEARTBEAT)
                except asyncio.TimeoutError:
                    por_evento = False
                if por_evento:
                    await asyncio.sleep(DEBOUNCE)  # deja juntar la rafaga
                self._dirty.clear()
                await self._pasada(por_evento)
            except asyncio.CancelledError:
                raise
            except Exception as e:  # noqa: BLE001 -- el vigilante nunca debe morir
                log.exception("Vigilante: error en pasada: %s", e)
                await asyncio.sleep(5)

    async def _pasada(self, por_evento: bool) -> None:
        ahora = time.monotonic()
        # Un evento reintenta todas las balanzas; el heartbeat respeta la espera tras un error.
        omitir = set() if por_evento else {sid for sid, (hasta, _d) in self._espera.items() if ahora < hasta}

        fd = await self._tomar_lock()
        if fd is None:
            self._dirty.set()  # el cron de respaldo esta transmitiendo; reintenta enseguida
            return
        try:
            resultados = await reconciliar_todas(async_session_factory, omitir=omitir)
        finally:
            fcntl.flock(fd, fcntl.LOCK_UN)
            fd.close()

        self.ultima_pasada = time.time()
        for r in resultados:
            if r.estado == "ok":
                log.info("Vigilante -> %s", r)
                self._espera.pop(r.scale_id, None)
            elif r.estado == "error":
                _hasta, delay = self._espera.get(r.scale_id, (0.0, BACKOFF_MIN / 2))
                delay = min(BACKOFF_MAX, max(BACKOFF_MIN, delay * 2))
                self._espera[r.scale_id] = (time.monotonic() + delay, delay)
                log.warning("Vigilante -> %s (proximo intento por tiempo en %.0fs)", r, delay)
            elif r.estado == "al_dia":
                self._espera.pop(r.scale_id, None)

    @staticmethod
    async def _tomar_lock():
        for _ in range(20):
            fd = open(LOCK_PATH, "a")
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                return fd
            except BlockingIOError:
                fd.close()
                await asyncio.sleep(3)
        return None


balanza_watcher = BalanzaWatcher()
