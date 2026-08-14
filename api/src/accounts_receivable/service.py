from decimal import Decimal
from datetime import datetime, timezone, date, timedelta
import uuid

from sqlalchemy import select, text, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession


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
            ar.id, ar.company_id, ar.customer_id, ar.sale_id, ar.numero_documento,
            ar.fecha_emision, ar.fecha_vencimiento, ar.moneda, ar.monto_original,
            ar.saldo_pendiente, ar.tipo, ar.estado, ar.ultimo_pago, ar.notas_cobranza,
            ar.user_id, ar.created_at, ar.updated_at,
            c.razon_social as customer_name,
            CASE
                WHEN ar.estado <> 'pendiente' THEN 0
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
    # Los documentos pagados nunca cambian su fecha_vencimiento (queda fija en
    # el pasado) — ordenar solo por fecha hacia el frente hacia que, sin filtro
    # de estado, las primeras filas de la pagina sean puro historico ya
    # saldado en vez de la deuda real vigente. Pendientes primero, mas viejos
    # primero dentro de cada grupo (para priorizar la mora mas antigua).
    query = text(query.text + """
        ORDER BY CASE WHEN ar.estado = 'pendiente' THEN 0 ELSE 1 END, ar.fecha_vencimiento ASC NULLS LAST
        LIMIT :limit OFFSET :offset
    """)
    params["limit"] = limit
    params["offset"] = offset

    result = await db.execute(query, params)
    rows = result.fetchall()
    return [dict(row._mapping) for row in rows]


async def count_accounts_receivable(db: AsyncSession, company_id: str, customer_id: str | None = None, estado: str | None = None) -> int:
    query = "SELECT COUNT(*) FROM accounts_receivable ar WHERE ar.company_id = :company_id"
    params = {"company_id": company_id}
    if customer_id:
        query += " AND ar.customer_id = :customer_id"
        params["customer_id"] = customer_id
    if estado:
        query += " AND ar.estado = :estado"
        params["estado"] = estado
    result = await db.execute(text(query), params)
    return result.scalar() or 0


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


async def get_dso(db: AsyncSession, company_id: str, dias: int = 90) -> float | None:
    """Days Sales Outstanding: cuantos dias en promedio tarda la empresa en
    cobrar sus ventas a credito. Formula estandar de la industria:
    DSO = (saldo pendiente total / ventas a credito del periodo) * dias del periodo.
    Usamos sales.condicion='credito' — es el campo real que ya distingue
    ventas a credito de las de contado (5.937 de 122.222 ventas del cliente)."""
    desde = date.today() - timedelta(days=dias)
    ventas_result = await db.execute(
        text("""
            SELECT COALESCE(SUM(total), 0) FROM sales
            WHERE company_id = :company_id AND condicion = 'credito'
            AND estado <> 'anulado' AND fecha >= :desde
        """),
        {"company_id": company_id, "desde": desde},
    )
    ventas_credito = Decimal(str(ventas_result.scalar() or 0))
    if ventas_credito == 0:
        return None

    saldo_result = await db.execute(
        text("SELECT COALESCE(SUM(saldo_pendiente), 0) FROM accounts_receivable WHERE company_id = :company_id AND estado = 'pendiente'"),
        {"company_id": company_id},
    )
    saldo_pendiente = Decimal(str(saldo_result.scalar() or 0))
    return float((saldo_pendiente / ventas_credito) * dias)


