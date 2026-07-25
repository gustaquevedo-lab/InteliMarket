"""Integrations service — manages webhook configurations and sends events to ecosystem"""

import httpx
import hashlib
import hmac
import json
import logging
from typing import Optional
from datetime import datetime
from sqlalchemy import select, text as sa_text
from api.src.db import get_db

logger = logging.getLogger(__name__)

# Default ecosystem URLs (can be overridden per tenant)
ECOSYSTEM_URLS = {
    "intelicont": "http://intelicont:8000",
    "inteliaudit": "http://inteliaudit:8000",
    "sueldok": "http://sueldok:8000",
}

ECOSYSTEM_ENDPOINTS = {
    "intelicont": "/api/webhooks/intelimarket",
    "inteliaudit": "/api/webhooks/intelimarket",
    "sueldok": "/api/webhooks/intelimarket",
}


def get_configs(db) -> list[dict]:
    """Get all integration configs."""
    query = """
        SELECT id, destino, url, activo, eventos, creado, actualizado
        FROM integration_configs
        ORDER BY destino
    """
    results = db.execute(query).mappings().all()
    return [
        {
            "id": r["id"],
            "destino": r["destino"],
            "url": r["url"],
            "activo": r["activo"],
            "eventos": r["eventos"] or [],
            "creado": r["creado"],
            "actualizado": r["actualizado"],
        }
        for r in results
    ]


def get_config(db, config_id: int) -> Optional[dict]:
    """Get integration config by ID."""
    query = "SELECT * FROM integration_configs WHERE id = :id"
    result = db.execute(query, {"id": config_id}).mappings().first()
    if not result:
        return None
    return {
        "id": result["id"],
        "destino": result["destino"],
        "url": result["url"],
        "activo": result["activo"],
        "eventos": result["eventos"] or [],
        "creado": result["creado"],
        "actualizado": result["actualizado"],
    }


def create_config(db, config_data: dict) -> dict:
    """Create new integration config."""
    query = """
        INSERT INTO integration_configs (destino, url, secret, eventos, activo)
        VALUES (:destino, :url, :secret, :eventos, :activo)
        RETURNING id, destino, url, activo, eventos, creado, actualizado
    """
    result = db.execute(query, {
        "destino": config_data["destino"],
        "url": config_data["url"],
        "secret": config_data.get("secret"),
        "eventos": json.dumps(config_data.get("eventos", [])),
        "activo": config_data.get("activo", True),
    }).mappings().first()
    db.commit()
    return {
        "id": result["id"],
        "destino": result["destino"],
        "url": result["url"],
        "activo": result["activo"],
        "eventos": result["eventos"] or [],
        "creado": result["creado"],
        "actualizado": result["actualizado"],
    }


def update_config(db, config_id: int, updates: dict) -> Optional[dict]:
    """Update integration config."""
    fields = []
    params = {"id": config_id}
    for key in ["url", "secret", "activo"]:
        if key in updates:
            fields.append(f"{key} = :{key}")
            params[key] = updates[key]
    if "eventos" in updates:
        fields.append("eventos = :eventos")
        params["eventos"] = json.dumps(updates["eventos"])
    if not fields:
        return None
    fields.append("actualizado = CURRENT_TIMESTAMP")
    query = f"""
        UPDATE integration_configs
        SET {', '.join(fields)}
        WHERE id = :id
        RETURNING id, destino, url, activo, eventos, creado, actualizado
    """
    result = db.execute(query, params).mappings().first()
    db.commit()
    if not result:
        return None
    return {
        "id": result["id"],
        "destino": result["destino"],
        "url": result["url"],
        "activo": result["activo"],
        "eventos": result["eventos"] or [],
        "creado": result["creado"],
        "actualizado": result["actualizado"],
    }


def delete_config(db, config_id: int) -> bool:
    """Delete integration config."""
    query = "DELETE FROM integration_configs WHERE id = :id"
    result = db.execute(query, {"id": config_id})
    db.commit()
    return result.rowcount > 0


def send_webhook(db, evento: str, payload: dict, tenant_id: Optional[int] = None) -> list[dict]:
    """Send webhook event to all matching integration configs."""
    query = "SELECT * FROM integration_configs WHERE activo = true"
    if tenant_id:
        query += " AND tenant_id = :tenant_id"
    configs = db.execute(query, {"tenant_id": tenant_id} if tenant_id else {}).mappings().all()

    deliveries = []
    for config in configs:
        eventos = config["eventos"] or []
        if eventos and evento not in eventos:
            continue

        delivery = _send_to_url(
            url=config["url"],
            evento=evento,
            payload=payload,
            secret=config.get("secret"),
            config_id=config["id"],
            db=db,
        )
        deliveries.append(delivery)

    return deliveries


