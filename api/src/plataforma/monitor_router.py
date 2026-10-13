"""Entrada de eventos y latidos desde las cajas y el navegador.

Cualquier sesion autenticada puede reportar: es lo que permite ver los errores
de una cajera en la consola sin pedirle nada. Los limites son para que una caja
con un bucle de errores no sature el servidor.
"""
import collections
import re
import time
from pathlib import Path

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.auth.middleware import require_auth
from api.src.db import get_db
from api.src.plataforma import capture
from api.src.plataforma.models import MonHeartbeat

router = APIRouter(prefix="/api/v1/monitor", tags=["monitor"])

MAX_EVENTS_PER_MIN = 120
_rate: dict[str, collections.deque] = {}
CLIENT_SOURCES = ("frontend", "electron", "integration")


class IngestEvent(BaseModel):
    source: str = "frontend"
    level: str = "error"
    kind: str | None = Field(default=None, max_length=80)
    message: str = Field(default="", max_length=4000)
    stack: str | None = Field(default=None, max_length=12000)
    route: str | None = Field(default=None, max_length=300)
    url: str | None = Field(default=None, max_length=500)
    provider: str | None = Field(default=None, max_length=40)
    op: str | None = Field(default=None, max_length=60)
    code: str | None = Field(default=None, max_length=120)
    release: str | None = Field(default=None, max_length=60)
    hostname: str | None = Field(default=None, max_length=80)
    punto_emision: str | None = Field(default=None, max_length=10)
    app_version: str | None = Field(default=None, max_length=40)
    http_status: int | None = None
    http_method: str | None = Field(default=None, max_length=8)
    duration_ms: int | None = None
    breadcrumbs: list[dict] | None = None
    extra: dict | None = None


class IngestBody(BaseModel):
    events: list[IngestEvent] = Field(max_length=20)


class HeartbeatBody(BaseModel):
    hostname: str | None = Field(default=None, max_length=80)
    punto_emision: str | None = Field(default=None, max_length=10)
    release: str | None = Field(default=None, max_length=60)
    app_version: str | None = Field(default=None, max_length=40)
    electron_version: str | None = Field(default=None, max_length=40)
    capabilities: list[str] | None = None
    url: str | None = Field(default=None, max_length=500)


def _allow(user_id: str, n: int) -> int:
    dq = _rate.setdefault(user_id, collections.deque())
    now = time.monotonic()
    while dq and now - dq[0] > 60:
        dq.popleft()
    room = max(0, MAX_EVENTS_PER_MIN - len(dq))
    take = min(room, n)
    for _ in range(take):
        dq.append(now)
    return take


def _clean_breadcrumbs(bc):
    if not bc:
        return None
    out = []
    for b in bc[-30:]:
        if not isinstance(b, dict):
            continue
        out.append({
            "t": str(b.get("t", ""))[:32], "type": str(b.get("type", ""))[:20],
            "msg": capture.scrub(str(b.get("msg", "")), 240),
        })
    return out or None


@router.post("/ingest", status_code=202)
async def ingest(body: IngestBody, request: Request, user: dict = Depends(require_auth)):
    uid = str(user.get("id") or user.get("sub") or "anon")
    accepted = _allow(uid, len(body.events))
    xff = request.headers.get("x-forwarded-for")
    ip = (xff.split(",")[0].strip() if xff else (request.client.host if request.client else None))
    for e in body.events[:accepted]:
        ev = e.model_dump()
        ev["source"] = e.source if e.source in CLIENT_SOURCES else "frontend"
        ev["message"] = capture.scrub(e.message, 2000)
        ev["stack"] = capture.scrub(e.stack, 8000)
        ev["frame"] = capture.js_top_frame(e.stack)
        ev["breadcrumbs"] = _clean_breadcrumbs(e.breadcrumbs)
        ev["user_id"] = uid[:40]
        ev["user_name"] = (user.get("user_nombre") or user.get("user_email") or "")[:120]
        ev["rol"] = (user.get("rol") or "")[:40]
        ev["client_ip"] = ip[:45] if ip else None
        ev["user_agent"] = (request.headers.get("user-agent") or "")[:300]
        capture.submit(ev)
    return {"accepted": accepted, "dropped": len(body.events) - accepted}


_caps_cache: dict = {"mtime": 0.0, "caps": []}


def expected_capabilities() -> list[str]:
    """Funciones que la app de escritorio ACTUAL expone al POS (salen del preload del repo)."""
    p = Path(__file__).resolve().parents[3] / "electron" / "preload.cjs"
    try:
        mt = p.stat().st_mtime
        if mt != _caps_cache["mtime"]:
            txt = p.read_text()
            block = txt.split("exposeInMainWorld", 1)[-1]
            _caps_cache["caps"] = sorted(set(re.findall(r"^\s{2}(\w+)\s*:", block, flags=re.M)))
            _caps_cache["mtime"] = mt
    except OSError:
        pass
    return _caps_cache["caps"]


@router.post("/heartbeat", status_code=204)
async def heartbeat(body: HeartbeatBody, request: Request, user: dict = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    uid = str(user.get("id") or user.get("sub") or "anon")
    hostname = (body.hostname or "").strip().upper() or None
    key = hostname or f"web:{uid}"
    xff = request.headers.get("x-forwarded-for")
    ip = (xff.split(",")[0].strip() if xff else (request.client.host if request.client else None))
    vals = dict(
        key=key[:120], kind="caja" if hostname else "web", environment=capture.ENVIRONMENT, hostname=hostname,
        punto_emision=body.punto_emision, user_name=(user.get("user_nombre") or user.get("user_email") or "")[:120],
        rol=(user.get("rol") or "")[:40], release=body.release, app_version=body.app_version,
        electron_version=body.electron_version, capabilities=body.capabilities, url=(body.url or "")[:500],
        client_ip=ip[:45] if ip else None, user_agent=(request.headers.get("user-agent") or "")[:300],
    )
    stmt = pg_insert(MonHeartbeat).values(**vals)
    upd = {k: v for k, v in vals.items() if k not in ("key",)}
    upd["last_seen"] = func.now()
    await db.execute(stmt.on_conflict_do_update(index_elements=["key"], set_=upd))
    return None