async def get_receivable_summary(db: AsyncSession, company_id: str) -> dict:
    today = date.today()
    query = text("""
        SELECT
            COUNT(*) as total,
            COALESCE(SUM(saldo_pendiente), 0) as total_pendiente,
            COALESCE(SUM(CASE WHEN estado = 'pagado' THEN 1 ELSE 0 END), 0) as pagados,
            COALESCE(SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END), 0) as pendientes,
            COALESCE(SUM(CASE WHEN estado = 'pendiente' AND fecha_vencimiento < :today THEN 1 ELSE 0 END), 0) as vencidos,
            COALESCE(SUM(CASE WHEN estado = 'pendiente' AND fecha_vencimiento < :today THEN saldo_pendiente ELSE 0 END), 0) as monto_vencido
        FROM accounts_receivable
        WHERE company_id = :company_id
    """)
    result = await db.execute(query, {"company_id": company_id, "today": today})
    row = result.fetchone()
    summary = dict(row._mapping) if row else {
        "total": 0, "total_pendiente": 0, "pagados": 0,
        "pendientes": 0, "vencidos": 0, "monto_vencido": 0,
    }
    summary["dso"] = await get_dso(db, company_id)
    return summary


# ── Pagos con reparto entre facturas ──────────────────────────────────

async def list_customer_pending_documents(db: AsyncSession, company_id: str, customer_id: str) -> list[dict]:
    """Documentos pendientes de un cliente, para el modal de registrar pago —
    ordenados por vencimiento (mas viejo primero) para facilitar el reparto."""
    result = await db.execute(
        text("""
            SELECT id, numero_documento, fecha_emision, fecha_vencimiento, moneda,
                   monto_original, saldo_pendiente,
                   CASE WHEN fecha_vencimiento IS NULL THEN 0 ELSE (CURRENT_DATE - fecha_vencimiento)::int END as dias_mora
            FROM accounts_receivable
            WHERE company_id = :company_id AND customer_id = :customer_id AND estado = 'pendiente'
            ORDER BY fecha_vencimiento ASC NULLS LAST
        """),
        {"company_id": company_id, "customer_id": customer_id},
    )
    return [dict(row._mapping) for row in result.fetchall()]


async def create_receivable_payment(db: AsyncSession, company_id: str, data, registrado_por: str | None) -> dict:
    """Registra un pago de un cliente y lo reparte entre los documentos que
    indique — a diferencia de apply_payment_to_receivable (atado 1 a 1 a una
    venta), esto permite que un solo pago cubra varias facturas, que es como
    se cobra en la practica. Valida que el reparto sume exactamente el monto
    total del pago y que cada documento tenga saldo suficiente."""
    total_allocado = sum(a.monto for a in data.allocations)
    if total_allocado != data.monto_total:
        return {"error": f"El reparto ({total_allocado}) no coincide con el monto total del pago ({data.monto_total})"}

    ids = [str(a.accounts_receivable_id) for a in data.allocations]
    result = await db.execute(
        text("""
            SELECT id, saldo_pendiente, customer_id FROM accounts_receivable
            WHERE id = ANY(:ids) AND company_id = :company_id
        """),
        {"ids": ids, "company_id": company_id},
    )
    docs = {str(r.id): r for r in result.fetchall()}

    for alloc in data.allocations:
        doc = docs.get(str(alloc.accounts_receivable_id))
        if not doc:
            return {"error": f"Documento {alloc.accounts_receivable_id} no encontrado"}
        if str(doc.customer_id) != str(data.customer_id):
            return {"error": "Todos los documentos deben ser del mismo cliente"}
        if alloc.monto > Decimal(str(doc.saldo_pendiente)):
            return {"error": f"El monto asignado a {alloc.accounts_receivable_id} supera el saldo pendiente de ese documento"}

    payment_id = uuid.uuid4()
    await db.execute(
        text("""
            INSERT INTO receivable_payments
                (id, company_id, customer_id, monto_total, moneda, forma_pago, referencia, fecha, observaciones, registrado_por)
            VALUES (:id, :company_id, :customer_id, :monto_total, :moneda, :forma_pago, :referencia, :fecha, :observaciones, :registrado_por)
        """),
        {
            "id": payment_id, "company_id": company_id, "customer_id": str(data.customer_id),
            "monto_total": float(data.monto_total), "moneda": data.moneda, "forma_pago": data.forma_pago,
            "referencia": data.referencia, "fecha": data.fecha or date.today(),
            "observaciones": data.observaciones, "registrado_por": registrado_por,
        },
    )

    aplicados = []
    for alloc in data.allocations:
        doc = docs[str(alloc.accounts_receivable_id)]
        nuevo_saldo = Decimal(str(doc.saldo_pendiente)) - alloc.monto
        nuevo_estado = "pagado" if nuevo_saldo <= 0 else "pendiente"
        await db.execute(
            text("""
                UPDATE accounts_receivable
                SET saldo_pendiente = :saldo, estado = :estado, ultimo_pago = NOW()
                WHERE id = :id
            """),
            {"saldo": float(max(Decimal("0"), nuevo_saldo)), "estado": nuevo_estado, "id": str(alloc.accounts_receivable_id)},
        )
        await db.execute(
            text("""
                INSERT INTO receivable_payment_allocations (receivable_payment_id, accounts_receivable_id, monto)
                VALUES (:payment_id, :ar_id, :monto)
            """),
            {"payment_id": payment_id, "ar_id": str(alloc.accounts_receivable_id), "monto": float(alloc.monto)},
        )
        aplicados.append({"accounts_receivable_id": str(alloc.accounts_receivable_id), "monto": float(alloc.monto), "nuevo_saldo": float(max(Decimal('0'), nuevo_saldo)), "nuevo_estado": nuevo_estado})

    await db.flush()
    return {"id": str(payment_id), "monto_total": float(data.monto_total), "allocations": aplicados}


