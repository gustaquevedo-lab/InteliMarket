"""SSE broadcast manager para tracking GPS en tiempo real.

Cada conexión abierta al endpoint /tracking-stream registra un asyncio.Queue
aquí. Cuando /sync recibe pings GPS los broadcastea a todas las colas activas
de esa empresa. El navegador recibe los eventos sin polling — latencia < 100ms.
"""

import asyncio
from collections import defaultdict
from typing import AsyncGenerator

# company_id (str) → set de colas activas
_subscribers: dict[str, set[asyncio.Queue]] = defaultdict(set)


def subscribe(company_id: str) -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue(maxsize=200)
    _subscribers[company_id].add(q)
    return q


def unsubscribe(company_id: str, q: asyncio.Queue) -> None:
    _subscribers[company_id].discard(q)
    if not _subscribers[company_id]:
        del _subscribers[company_id]


def broadcast(company_id: str, event: dict) -> None:
    """Llamado desde el endpoint /sync — no bloquea, descarta si la cola está llena."""
    for q in list(_subscribers.get(company_id, [])):
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            pass


async def event_stream(company_id: str, q: asyncio.Queue) -> AsyncGenerator[str, None]:
    """Generador async que el EventSourceResponse consume directamente."""
    try:
        while True:
            event = await asyncio.wait_for(q.get(), timeout=25)
            import json
            yield f"data: {json.dumps(event)}\n\n"
    except asyncio.TimeoutError:
        yield ": keepalive\n\n"
