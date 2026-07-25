"""InteliAudit integration service"""

from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.inteliaudit.schemas import AUDIT_EVENTS


async def get_sync_config(db: AsyncSession, tenant_id: str) -> dict | None:
    result = await db.execute(
        text("SELECT * FROM inteliaudit_sync_config WHERE tenant_id = :tenant_id"),
        {"tenant_id": tenant_id},
    )
    row = result.mappings().first()
    return dict(row) if row else None


async def create_sync_config(db: AsyncSession, tenant_id: str, data: dict) -> dict:
    await db.execute(
        text("""
            INSERT INTO inteliaudit_sync_config (tenant_id, enabled, auto_sync, url_base, api_key, created_at, updated_at)
            VALUES (:tenant_id, true, :auto_sync, :url_base, :api_key, NOW(), NOW())
        """),
        {
            "tenant_id": tenant_id,
            "auto_sync": data.get("auto_sync", False),
            "url_base": data.get("url_base", ""),
            "api_key": data.get("api_key"),
        },
    )
    await db.flush()
    return await get_sync_config(db, tenant_id)


async def update_sync_config(db: AsyncSession, tenant_id: str, data: dict) -> dict | None:
    existing = await get_sync_config(db, tenant_id)
    if not existing:
        return None
    updates = {k: v for k, v in data.items() if v is not None and k not in ("id", "tenant_id", "created_at")}
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc)
        set_clause = ", ".join(f"{k} = :{k}" for k in updates)
        await db.execute(
            text(f"UPDATE inteliaudit_sync_config SET {set_clause} WHERE tenant_id = :tenant_id"),
            {**updates, "tenant_id": tenant_id},
        )
        await db.flush()
    return await get_sync_config(db, tenant_id)


async def record_audit_event(db: AsyncSession, data: dict) -> dict:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        text("""
            INSERT INTO audit_logs (company_id, user_id, accion, entidad, entidad_id, datos_anteriores, datos_nuevos, ip_address, user_agent, created_at)
            VALUES (:company_id, :user_id, :accion, :entidad, :entidad_id, :datos_ant, :datos_new, :ip, :ua, :now)
            RETURNING id
        """),
        {
            "company_id": data.get("company_id"),
            "user_id": data.get("user_id"),
            "accion": data.get("accion", ""),
            "entidad": data.get("entidad", ""),
            "entidad_id": data.get("entidad_id"),
            "datos_ant": data.get("datos_anteriores"),
            "datos_new": data.get("datos_nuevos"),
            "ip": data.get("ip_address"),
            "ua": data.get("user_agent"),
            "now": now,
        },
    )
    await db.flush()
    row = result.mappings().first()
    return {"id": str(row["id"]), "status": "recorded"} if row else {}


async def get_pending_sync_events(db: AsyncSession, limit: int = 200) -> list[dict]:
    result = await db.execute(
        text("""
            SELECT * FROM audit_logs
            WHERE id NOT IN (SELECT entidad_id::uuid FROM webhook_deliveries WHERE evento = 'audit.sync')
            ORDER BY created_at ASC
            LIMIT :limit
        """),
        {"limit": limit},
    )
    return [dict(r) for r in result.mappings().all()]


async def sync_pending_events(db: AsyncSession, config: dict) -> dict:
    events = await get_pending_sync_events(db, limit=500)
    synced = 0
    errors = []

    for event in events:
        payload = {
            "event_id": str(event["id"]),
            "timestamp": str(event["created_at"]),
            "accion": event["accion"],
            "entidad": event["entidad"],
            "entidad_id": str(event["entidad_id"]) if event.get("entidad_id") else None,
            "user_id": str(event["user_id"]) if event.get("user_id") else None,
            "datos_anteriores": event.get("datos_anteriores"),
            "datos_nuevos": event.get("datos_nuevos"),
            "ip_address": str(event.get("ip_address")),
        }

        try:
            import httpx
            url = f"{config['url_base'].rstrip('/')}/api/v1/audit/events"
            headers = {"Content-Type": "application/json"}
            if config.get("api_key"):
                headers["Authorization"] = f"Bearer {config['api_key']}"

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(url, json=payload, headers=headers)
                resp.raise_for_status()

            await db.execute(
                text("""
                    INSERT INTO webhook_deliveries (evento, url, status, payload_size, intento, creado)
                    VALUES ('audit.sync', :url, 200, :size, 1, NOW())
                """),
                {"url": url, "size": len(str(payload))},
            )
            synced += 1
        except Exception as e:
            errors.append(str(event["id"]))

    if synced > 0:
        await db.execute(
            text("UPDATE inteliaudit_sync_config SET updated_at = :now WHERE tenant_id = :tenant_id"),
            {"now": datetime.now(timezone.utc), "tenant_id": config.get("tenant_id", "")},
        )
        await db.flush()

    return {
        "status": "completed",
        "events_synced": synced,
        "errors": errors,
        "synced_at": datetime.now(timezone.utc).isoformat(),
    }


def get_available_events() -> list[str]:
    return AUDIT_EVENTS


async def get_audit_logs(
    db: AsyncSession,
    company_id: str,
    accion: Optional[str] = None,
    entidad: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    where = "WHERE company_id = :company_id"
    params: dict = {"company_id": company_id, "limit": limit, "offset": offset}
    if accion:
        where += " AND accion = :accion"
        params["accion"] = accion
    if entidad:
        where += " AND entidad = :entidad"
        params["entidad"] = entidad
    result = await db.execute(
        text(f"""
            SELECT * FROM audit_logs
            {where}
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """),
        params,
    )
    return [dict(r) for r in result.mappings().all()]


async def push_sale_anomalies(db: AsyncSession, config: dict, company_id: str) -> dict:
    """Push sales with potential anomalies to InteliAudit for review."""
    anomalies = await db.execute(
        text("""
            SELECT s.id, s.numero, s.total, s.fecha, s.estado, s.company_id,
                   c.razon_social, c.ruc
            FROM sales s
            LEFT JOIN customers c ON c.id = s.customer_id
            WHERE s.company_id = :company_id
              AND s.estado = 'confirmado'
              AND s.total > 50000000
              AND s.fecha >= CURRENT_DATE - INTERVAL '30 days'
            ORDER BY s.total DESC
            LIMIT 50
        """),
        {"company_id": company_id},
    )
    rows = [dict(r) for r in anomalies.mappings().all()]
    
    if not rows:
        return {"status": "no_anomalies", "count": 0}
    
    import httpx
    url = f"{config['url_base'].rstrip('/')}/api/auditorias/auto/hallazgos"
    headers = {"Content-Type": "application/json"}
    if config.get("api_key"):
        headers["Authorization"] = f"Bearer {config['api_key']}"
    
    payload = {
        "source": "intelimarket",
        "company_id": company_id,
        "anomalies": [
            {
                "tipo": "venta_monto_alto",
                "venta_id": str(r["id"]),
                "numero": r["numero"],
                "total": float(r["total"]),
                "fecha": str(r["fecha"]),
                "cliente": r["razon_social"] or "Sin cliente",
                "ruc": r["ruc"],
                "descripcion": f"Venta {r['numero']} por Gs. {float(r['total']):,.0f} detectada como monto elevado",
            }
            for r in rows
        ],
    }
    
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
        return {"status": "success", "count": len(rows)}
    except Exception as e:
        return {"status": "error", "count": len(rows), "message": str(e)}