def _send_to_url(url: str, evento: str, payload: dict, secret: Optional[str], config_id: int, db) -> dict:
    """Send webhook to a specific URL."""
    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Event": evento,
        "X-Webhook-Source": "intelimarket",
    }

    body = json.dumps({"evento": evento, "payload": payload}, default=str)

    if secret:
        signature = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
        headers["X-Webhook-Signature"] = f"sha256={signature}"

    status_code = 0
    intento = 1
    try:
        with httpx.Client(timeout=10) as client:
            response = client.post(url, headers=headers, content=body)
            status_code = response.status_code
    except Exception as e:
        logger.error(f"Webhook delivery failed to {url}: {e}")

    # Log delivery
    try:
        log_query = """
            INSERT INTO webhook_deliveries (config_id, evento, url, status, payload_size, intento)
            VALUES (:config_id, :evento, :url, :status, :payload_size, :intento)
        """
        db.execute(log_query, {
            "config_id": config_id,
            "evento": evento,
            "url": url,
            "status": status_code,
            "payload_size": len(body),
            "intento": intento,
        })
        db.commit()
    except Exception:
        pass

    return {
        "config_id": config_id,
        "evento": evento,
        "url": url,
        "status": status_code,
        "intento": intento,
        "success": 200 <= status_code < 300,
    }


def get_deliveries(db, config_id: Optional[int] = None, limit: int = 50) -> list[dict]:
    """Get webhook delivery history."""
    query = "SELECT * FROM webhook_deliveries"
    params = {}
    if config_id:
        query += " WHERE config_id = :config_id"
        params["config_id"] = config_id
    query += " ORDER BY creado DESC LIMIT :limit"
    params["limit"] = limit

    results = db.execute(query, params).mappings().all()
    return [
        {
            "id": r["id"],
            "config_id": r["config_id"],
            "evento": r["evento"],
            "url": r["url"],
            "status": r["status"],
            "payload_size": r["payload_size"],
            "intento": r["intento"],
            "creado": r["creado"],
        }
        for r in results
    ]


async def send_webhook_async(
    db: "AsyncSession", evento: str, payload: dict, tenant_id: Optional[str] = None
) -> list[dict]:
    """Async webhook event sender. Non-blocking — catches all exceptions."""
    try:
        from sqlalchemy.ext.asyncio import AsyncSession

        conditions = ["activo = true"]
        params: dict = {}
        if tenant_id:
            conditions.append("tenant_id = :tenant_id")
            params["tenant_id"] = tenant_id

        query = f"SELECT * FROM integration_configs WHERE {' AND '.join(conditions)}"
        result = await db.execute(sa_text(query), params)
        configs = result.mappings().all()
    except Exception:
        return []

    deliveries = []
    for config in configs:
        eventos = config.get("eventos") or []
        if eventos and evento not in eventos:
            continue
        delivery = await _send_async(
            url=config["url"],
            evento=evento,
            payload=payload,
            secret=config.get("secret"),
            config_id=config["id"],
            db=db,
        )
        deliveries.append(delivery)
    return deliveries


async def _send_async(
    url: str, evento: str, payload: dict, secret: Optional[str], config_id: int, db
) -> dict:
    """Async webhook delivery."""
    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Event": evento,
        "X-Webhook-Source": "intelimarket",
    }
    body = json.dumps({"evento": evento, "payload": payload}, default=str)
    if secret:
        signature = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
        headers["X-Webhook-Signature"] = f"sha256={signature}"

    status_code = 0
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(url, headers=headers, content=body)
            status_code = response.status_code
    except Exception:
        pass

    try:
        log_query = """
            INSERT INTO webhook_deliveries (config_id, evento, url, status, payload_size, intento)
            VALUES (:config_id, :evento, :url, :status, :payload_size, 1)
        """
        await db.execute(
            sa_text(log_query),
            {
                "config_id": config_id,
                "evento": evento,
                "url": url,
                "status": status_code,
                "payload_size": len(body),
            },
        )
        await db.commit()
    except Exception:
        pass

    return {
        "config_id": config_id,
        "evento": evento,
        "url": url,
        "status": status_code,
        "success": 200 <= status_code < 300,
    }


def get_eventos_disponibles() -> list[str]:
    """Get list of available webhook events."""
    from api.src.integrations.schemas import EVENTOS_DISPONIBLES
    return EVENTOS_DISPONIBLES
