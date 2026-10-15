"""
Watchdog de Resiliencia y Auto-Reconexión de WhatsApp (Evolution API / IntelliZapp).

Monitorea periódicamente (cada 60 segundos) el estado de la conexión de la instancia
en Evolution API. Si detecta caída a 'close' o 'connecting' sin revocación permanente,
intenta reestablecer el stream silenciosamente y verifica que el webhook oficial hacia NGINX
permanezca activo.
"""

import asyncio
from datetime import datetime, timezone
import logging
from typing import Dict, Any, Optional

from api.src.whatsapp.evolution_client import evolution_client

logger = logging.getLogger("whatsapp.watchdog")

# Estado en memoria para diagnóstico en tiempo real
_watchdog_state: Dict[str, Any] = {
    "is_running": False,
    "last_check_at": None,
    "last_state": "unknown",
    "connected": False,
    "auto_reconnects_count": 0,
    "last_reconnect_at": None,
    "last_reconnect_result": None,
    "settings_applied": False,
    "error": None,
}

_watchdog_task: Optional[asyncio.Task] = None


async def _run_single_check() -> Dict[str, Any]:
    """Ejecuta una ronda de verificación y auto-recuperación."""
    now = datetime.now(timezone.utc)
    _watchdog_state["last_check_at"] = now.isoformat()

    try:
        # 1. Obtener estado de la instancia
        status = await evolution_client.get_instance_status()
        state = status.get("state", "unknown")
        connected = status.get("connected", False)

        _watchdog_state["last_state"] = state
        _watchdog_state["connected"] = connected
        _watchdog_state["error"] = status.get("error")

        # 2. Si está conectada, asegurar que tenga los settings de blindaje aplicados
        if connected and not _watchdog_state.get("settings_applied"):
            res_set = await evolution_client.apply_hardened_settings()
            if res_set.get("success"):
                _watchdog_state["settings_applied"] = True
                logger.info("[WhatsApp Watchdog] Settings de blindaje (alwaysOnline, groupsIgnore) aplicados con éxito.")

        # 3. Si está en 'close', intentar reconexión automática silenciosa
        if state in ("close", "connecting") and not status.get("error"):
            logger.warning(f"[WhatsApp Watchdog] Detectada instancia en estado '{state}'. Disparando reconexión silenciosa...")
            reconnect_res = await evolution_client.reconnect_if_needed()
            _watchdog_state["auto_reconnects_count"] += 1
            _watchdog_state["last_reconnect_at"] = datetime.now(timezone.utc).isoformat()
            _watchdog_state["last_reconnect_result"] = reconnect_res
            logger.info(f"[WhatsApp Watchdog] Resultado reconexión: {reconnect_res}")

        return _watchdog_state
    except Exception as e:
        logger.error(f"[WhatsApp Watchdog] Error en ciclo de verificación: {e}")
        _watchdog_state["error"] = str(e)
        return _watchdog_state


async def _watchdog_loop(interval_seconds: int = 60):
    """Bucle infinito del watchdog."""
    _watchdog_state["is_running"] = True
    logger.info(f"[WhatsApp Watchdog] Iniciado bucle de supervisión (intervalo: {interval_seconds}s)")

    # Esperar 15 segundos al inicio para permitir que la app termine el boot completo
    await asyncio.sleep(15)

    while _watchdog_state["is_running"]:
        try:
            await _run_single_check()
        except asyncio.CancelledError:
            logger.info("[WhatsApp Watchdog] Tarea cancelada por apagado del servidor.")
            break
        except Exception as e:
            logger.error(f"[WhatsApp Watchdog] Excepción no controlada en loop: {e}")

        try:
            await asyncio.sleep(interval_seconds)
        except asyncio.CancelledError:
            break

    _watchdog_state["is_running"] = False


def start_whatsapp_watchdog(interval_seconds: int = 60) -> Optional[asyncio.Task]:
    """Inicia la tarea en segundo plano si no está corriendo."""
    global _watchdog_task
    if _watchdog_task and not _watchdog_task.done():
        logger.debug("[WhatsApp Watchdog] Ya está corriendo.")
        return _watchdog_task

    loop = asyncio.get_event_loop()
    _watchdog_task = loop.create_task(_watchdog_loop(interval_seconds))
    return _watchdog_task


def stop_whatsapp_watchdog():
    """Detiene la tarea en segundo plano."""
    global _watchdog_task
    _watchdog_state["is_running"] = False
    if _watchdog_task and not _watchdog_task.done():
        _watchdog_task.cancel()
        _watchdog_task = None
        logger.info("[WhatsApp Watchdog] Detenido.")


def get_watchdog_status() -> Dict[str, Any]:
    """Retorna el diagnóstico actual del watchdog."""
    return dict(_watchdog_state)


async def trigger_watchdog_check() -> Dict[str, Any]:
    """Fuerza una comprobación inmediata bajo demanda."""
    return await _run_single_check()
