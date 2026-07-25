"""WebSocket connection manager for real-time delivery tracking."""

from fastapi import WebSocket, WebSocketDisconnect
import json
import asyncio
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any


class ConnectionManager:
    """Manages WebSocket connections for real-time tracking.

    Channels:
      - dispatcher:{tenant_id}: dispatchers viewing the fleet dashboard
      - driver:{driver_id}: individual driver position updates
    """

    def __init__(self):
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._driver_positions: dict[str, dict] = {}

    async def connect(self, websocket: WebSocket, channel: str):
        await websocket.accept()
        self._connections[channel].add(websocket)

    def disconnect(self, websocket: WebSocket, channel: str):
        self._connections[channel].discard(websocket)
        if not self._connections[channel]:
            del self._connections[channel]

    async def broadcast(self, channel: str, message: dict):
        dead = set()
        for ws in self._connections.get(channel, set()):
            try:
                await ws.send_json(message)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._connections[channel].discard(ws)

    async def broadcast_to_tenant(self, tenant_id: str, message: dict):
        await self.broadcast(f"dispatcher:{tenant_id}", message)

    def update_driver_position(self, driver_id: str, lat: float, lng: float, extra: dict | None = None):
        pos = {
            "driver_id": driver_id,
            "lat": lat,
            "lng": lng,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **(extra or {}),
        }
        self._driver_positions[driver_id] = pos
        return pos

    def get_driver_position(self, driver_id: str) -> dict | None:
        return self._driver_positions.get(driver_id)

    def get_all_positions(self) -> list[dict]:
        return list(self._driver_positions.values())


# Singleton instance
manager = ConnectionManager()


async def handle_driver_ws(websocket: WebSocket, driver_id: str):
    """Handle a driver's WebSocket connection for GPS streaming."""
    channel = f"driver:{driver_id}"
    await manager.connect(websocket, channel)
    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            lat = data.get("lat")
            lng = data.get("lng")
            if lat is not None and lng is not None:
                pos = manager.update_driver_position(
                    driver_id, lat, lng,
                    extra={"heading": data.get("heading"), "speed": data.get("speed"), "battery": data.get("battery")},
                )
                # Broadcast to dispatchers
                if data.get("tenant_id"):
                    await manager.broadcast_to_tenant(data["tenant_id"], {
                        "type": "driver_position",
                        "data": pos,
                    })
                await websocket.send_json({"type": "ack", "timestamp": pos["timestamp"]})
    except (WebSocketDisconnect, Exception):
        manager.disconnect(websocket, channel)


async def handle_dispatcher_ws(websocket: WebSocket, tenant_id: str):
    """Handle a dispatcher's WebSocket connection for fleet view."""
    channel = f"dispatcher:{tenant_id}"
    await manager.connect(websocket, channel)
    try:
        # Send initial state
        await websocket.send_json({
            "type": "positions_snapshot",
            "data": manager.get_all_positions(),
        })
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except (WebSocketDisconnect, Exception):
        manager.disconnect(websocket, channel)