async def list_payments_for_document(db: AsyncSession, accounts_receivable_id: str) -> list[dict]:
    result = await db.execute(
        text("""
            SELECT rp.id, rp.fecha, rp.forma_pago, rp.referencia, rp.observaciones, rpa.monto, rp.created_at
            FROM receivable_payment_allocations rpa
            JOIN receivable_payments rp ON rp.id = rpa.receivable_payment_id
            WHERE rpa.accounts_receivable_id = :ar_id
            ORDER BY rp.fecha DESC, rp.created_at DESC
        """),
        {"ar_id": accounts_receivable_id},
    )
    return [dict(row._mapping) for row in result.fetchall()]


async def list_payments_for_customer(db: AsyncSession, company_id: str, customer_id: str) -> list[dict]:
    result = await db.execute(
        text("""
            SELECT rp.id, rp.fecha, rp.monto_total, rp.forma_pago, rp.referencia, rp.observaciones, rp.created_at,
                   COALESCE(json_agg(json_build_object('accounts_receivable_id', rpa.accounts_receivable_id, 'numero_documento', ar.numero_documento, 'monto', rpa.monto)) FILTER (WHERE rpa.id IS NOT NULL), '[]') as allocations
            FROM receivable_payments rp
            LEFT JOIN receivable_payment_allocations rpa ON rpa.receivable_payment_id = rp.id
            LEFT JOIN accounts_receivable ar ON ar.id = rpa.accounts_receivable_id
            WHERE rp.company_id = :company_id AND rp.customer_id = :customer_id
            GROUP BY rp.id
            ORDER BY rp.fecha DESC, rp.created_at DESC
        """),
        {"company_id": company_id, "customer_id": customer_id},
    )
    rows = []
    for row in result.fetchall():
        d = dict(row._mapping)
        if isinstance(d["allocations"], str):
            import json as _json
            d["allocations"] = _json.loads(d["allocations"])
        rows.append(d)
    return rows


# ── Reportes (Excel / PDF) ──────────────────────────────────────────────

