"""Avisos al superadmin: campana dentro del sistema + WhatsApp (Evolution API).

Reusa los mismos canales que el vigia de salud. El WhatsApp tiene tope por hora
para que una avalancha de errores no llene el celular ni queme el numero; la
campana no tiene tope porque no molesta.
"""
import collections
import logging
import time

import httpx
from sqlalchemy import text

from api.src.config import settings
from api.src.db import async_session_factory
from api.src.plataforma.models import PlatformSetting

log = logging.getLogger("intelimarket.monitor")

PUBLIC_URL = "https://intelimarket.superextra.com.py"
BELL_TENANT_ID = "00000000-0000-0000-0000-000000000001"
DEFAULT_PHONE = "595994516360"
MAX_WA_PER_HOUR = 8

_wa_sent: collections.deque = collections.deque()

TITULOS = {
    "new": ("🆕", "Incidencia nueva"),
    "regression": ("♻️", "Incidencia que había resuelto volvió"),
    "spike": ("🔥", "Pico de errores"),
    "test": ("🧪", "Prueba de alertas"),
}

DEFAULTS = {"whatsapp_enabled": True, "bell_enabled": True, "alert_phone": DEFAULT_PHONE, "spike_threshold": 8}


async def load_settings(db) -> dict:
    rows = (await db.execute(text("SELECT key, value FROM platform_settings"))).all()
    cfg = dict(DEFAULTS)
    for k, v in rows:
        if k in DEFAULTS and v is not None:
            cfg[k] = v
    return cfg


async def save_settings(db, values: dict) -> dict:
    for k, v in values.items():
        if k not in DEFAULTS:
            continue
        row = await db.get(PlatformSetting, k)
        if row is None:
            db.add(PlatformSetting(key=k, value=v))
        else:
            row.value = v
    await db.flush()
    return await load_settings(db)


def _wa_allowed() -> bool:
    now = time.monotonic()
    while _wa_sent and now - _wa_sent[0] > 3600:
        _wa_sent.popleft()
    return len(_wa_sent) < MAX_WA_PER_HOUR


async def _send_whatsapp(phone: str, body: str) -> bool:
    url = f"{settings.evolution_api_url.rstrip('/')}/message/sendText/{settings.evolution_instance_name}"
    try:
        async with httpx.AsyncClient(timeout=12) as c:
            r = await c.post(url, headers={"apikey": settings.evolution_api_key},
                             json={"number": phone, "text": body, "options": {"delay": 500, "presence": "composing", "linkPreview": False}})
        return r.status_code in (200, 201)
    except Exception as e:  # noqa: BLE001
        log.warning("alerta WhatsApp no enviada: %s", str(e)[:150])
        return False


async def _bell(db, title: str, body: str, link: str) -> None:
    await db.execute(text(
        "INSERT INTO notifications (tenant_id, user_id, title, body, tipo, link) "
        "SELECT :t, id, :title, :body, 'plataforma', :link FROM users WHERE is_superadmin AND activo"),
        {"t": BELL_TENANT_ID, "title": title[:490], "body": body, "link": link})


async def notify(kind: str, title: str, lines: list[str], link: str) -> dict:
    icon, head = TITULOS.get(kind, ("⚠️", "Aviso"))
    body = "\n".join(lines)
    wa_text = f"InteliMarket · Extra Supermercado\n{icon} {head}\n\n{title}\n{body}\n\n{PUBLIC_URL}{link}"
    out = {"bell": False, "whatsapp": False}
    async with async_session_factory() as db:
        cfg = await load_settings(db)
        if cfg.get("bell_enabled"):
            await _bell(db, f"{icon} {head}: {title}", body, link)
            out["bell"] = True
        await db.commit()
    if cfg.get("whatsapp_enabled") and cfg.get("alert_phone") and (kind == "test" or _wa_allowed()):
        out["whatsapp"] = await _send_whatsapp(str(cfg["alert_phone"]), wa_text)
        if out["whatsapp"]:
            _wa_sent.append(time.monotonic())
    return out


async def notify_issue(kind: str, snap: dict) -> None:
    try:
        donde = snap.get("hostname") or snap.get("punto_emision")
        lines = [f"Origen: {snap['source']}" + (f" · {snap['provider']}" if snap.get("provider") else "")]
        if donde:
            lines.append(f"Caja: {donde}")
        if snap.get("user_name"):
            lines.append(f"Usuario: {snap['user_name']}")
        lines.append(f"Ocurrencias: {snap.get('occurrences', 1)}")
        await notify(kind, snap["title"], lines, f"/plataforma?tab=incidencias&issue={snap['id']}")
    except Exception as e:  # noqa: BLE001
        log.warning("alerta de incidencia fallo: %s", str(e)[:150])
