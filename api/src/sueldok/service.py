"""SueldOK integration service"""

from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.sueldok.schemas import SYNC_EVENTS


async def get_sync_config(db: AsyncSession, tenant_id: str) -> dict | None:
    result = await db.execute(
        text("SELECT * FROM sueldok_sync_config WHERE tenant_id = :tenant_id"),
        {"tenant_id": tenant_id},
    )
    row = result.mappings().first()
    return dict(row) if row else None


async def create_sync_config(db: AsyncSession, tenant_id: str, data: dict) -> dict:
    await db.execute(
        text("""
            INSERT INTO sueldok_sync_config (tenant_id, enabled, auto_sync, url_base, api_key, created_at, updated_at)
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
            text(f"UPDATE sueldok_sync_config SET {set_clause} WHERE tenant_id = :tenant_id"),
            {**updates, "tenant_id": tenant_id},
        )
        await db.flush()
    return await get_sync_config(db, tenant_id)


async def sync_payroll_data(db: AsyncSession, config: dict, payload: dict) -> dict:
    try:
        import httpx
        url = f"{config['url_base'].rstrip('/')}/api/v1/payroll/sync"
        headers = {"Content-Type": "application/json"}
        if config.get("api_key"):
            headers["Authorization"] = f"Bearer {config['api_key']}"

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            return {"status": "success", "response": resp.json()}
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def sync_sales_to_payroll(db: AsyncSession, config: dict, company_id: str, periodo: str) -> dict:
    result = await db.execute(
        text("""
            SELECT
                s.user_id,
                COUNT(*) as total_ventas,
                COALESCE(SUM(s.total), 0) as monto_total,
                COALESCE(SUM(s.iva_10), 0) as iva_10,
                COALESCE(SUM(s.iva_5), 0) as iva_5
            FROM sales s
            WHERE s.company_id = :company_id
                AND s.estado = 'confirmado'
                AND s.fecha >= :periodo_inicio
                AND s.fecha <= :periodo_fin
            GROUP BY s.user_id
        """),
        {
            "company_id": company_id,
            "periodo_inicio": f"{periodo}-01",
            "periodo_fin": f"{periodo}-31",
        },
    )
    sales_data = [dict(r) for r in result.mappings().all()]

    payroll_data = {
        "periodo": periodo,
        "company_id": company_id,
        "comisiones": [
            {
                "user_id": str(s["user_id"]),
                "ventas_count": s["total_ventas"],
                "monto_ventas": float(s["monto_total"]),
                "comision": float(s["monto_total"]) * 0.02,
            }
            for s in sales_data
        ],
    }

    return await sync_payroll_data(db, config, payroll_data)


def get_available_events() -> list[str]:
    return SYNC_EVENTS
