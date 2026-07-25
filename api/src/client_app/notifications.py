"""Push notification service for B2B Client App via Firebase Cloud Messaging."""
import os
import json
import logging
from typing import Optional
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.client_app.models import ClientDevice

logger = logging.getLogger(__name__)

FCM_SERVER_KEY = os.getenv("FCM_SERVER_KEY", "")
FCM_API_URL = "https://fcm.googleapis.com/fcm/send"

ORDER_STATUS_NOTIFICATIONS = {
    "pendiente": {"title": "Pedido Recibido", "body": "Tu pedido fue recibido y está siendo procesado."},
    "en_pago": {"title": "Pago en Proceso", "body": "Estamos procesando el pago de tu pedido."},
    "pagado": {"title": "Pago Confirmado", "body": "¡Pago recibido! Tu pedido está en preparación."},
    "en_preparacion": {"title": "Preparando Pedido", "body": "Estamos preparando tu pedido para despachar."},
    "enviado": {"title": "Pedido en Ruta", "body": "¡Tu pedido salió para entrega! Seguilo en el mapa."},
    "entregado": {"title": "Pedido Entregado", "body": "¡Tu pedido fue entregado! Gracias por confiar en nosotros."},
    "cancelado": {"title": "Pedido Cancelado", "body": "Tu pedido fue cancelado. Contactanos para más info."},
}


async def send_push_notification(
    db: AsyncSession,
    client_user_id: UUID,
    title: str,
    body: str,
    data: Optional[dict] = None,
):
    if not FCM_SERVER_KEY:
        logger.warning("FCM_SERVER_KEY not set — push notification skipped")
        return
    r = await db.execute(
        select(ClientDevice.push_token).where(
            ClientDevice.client_user_id == client_user_id,
            ClientDevice.push_token.isnot(None),
        )
    )
    tokens = [row[0] for row in r.all() if row[0]]
    if not tokens:
        return
    payload = {
        "registration_ids": tokens,
        "notification": {"title": title, "body": body, "sound": "default"},
        "data": data or {},
    }
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            resp = await http.post(
                FCM_API_URL,
                headers={
                    "Authorization": f"key={FCM_SERVER_KEY}",
                    "Content-Type": "application/json",
                },
                content=json.dumps(payload),
            )
            if resp.status_code != 200:
                logger.error("FCM send failed: %s %s", resp.status_code, resp.text)
    except Exception as e:
        logger.error("FCM send error: %s", e)


async def notify_order_status(
    db: AsyncSession,
    client_user_id: UUID,
    order_id: str,
    order_num: Optional[str],
    new_status: str,
):
    template = ORDER_STATUS_NOTIFICATIONS.get(new_status)
    if not template:
        return
    title = template["title"]
    body = f"Pedido #{order_num or order_id[:8]} — {template['body']}"
    await send_push_notification(
        db, client_user_id, title, body,
        data={"type": "order_status", "order_id": order_id, "status": new_status},
    )
