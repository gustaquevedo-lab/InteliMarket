from decimal import Decimal
from datetime import datetime, timezone, date, timedelta
import uuid

from sqlalchemy import select, text, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession


# Algunos tenants (ej. conector Gonzalito) no pueblan accounts_receivable a nivel
# documento: su legacy solo da un saldo agregado por cliente, sin fecha de
# vencimiento ni número de documento. Cuando ese es el caso, estas funciones caen
# a customer_accounts.saldo_actual. Como no hay fecha de vencimiento real, todo el
# saldo se reporta como "Al dia" (dias_mora=0) en vez de inventar una mora falsa.

async def _customer_accounts_fallback_rows(db: AsyncSession, company_id: str):
    query = text("""
        SELECT ca.id, ca.customer_id, c.razon_social as customer_name, ca.saldo_actual
        FROM customer_accounts ca
        JOIN customers c ON c.id = ca.customer_id
        WHERE c.company_id = :company_id AND ca.saldo_actual > 0
        ORDER BY ca.saldo_actual DESC
    """)
    result = await db.execute(query, {"company_id": company_id})
    return result.fetchall()


async def get_aging_report(db: AsyncSession, company_id: str) -> dict:
    today = date.today()
    query = text("""
        SELECT
            ar.id,
            ar.customer_id,
            c.razon_social as customer_name,
            ar.sale_id,
            ar.numero_documento,
            ar.fecha_emision,
            ar.fecha_vencimiento,
            ar.moneda,
            ar.monto_original,
            ar.saldo_pendiente,
            ar.tipo,
            ar.estado,
            CASE
                WHEN ar.fecha_vencimiento IS NULL THEN 0
                ELSE (DATE(:today) - ar.fecha_vencimiento)::int
            END as dias_mora
        FROM accounts_receivable ar
        LEFT JOIN customers c ON c.id = ar.customer_id
        WHERE ar.company_id = :company_id
        AND ar.estado = 'pendiente'
        ORDER BY ar.fecha_vencimiento ASC NULLS LAST
    """)
    result = await db.execute(query, {"company_id": company_id, "today": today})
    rows = result.fetchall()

    if not rows:
        fallback = await _customer_accounts_fallback_rows(db, company_id)
        total_pendiente = sum((Decimal(str(r.saldo_actual)) for r in fallback), Decimal("0"))
        total = total_pendiente or Decimal("1")
        buckets = [
            {"rango": "Al dia", "monto": total_pendiente, "cantidad": len(fallback), "porcentaje": (total_pendiente / total * 100).quantize(Decimal("1")) if fallback else Decimal("0")},
            {"rango": "1-30 dias", "monto": Decimal("0"), "cantidad": 0, "porcentaje": Decimal("0")},
            {"rango": "31-60 dias", "monto": Decimal("0"), "cantidad": 0, "porcentaje": Decimal("0")},
            {"rango": "61-90 dias", "monto": Decimal("0"), "cantidad": 0, "porcentaje": Decimal("0")},
            {"rango": "+90 dias", "monto": Decimal("0"), "cantidad": 0, "porcentaje": Decimal("0")},
        ]
        por_clientes = [
            {
                "customer_id": str(r.customer_id),
                "customer_name": r.customer_name or "N/A",
                "saldo_total": Decimal(str(r.saldo_actual)),
                "current": Decimal(str(r.saldo_actual)),
                "days_1_30": Decimal("0"), "days_31_60": Decimal("0"),
                "days_61_90": Decimal("0"), "days_91_plus": Decimal("0"),
                "total_documentos": 1,
            }
            for r in fallback
        ]
        return {
            "total_pendiente": total_pendiente,
            "cantidad_documentos": len(fallback),
            "buckets": buckets,
            "por_clientes": por_clientes,
            "fecha": today,
        }

    total_pendiente = Decimal("0")
    current = Decimal("0")
    days_1_30 = Decimal("0")
    days_31_60 = Decimal("0")
    days_61_90 = Decimal("0")
    days_91_plus = Decimal("0")
    cantidad_total = len(rows)
    customer_aging = {}

    for row in rows:
        saldo = Decimal(str(row.saldo_pendiente))
        total_pendiente += saldo
        dias = row.dias_mora or 0

        if dias <= 0:
            current += saldo
        elif dias <= 30:
            days_1_30 += saldo
        elif dias <= 60:
            days_31_60 += saldo
        elif dias <= 90:
            days_61_90 += saldo
        else:
            days_91_plus += saldo

        cid = str(row.customer_id)
        if cid not in customer_aging:
            customer_aging[cid] = {
                "customer_id": cid,
                "customer_name": row.customer_name or "N/A",
                "saldo_total": Decimal("0"),
                "current": Decimal("0"), "days_1_30": Decimal("0"),
                "days_31_60": Decimal("0"), "days_61_90": Decimal("0"),
                "days_91_plus": Decimal("0"), "total_documentos": 0,
            }
        ca = customer_aging[cid]
        ca["saldo_total"] += saldo
        ca["total_documentos"] += 1
        if dias <= 0:
            ca["current"] += saldo
        elif dias <= 30:
            ca["days_1_30"] += saldo
        elif dias <= 60:
            ca["days_31_60"] += saldo
        elif dias <= 90:
            ca["days_61_90"] += saldo
        else:
            ca["days_91_plus"] += saldo

    total = total_pendiente or Decimal("1")
    buckets = [
        {"rango": "Al dia", "monto": current, "cantidad": sum(1 for r in rows if (r.dias_mora or 0) <= 0), "porcentaje": (current / total * 100).quantize(Decimal("1"))},
        {"rango": "1-30 dias", "monto": days_1_30, "cantidad": sum(1 for r in rows if 1 <= (r.dias_mora or 0) <= 30), "porcentaje": (days_1_30 / total * 100).quantize(Decimal("1"))},
        {"rango": "31-60 dias", "monto": days_31_60, "cantidad": sum(1 for r in rows if 31 <= (r.dias_mora or 0) <= 60), "porcentaje": (days_31_60 / total * 100).quantize(Decimal("1"))},
        {"rango": "61-90 dias", "monto": days_61_90, "cantidad": sum(1 for r in rows if 61 <= (r.dias_mora or 0) <= 90), "porcentaje": (days_61_90 / total * 100).quantize(Decimal("1"))},
        {"rango": "+90 dias", "monto": days_91_plus, "cantidad": sum(1 for r in rows if (r.dias_mora or 0) > 90), "porcentaje": (days_91_plus / total * 100).quantize(Decimal("1"))},
    ]

    return {
        "total_pendiente": total_pendiente,
        "cantidad_documentos": cantidad_total,
        "buckets": buckets,
        "por_clientes": sorted(customer_aging.values(), key=lambda x: x["saldo_total"], reverse=True),
        "fecha": today,
    }


