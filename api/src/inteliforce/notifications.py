"""Push notifications para la app Inteliforce (FCM).

Reutiliza el FCM_SERVER_KEY ya configurado. Los tokens de dispositivo se
almacenan en inteliforce_devices — un rep puede tener varios (cambio de celu).
"""

import json
import logging
import os
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.inteliforce.models import InteliforceDevice

logger = logging.getLogger(__name__)

FCM_SERVER_KEY = os.getenv("FCM_SERVER_KEY", "")
FCM_API_URL = "https://fcm.googleapis.com/fcm/send"


async def _get_tokens(db: AsyncSession, sales_rep_id: UUID) -> list[str]:
    r = await db.execute(
        select(InteliforceDevice.fcm_token).where(
            InteliforceDevice.sales_rep_id == sales_rep_id,
            InteliforceDevice.activo == True,
            InteliforceDevice.fcm_token.isnot(None),
        )
    )
    return [row[0] for row in r.all()]


async def _get_supervisor_tokens(db: AsyncSession, supervisor_id: UUID) -> list[str]:
    return await _get_tokens(db, supervisor_id)


async def send_to_rep(
    db: AsyncSession,
    sales_rep_id: UUID,
    title: str,
    body: str,
    data: dict | None = None,
) -> None:
    if not FCM_SERVER_KEY:
        logger.warning("FCM_SERVER_KEY no configurado — notificación omitida")
        return
    tokens = await _get_tokens(db, sales_rep_id)
    if not tokens:
        return
    await _send_fcm(tokens, title, body, data or {})


async def send_to_supervisor(
    db: AsyncSession,
    supervisor_id: UUID,
    title: str,
    body: str,
    data: dict | None = None,
) -> None:
    if not FCM_SERVER_KEY:
        return
    tokens = await _get_supervisor_tokens(db, supervisor_id)
    if not tokens:
        return
    await _send_fcm(tokens, title, body, data or {})


async def _send_fcm(tokens: list[str], title: str, body: str, data: dict) -> None:
    payload = {
        "registration_ids": tokens,
        "notification": {"title": title, "body": body, "sound": "default"},
        "data": {k: str(v) for k, v in data.items()},
        "priority": "high",
    }
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            resp = await http.post(
                FCM_API_URL,
                headers={"Authorization": f"key={FCM_SERVER_KEY}", "Content-Type": "application/json"},
                content=json.dumps(payload),
            )
            if resp.status_code != 200:
                logger.error("FCM error %s: %s", resp.status_code, resp.text[:200])
    except Exception as e:
        logger.error("FCM send error: %s", e)


# ── Notificaciones predefinidas ────────────────────────────────────────────────

async def notify_order_approved(db: AsyncSession, sales_rep_id: UUID, numero: str) -> None:
    await send_to_rep(db, sales_rep_id, "Pedido aprobado ✓", f"Pedido #{numero} fue aprobado.", {"type": "order_approved", "numero": numero})


async def notify_order_rejected(db: AsyncSession, sales_rep_id: UUID, numero: str, motivo: str = "") -> None:
    await send_to_rep(db, sales_rep_id, "Pedido rechazado", f"Pedido #{numero} fue rechazado. {motivo}".strip(), {"type": "order_rejected", "numero": numero})


async def notify_new_route(db: AsyncSession, sales_rep_id: UUID) -> None:
    await send_to_rep(db, sales_rep_id, "Nueva ruta asignada", "Tenés una nueva ruta para hoy. Revisá tus stops.", {"type": "new_route"})


async def notify_target_achieved(db: AsyncSession, sales_rep_id: UUID, linea: str, pct: float) -> None:
    await send_to_rep(db, sales_rep_id, f"Meta alcanzada 🎯", f"Alcanzaste el {pct:.0f}% de tu meta en {linea}.", {"type": "target_achieved", "linea": linea})


async def notify_expiry_alert(db: AsyncSession, supervisor_id: UUID, customer_nombre: str, producto_nombre: str, dias: int) -> None:
    await send_to_supervisor(
        db, supervisor_id,
        "Alerta de vencimiento ⚠️",
        f"{producto_nombre} en {customer_nombre} vence en {dias} días.",
        {"type": "expiry_alert", "dias": str(dias)},
    )


async def notify_incident(db: AsyncSession, supervisor_id: UUID, tipo: str, customer_nombre: str, rep_nombre: str) -> None:
    labels = {"quiebre": "Quiebre de stock", "producto_danado": "Producto dañado", "falta_espacio": "Falta de espacio", "competencia": "Actividad de competencia"}
    label = labels.get(tipo, "Incidencia")
    await send_to_supervisor(
        db, supervisor_id,
        f"{label} reportado",
        f"{rep_nombre} reportó {label.lower()} en {customer_nombre}.",
        {"type": "incident", "tipo": tipo},
    )
