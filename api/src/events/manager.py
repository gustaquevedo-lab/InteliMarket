import asyncio
import json
from typing import Dict, Set


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[asyncio.Queue]] = {}

    async def connect(self, connection_id: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        if connection_id not in self.active_connections:
            self.active_connections[connection_id] = set()
        self.active_connections[connection_id].add(queue)
        return queue

    def disconnect(self, connection_id: str, queue: asyncio.Queue) -> None:
        if connection_id in self.active_connections:
            self.active_connections[connection_id].discard(queue)
            if not self.active_connections[connection_id]:
                del self.active_connections[connection_id]

    async def broadcast(self, connection_id: str, message: dict) -> None:
        if connection_id not in self.active_connections:
            return
        disconnected = set()
        for queue in self.active_connections[connection_id]:
            try:
                await queue.put(message)
            except Exception:
                disconnected.add(queue)
        for q in disconnected:
            self.active_connections[connection_id].discard(q)
        if not self.active_connections[connection_id]:
            del self.active_connections[connection_id]

    async def broadcast_all(self, message: dict) -> None:
        for connection_id in list(self.active_connections.keys()):
            await self.broadcast(connection_id, message)


manager = ConnectionManager()