async def get_accounts_receivable(
    db: AsyncSession, company_id: str, customer_id: str | None = None,
    estado: str | None = None, limit: int = 50, offset: int = 0,
) -> list[dict]:
    today = date.today()
    query = text("""
        SELECT
            ar.*,
            c.razon_social as customer_name,
            CASE
                WHEN ar.fecha_vencimiento IS NULL THEN 0
                ELSE (DATE(:today) - ar.fecha_vencimiento)::int
            END as dias_mora
        FROM accounts_receivable ar
        LEFT JOIN customers c ON c.id = ar.customer_id
        WHERE ar.company_id = :company_id
    """)
    params = {"company_id": company_id, "today": today}
    if customer_id:
        query = text(query.text + " AND ar.customer_id = :customer_id")
        params["customer_id"] = customer_id
    if estado:
        query = text(query.text + " AND ar.estado = :estado")
        params["estado"] = estado
    query = text(query.text + " ORDER BY ar.fecha_vencimiento ASC NULLS LAST LIMIT :limit OFFSET :offset")
    params["limit"] = limit
    params["offset"] = offset

    result = await db.execute(query, params)
    rows = result.fetchall()
    if rows:
        return [dict(row._mapping) for row in rows]

    if estado and estado != "pendiente":
        return []

    fallback = await _customer_accounts_fallback_rows(db, company_id)
    if customer_id:
        fallback = [r for r in fallback if str(r.customer_id) == customer_id]
    fallback = fallback[offset:offset + limit]
    return [
        {
            "id": str(r.id),
            "company_id": company_id,
            "customer_id": str(r.customer_id),
            "customer_name": r.customer_name or "N/A",
            "sale_id": None,
            "numero_documento": None,
            "fecha_emision": None,
            "fecha_vencimiento": None,
            "moneda": "PYG",
            "monto_original": r.saldo_actual,
            "saldo_pendiente": r.saldo_actual,
            "tipo": "saldo_cuenta",
            "estado": "pendiente",
            "dias_mora": 0,
        }
        for r in fallback
    ]


