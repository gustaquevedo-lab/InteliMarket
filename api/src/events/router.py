import asyncio
import json
from fastapi import APIRouter, Depends, Request, Query
from api.src.auth.middleware import require_auth
from fastapi.responses import StreamingResponse
from .manager import manager

router = APIRouter(prefix="/api/v1/events", tags=["events"])


@router.get("/stream")
async def event_stream(
    request: Request,
    company_id: str = Query(..., description="Company ID to subscribe to"),
    user: dict = Depends(require_auth),
):
    queue = await manager.connect(company_id)

    async def event_generator():
        yield f"data: {json.dumps({'type': 'connected', 'company_id': company_id})}\n\n"
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=30)
                    yield f"data: {json.dumps(message)}\n\n"
                except asyncio.TimeoutError:
                    yield f"data: {json.dumps({'type': 'ping'})}\n\n"
        finally:
            manager.disconnect(company_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
