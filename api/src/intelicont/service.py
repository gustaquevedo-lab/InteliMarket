"""InteliCont integration service"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID
import uuid as uuid_mod

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.intelicont.schemas import SYNC_EVENTS


PLAZA_CONTABLE = {
    "PYG": {
        "ventas_contado": {"debe": "1110101", "haber": "4110101", "iva": "2110101"},
        "ventas_credito": {"debe": "1120101", "haber": "4110101", "iva": "2110101"},
        "compras": {"debe": "5110101", "haber": "1110101", "iva_credito": "1120201"},
        "cobro_efectivo": {"debe": "1110101", "haber": "1120101"},
        "cobro_tarjeta": {"debe": "1110102", "haber": "1120101"},
        "pago_proveedor": {"debe": "2110101", "haber": "1110101"},
        "ajuste_stock": {"debe": "5110201", "haber": "1130101"},
    }
}


async def get_sync_config(db: AsyncSession, tenant_id: str) -> dict | None:
    result = await db.execute(
        text("SELECT * FROM intelicont_sync_config WHERE tenant_id = :tenant_id"),
        {"tenant_id": tenant_id},
    )
    row = result.mappings().first()
    return dict(row) if row else None


async def create_sync_config(db: AsyncSession, tenant_id: str, data: dict) -> dict:
    config_id = uuid_mod.uuid4()
    now = datetime.now(timezone.utc)
    await db.execute(
        text("""
            INSERT INTO intelicont_sync_config (id, tenant_id, enabled, auto_sync, sync_interval_minutes, url_base, api_key, created_at, updated_at)
            VALUES (:id, :tenant_id, :enabled, :auto_sync, :interval, :url_base, :api_key, :now, :now)
        """),
        {
            "id": str(config_id),
            "tenant_id": tenant_id,
            "enabled": True,
            "auto_sync": data.get("auto_sync", False),
            "interval": data.get("sync_interval_minutes", 60),
            "url_base": data.get("url_base", ""),
            "api_key": data.get("api_key"),
            "now": now,
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
            text(f"UPDATE intelicont_sync_config SET {set_clause} WHERE tenant_id = :tenant_id"),
            {**updates, "tenant_id": tenant_id},
        )
        await db.flush()
    return await get_sync_config(db, tenant_id)


async def generate_sale_entry(db: AsyncSession, sale_id: str) -> dict | None:
    result = await db.execute(
        text("SELECT * FROM sales WHERE id = :id AND estado = 'confirmado'"),
        {"id": sale_id},
    )
    sale = result.mappings().first()
    if not sale:
        return None

    currency = str(sale.get("moneda", "PYG"))
    cuentas = PLAZA_CONTABLE.get(currency, PLAZA_CONTABLE["PYG"])
    condicion = str(sale.get("condicion", "contado"))
    entry_cuentas = cuentas["ventas_credito"] if condicion == "credito" else cuentas["ventas_contado"]

    entry_id = uuid_mod.uuid4()
    now = datetime.now(timezone.utc)

    total = float(sale["total"] or 0)
    iva_10 = float(sale["iva_10"] or 0)
    iva_5 = float(sale["iva_5"] or 0)
    total_iva = iva_10 + iva_5
    base_gravada = total - total_iva

    await db.execute(
        text("""
            INSERT INTO intelicont_entries (id, fecha, tipo_asiento, descripcion, referencia_tipo, referencia_id, total_debe, total_haber, estado, sync_status, created_at)
            VALUES (:id, :fecha, :tipo, :desc, :ref_tipo, :ref_id, :debe, :haber, :estado, :sync, :created_at)
        """),
        {
            "id": str(entry_id),
            "fecha": sale["fecha"] or now,
            "tipo": "venta",
            "desc": f"Venta {sale['numero']} - {sale.get('tipo_comprobante', 'ticket')}",
            "ref_tipo": "sale",
            "ref_id": sale_id,
            "debe": total,
            "haber": total,
            "estado": "generado",
            "sync": "pendiente",
            "created_at": now,
        },
    )

    lines = []
    if condicion == "credito":
        lines.append((entry_cuentas["debe"], "Cuentas por cobrar", total, 0))
    else:
        lines.append((entry_cuentas["debe"], "Caja/Efectivo", total, 0))
    lines.append((entry_cuentas["haber"], "Ventas", 0, base_gravada))
    if total_iva > 0:
        lines.append((entry_cuentas["iva"], "IVA d\u00e9bito fiscal", 0, total_iva))

    for codigo, nombre, debe, haber in lines:
        await db.execute(
            text("""
                INSERT INTO intelicont_entry_lines (id, entry_id, cuenta_codigo, cuenta_nombre, debe, haber)
                VALUES (:id, :entry, :codigo, :nombre, :debe, :haber)
            """),
            {
                "id": str(uuid_mod.uuid4()),
                "entry": str(entry_id),
                "codigo": codigo,
                "nombre": nombre,
                "debe": debe,
                "haber": haber,
            },
        )

    await db.flush()
    return {"entry_id": str(entry_id), "lines": len(lines)}


async def get_pending_entries(db: AsyncSession, limit: int = 100) -> list[dict]:
    result = await db.execute(
        text("""
            SELECT * FROM intelicont_entries
            WHERE sync_status = 'pendiente'
            ORDER BY created_at ASC
            LIMIT :limit
        """),
        {"limit": limit},
    )
    return [dict(r) for r in result.mappings().all()]


async def get_entries(db: AsyncSession, tenant_id: str | None = None, estado: str | None = None, limit: int = 50) -> list[dict]:
    conditions = ["1=1"]
    params: dict = {"limit": limit}
    if tenant_id:
        conditions.append("e.tenant_id = :tenant_id")
        params["tenant_id"] = tenant_id
    if estado:
        conditions.append("e.estado = :estado")
        params["estado"] = estado

    query = f"""
        SELECT e.*, 
            (SELECT COUNT(*) FROM intelicont_entry_lines WHERE entry_id = e.id) as line_count
        FROM intelicont_entries e
        WHERE {" AND ".join(conditions)}
        ORDER BY e.fecha DESC
        LIMIT :limit
    """
    result = await db.execute(text(query), params)
    return [dict(r) for r in result.mappings().all()]


async def get_entry_lines(db: AsyncSession, entry_id: str) -> list[dict]:
    result = await db.execute(
        text("SELECT * FROM intelicont_entry_lines WHERE entry_id = :id ORDER BY id"),
        {"id": entry_id},
    )
    return [dict(r) for r in result.mappings().all()]


async def sync_entry(db: AsyncSession, entry_id: str, config: dict) -> dict:
    result = await db.execute(
        text("SELECT * FROM intelicont_entries WHERE id = :id"),
        {"id": entry_id},
    )
    entry = result.mappings().first()
    if not entry:
        return {"status": "error", "message": "Asiento no encontrado"}

    lines = await get_entry_lines(db, entry_id)

    payload = {
        "entry_id": str(entry["id"]),
        "fecha": str(entry["fecha"]),
        "tipo_asiento": entry["tipo_asiento"],
        "descripcion": entry["descripcion"],
        "referencia_tipo": entry["referencia_tipo"],
        "referencia_id": str(entry["referencia_id"]),
        "total_debe": float(entry["total_debe"]),
        "total_haber": float(entry["total_haber"]),
        "lineas": [
            {
                "cuenta_codigo": l["cuenta_codigo"],
                "cuenta_nombre": l["cuenta_nombre"],
                "debe": float(l["debe"]),
                "haber": float(l["haber"]),
            }
            for l in lines
        ],
    }

    try:
        import httpx
        url_rest = f"{config['url_base'].rstrip('/')}/api/v1/accounting/entries"
        url_trpc = f"{config['url_base'].rstrip('/')}/api/trpc/journal-entries.create"
        headers = {"Content-Type": "application/json"}
        if config.get("api_key"):
            headers["Authorization"] = f"Bearer {config['api_key']}"

        payload_trpc = {
            "entityId": str(entry["company_id"]),
            "date": str(entry["fecha"]),
            "number": str(entry["reference_id"])[:20],
            "source": "sale",
            "description": entry["descripcion"],
            "lineas": [
                {
                    "accountId": l.get("cuenta_codigo", "4110101"),
                    "debit": int(l["debe"]),
                    "credit": int(l["haber"]),
                    "currencyCode": "PYG",
                    "description": l.get("cuenta_nombre", ""),
                }
                for l in lines
            ],
        }

        async with httpx.AsyncClient(timeout=30) as client:
            try:
                resp = await client.post(url_trpc, json=payload_trpc, headers=headers)
                resp.raise_for_status()
            except Exception:
                resp = await client.post(url_rest, json=payload, headers=headers)
                resp.raise_for_status()

        await db.execute(
            text("""
                UPDATE intelicont_entries
                SET sync_status = 'sincronizado', synced_at = :synced, estado = 'sincronizado'
                WHERE id = :id
            """),
            {"synced": datetime.now(timezone.utc), "id": entry_id},
        )
        await db.flush()

        return {"status": "success", "entry_id": entry_id}
    except Exception as e:
        await db.execute(
            text("UPDATE intelicont_entries SET sync_status = 'error' WHERE id = :id"),
            {"id": entry_id},
        )
        await db.flush()
        return {"status": "error", "message": str(e)}


async def sync_all_pending(db: AsyncSession, config: dict) -> dict:
    entries = await get_pending_entries(db, limit=500)
    synced = 0
    errors = []

    for entry in entries:
        result = await sync_entry(db, str(entry["id"]), config)
        if result["status"] == "success":
            synced += 1
        else:
            errors.append(result.get("message", "Unknown error"))

    if synced > 0:
        await db.execute(
            text("UPDATE intelicont_sync_config SET last_sync_at = :now WHERE tenant_id = :tenant_id"),
            {"now": datetime.now(timezone.utc), "tenant_id": config.get("tenant_id", "")},
        )
        await db.flush()

    return {
        "status": "completed",
        "entries_synced": synced,
        "errors": errors,
        "synced_at": datetime.now(timezone.utc).isoformat(),
    }


def get_available_events() -> list[str]:
    return SYNC_EVENTS