async def create_accounts_receivable_for_sale(
    db: AsyncSession, company_id: str, customer_id: str, sale_id: str,
    total: Decimal, numero: str, fecha_vencimiento: date | None = None,
    tipo: str = "factura",
) -> None:
    if not fecha_vencimiento:
        fecha_vencimiento = date.today() + timedelta(days=30)

    await db.execute(
        text("""
            INSERT INTO accounts_receivable
                (company_id, customer_id, sale_id, numero_documento, fecha_emision,
                 fecha_vencimiento, moneda, monto_original, saldo_pendiente, tipo, estado)
            VALUES
                (:company_id, :customer_id, :sale_id, :numero_documento, NOW(),
                 :fecha_vencimiento, 'PYG', :monto, :monto, :tipo, 'pendiente')
        """),
        {
            "company_id": company_id,
            "customer_id": customer_id,
            "sale_id": sale_id,
            "numero_documento": numero,
            "fecha_vencimiento": fecha_vencimiento,
            "monto": float(total),
            "tipo": tipo,
        }
    )
    await db.flush()


async def apply_payment_to_receivable(
    db: AsyncSession, company_id: str, sale_id: str, monto: Decimal,
) -> dict:
    result = await db.execute(
        text("""
            SELECT id, saldo_pendiente FROM accounts_receivable
            WHERE company_id = :company_id AND sale_id = :sale_id AND estado = 'pendiente'
            ORDER BY fecha_vencimiento ASC
            LIMIT 1
        """),
        {"company_id": company_id, "sale_id": sale_id},
    )
    row = result.fetchone()
    if not row:
        return {"error": "Cuenta por cobrar no encontrada"}

    nuevo_saldo = max(Decimal("0"), Decimal(str(row.saldo_pendiente)) - monto)
    nuevo_estado = "pagado" if nuevo_saldo == 0 else "pendiente"

    await db.execute(
        text("""
            UPDATE accounts_receivable
            SET saldo_pendiente = :saldo, estado = :estado, ultimo_pago = NOW()
            WHERE id = :id
        """),
        {"saldo": float(nuevo_saldo), "estado": nuevo_estado, "id": row.id},
    )
    await db.flush()

    return {
        "receivable_id": str(row.id),
        "saldo_anterior": float(row.saldo_pendiente),
        "monto_aplicado": float(monto),
        "saldo_pendiente": float(nuevo_saldo),
        "estado": nuevo_estado,
    }


async def get_receivable_summary(db: AsyncSession, company_id: str) -> dict:
    today = date.today()
    query = text("""
        SELECT
            COUNT(*) as total,
            COALESCE(SUM(saldo_pendiente), 0) as total_pendiente,
            COALESCE(SUM(CASE WHEN estado = 'pagado' THEN 1 ELSE 0 END), 0) as pagados,
            COALESCE(SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END), 0) as pendientes,
            COALESCE(SUM(CASE WHEN estado = 'vencido' THEN 1 ELSE 0 END), 0) as vencidos,
            COALESCE(SUM(CASE WHEN estado = 'pendiente' AND fecha_vencimiento < :today THEN saldo_pendiente ELSE 0 END), 0) as monto_vencido
        FROM accounts_receivable
        WHERE company_id = :company_id
    """)
    result = await db.execute(query, {"company_id": company_id, "today": today})
    row = result.fetchone()
    if row and row.total:
        return dict(row._mapping)

    fallback = await _customer_accounts_fallback_rows(db, company_id)
    total_pendiente = sum((Decimal(str(r.saldo_actual)) for r in fallback), Decimal("0"))
    return {
        "total": len(fallback),
        "total_pendiente": total_pendiente,
        "pagados": 0,
        "pendientes": len(fallback),
        "vencidos": 0,
        "monto_vencido": 0,
    }
