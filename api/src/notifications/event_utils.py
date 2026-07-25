"""Notification event utilities for SSE"""

import uuid

from api.src.events.emitters import manager


async def emit_notification(user_id: uuid.UUID, data: dict) -> None:
    await manager.broadcast(str(user_id), {
        "type": "notification",
        **data,
    })