async def get_aging_for_report(db: AsyncSession, company_id: str, fecha_desde: date | None, fecha_hasta: date | None) -> dict:
    """Igual a get_aging_report, pero acota los documentos incluidos por fecha
    de emision (para el reporte exportable con rango de fechas) — la mora se
    sigue calculando contra hoy, es el mismo criterio que ya usa la pantalla."""
    today = date.today()
    query = """
        SELECT
            ar.id, ar.customer_id, c.razon_social as customer_name, ar.sale_id,
            ar.numero_documento, ar.fecha_emision, ar.fecha_vencimiento, ar.moneda,
            ar.monto_original, ar.saldo_pendiente, ar.tipo, ar.estado,
            CASE WHEN ar.fecha_vencimiento IS NULL THEN 0 ELSE (DATE(:today) - ar.fecha_vencimiento)::int END as dias_mora
        FROM accounts_receivable ar
        LEFT JOIN customers c ON c.id = ar.customer_id
        WHERE ar.company_id = :company_id AND ar.estado = 'pendiente'
    """
    params = {"company_id": company_id, "today": today}
    if fecha_desde:
        query += " AND ar.fecha_emision >= :fecha_desde"
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        query += " AND ar.fecha_emision <= :fecha_hasta"
        params["fecha_hasta"] = fecha_hasta
    query += " ORDER BY ar.fecha_vencimiento ASC NULLS LAST"

    result = await db.execute(text(query), params)
    rows = result.fetchall()

    total_pendiente = Decimal("0")
    current = days_1_30 = days_31_60 = days_61_90 = days_91_plus = Decimal("0")
    customer_aging: dict = {}
    for row in rows:
        saldo = Decimal(str(row.saldo_pendiente))
        dias = row.dias_mora or 0
        total_pendiente += saldo
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
                "customer_id": cid, "customer_name": row.customer_name or "N/A",
                "saldo_total": Decimal("0"), "current": Decimal("0"), "days_1_30": Decimal("0"),
                "days_31_60": Decimal("0"), "days_61_90": Decimal("0"), "days_91_plus": Decimal("0"),
                "total_documentos": 0,
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

    return {
        "fecha_desde": fecha_desde, "fecha_hasta": fecha_hasta,
        "total_pendiente": total_pendiente, "cantidad_documentos": len(rows),
        "current": current, "days_1_30": days_1_30, "days_31_60": days_31_60,
        "days_61_90": days_61_90, "days_91_plus": days_91_plus,
        "por_clientes": sorted(customer_aging.values(), key=lambda x: x["saldo_total"], reverse=True),
        "documentos": [dict(row._mapping) for row in rows],
    }


async def list_payments_period(db: AsyncSession, company_id: str, fecha_desde: date | None, fecha_hasta: date | None) -> list[dict]:
    """Cobranzas del periodo — todos los pagos registrados en AR (con reparto
    entre facturas), no solo de un cliente puntual. Base del reporte de cobranzas."""
    query = """
        SELECT rp.id, rp.fecha, rp.monto_total, rp.moneda, rp.forma_pago, rp.referencia,
               rp.observaciones, rp.created_at, c.razon_social as customer_name,
               COALESCE(json_agg(json_build_object('numero_documento', ar.numero_documento, 'monto', rpa.monto)) FILTER (WHERE rpa.id IS NOT NULL), '[]') as allocations
        FROM receivable_payments rp
        LEFT JOIN customers c ON c.id = rp.customer_id
        LEFT JOIN receivable_payment_allocations rpa ON rpa.receivable_payment_id = rp.id
        LEFT JOIN accounts_receivable ar ON ar.id = rpa.accounts_receivable_id
        WHERE rp.company_id = :company_id
    """
    params = {"company_id": company_id}
    if fecha_desde:
        query += " AND rp.fecha >= :fecha_desde"
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        query += " AND rp.fecha <= :fecha_hasta"
        params["fecha_hasta"] = fecha_hasta
    query += " GROUP BY rp.id, c.razon_social ORDER BY rp.fecha DESC, rp.created_at DESC"

    result = await db.execute(text(query), params)
    rows = []
    for row in result.fetchall():
        d = dict(row._mapping)
        if isinstance(d["allocations"], str):
            import json as _json
            d["allocations"] = _json.loads(d["allocations"])
        rows.append(d)
    return rows
