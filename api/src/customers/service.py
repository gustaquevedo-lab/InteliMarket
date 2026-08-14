"""Customer service — CRUD & Deuda Consolidada (4 fuentes)."""

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Dict, Any, List
import uuid

from api.src.customers.models import Customer
from api.src.customers.schemas import CustomerCreate, CustomerUpdate


async def create_customer(db: AsyncSession, data: CustomerCreate) -> Customer:
    customer = Customer(**data.model_dump())
    db.add(customer)
    await db.flush()
    await db.refresh(customer)
    return customer


async def get_customer(db: AsyncSession, customer_id: str) -> Customer | None:
    result = await db.execute(select(Customer).where(Customer.id == uuid.UUID(customer_id)))
    return result.scalar_one_or_none()


async def get_customer_by_ruc(db: AsyncSession, company_id: str, ruc: str) -> Customer | None:
    result = await db.execute(
        select(Customer).where(Customer.company_id == company_id, Customer.ruc == ruc)
    )
    return result.scalar_one_or_none()


async def list_customers(
    db: AsyncSession,
    company_id: str,
    search: str | None = None,
    activo: bool | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Customer]:
    query = select(Customer).where(Customer.company_id == company_id)
    if search:
        query = query.where(
            (Customer.razon_social.ilike(f"%{search}%")) |
            (Customer.ruc.ilike(f"%{search}%")) |
            (Customer.ci.ilike(f"%{search}%"))
        )
    if activo is not None:
        query = query.where(Customer.activo == activo)
    query = query.order_by(Customer.razon_social).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_customer(db: AsyncSession, customer_id: str, data: CustomerUpdate) -> Customer | None:
    customer = await get_customer(db, customer_id)
    if not customer:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(customer, key, value)
    await db.flush()
    await db.refresh(customer)
    return customer


async def delete_customer(db: AsyncSession, customer_id: str) -> bool:
    customer = await get_customer(db, customer_id)
    if not customer:
        return False
    await db.delete(customer)
    await db.flush()
    return True


# ─── DEUDA TOTAL CONSOLIDADA (4 FUENTES) ─────────────────────────────────────

async def get_customer_consolidated_debt(
    db: AsyncSession, company_id: str, customer_id: str
) -> Dict[str, Any]:
    cid = uuid.UUID(company_id)
    cust_id = uuid.UUID(customer_id)

    # 1. Customer Basic & Credit Info
    cust_res = await db.execute(
        select(Customer).where(Customer.id == cust_id, Customer.company_id == cid)
    )
    customer = cust_res.scalar_one_or_none()
    if not customer:
        return {}

    # 2. Aggregated debt query
    query = text("""
        SELECT 
            COALESCE(ar.facturas_pendiente, 0) as facturas_pendiente,
            COALESCE(ar.monto_vencido, 0) as monto_vencido,
            COALESCE(ar.dias_mora_max, 0) as dias_mora_max,
            COALESCE(ar.cantidad_facturas, 0) as cantidad_facturas,
            COALESCE(ch.cheques_cartera, 0) as cheques_cartera,
            COALESCE(ch.cheques_rechazados, 0) as cheques_rechazados,
            COALESCE(ch.pagares, 0) as pagares,
            COALESCE(ca.limite_credito, c.credito_limite, 0) as limite_credito,
            COALESCE(ca.saldo_utilizado, c.credito_usado, 0) as saldo_utilizado,
            COALESCE(ca.saldo_disponible, 0) as saldo_disponible
        FROM customers c
        LEFT JOIN (
            SELECT customer_id,
                   SUM(saldo_pendiente) as facturas_pendiente,
                   SUM(CASE WHEN fecha_vencimiento < CURRENT_DATE THEN saldo_pendiente ELSE 0 END) as monto_vencido,
                   MAX(CASE WHEN fecha_vencimiento < CURRENT_DATE THEN (CURRENT_DATE - fecha_vencimiento) ELSE 0 END) as dias_mora_max,
                   COUNT(id) as cantidad_facturas
            FROM accounts_receivable
            WHERE estado = 'pendiente' AND customer_id = :cust_id AND saldo_pendiente > 0
            GROUP BY customer_id
        ) ar ON ar.customer_id = c.id
        LEFT JOIN (
            SELECT customer_id,
                   SUM(CASE WHEN tipo = 'cheque' AND estado IN ('cartera', 'depositado') THEN monto ELSE 0 END) as cheques_cartera,
                   SUM(CASE WHEN tipo = 'cheque' AND estado = 'rechazado' THEN monto ELSE 0 END) as cheques_rechazados,
                   SUM(CASE WHEN tipo = 'pagare' AND estado IN ('cartera', 'depositado', 'rechazado') THEN monto ELSE 0 END) as pagares
            FROM checks
            WHERE customer_id = :cust_id
            GROUP BY customer_id
        ) ch ON ch.customer_id = c.id
        LEFT JOIN credit_accounts ca ON ca.customer_id = c.id
        WHERE c.id = :cust_id AND c.company_id = :company_id
    """)

    res = await db.execute(query, {"cust_id": cust_id, "company_id": cid})
    row = res.fetchone()

    # 3. Fetch detailed invoices
    inv_res = await db.execute(
        text("""
            SELECT id, numero_documento, fecha_emision, fecha_vencimiento, monto_original, saldo_pendiente,
                   CASE WHEN fecha_vencimiento < CURRENT_DATE THEN (CURRENT_DATE - fecha_vencimiento)::int ELSE 0 END as dias_mora
            FROM accounts_receivable
            WHERE customer_id = :cust_id AND estado = 'pendiente' AND saldo_pendiente > 0
            ORDER BY fecha_vencimiento ASC NULLS LAST
            LIMIT 100
        """),
        {"cust_id": cust_id},
    )
    facturas_detalle = [
        {
            "id": str(r.id),
            "numero_documento": r.numero_documento,
            "fecha_emision": str(r.fecha_emision) if r.fecha_emision else "-",
            "fecha_vencimiento": str(r.fecha_vencimiento) if r.fecha_vencimiento else "-",
            "monto_original": float(r.monto_original or 0),
            "saldo_pendiente": float(r.saldo_pendiente or 0),
            "dias_mora": int(r.dias_mora or 0),
        }
        for r in inv_res.fetchall()
    ]

    # 4. Fetch detailed cheques & pagares
    ch_res = await db.execute(
        text("""
            SELECT id, numero, banco, fecha_vencimiento, monto, tipo, estado, titular
            FROM checks
            WHERE customer_id = :cust_id
            ORDER BY fecha_vencimiento DESC NULLS LAST
            LIMIT 50
        """),
        {"cust_id": cust_id},
    )
    cheques_detalle = [
        {
            "id": str(r.id),
            "numero": r.numero,
            "banco": r.banco or "S/D",
            "fecha_vencimiento": str(r.fecha_vencimiento) if r.fecha_vencimiento else "-",
            "monto": float(r.monto or 0),
            "tipo": r.tipo,
            "estado": r.estado,
            "titular": r.titular or "-",
        }
        for r in ch_res.fetchall()
    ]

    # 5. Top 6 Products Purchased
    q_prod = text("""
        SELECT p.sku, p.nombre, SUM(si.cantidad) as unidades, SUM(si.total) as total_gs
        FROM sales s
        JOIN sale_items si ON si.sale_id = s.id
        JOIN products p ON p.id = si.product_id
        WHERE s.customer_id = :cust_id
        GROUP BY p.sku, p.nombre
        ORDER BY total_gs DESC
        LIMIT 6
    """)
    prod_rows = (await db.execute(q_prod, {"cust_id": cust_id})).fetchall()
    top_productos = [
        {
            "sku": r.sku or "-",
            "nombre": r.nombre,
            "unidades": float(r.unidades or 0),
            "total_gs": float(r.total_gs or 0),
        }
        for r in prod_rows
    ]

    # 6. Monthly Purchase Trend (Seasonality / Periods)
    q_trend = text("""
        SELECT TO_CHAR(s.fecha, 'YYYY-MM') as mes, COUNT(s.id) as compras, SUM(s.total) as total_gs
        FROM sales s
        WHERE s.customer_id = :cust_id AND s.fecha >= '2025-01-01'
        GROUP BY TO_CHAR(s.fecha, 'YYYY-MM')
        ORDER BY mes ASC
    """)
    trend_rows = (await db.execute(q_trend, {"cust_id": cust_id})).fetchall()
    estacionalidad = [
        {
            "mes": r.mes,
            "compras": int(r.compras or 0),
            "total_gs": float(r.total_gs or 0),
        }
        for r in trend_rows
    ]

    # 7. Assigned Sales Rep (Vendedor de ruta)
    q_rep = text("""
        SELECT sr.funcionario_codigo as codigo, sr.nombre, sr.rol, sr.rama, COUNT(s.id) as ventas_atendidas
        FROM sales s
        JOIN sales_reps sr ON sr.funcionario_codigo = s.vendedor_codigo
        WHERE s.customer_id = :cust_id AND s.vendedor_codigo IS NOT NULL
        GROUP BY sr.funcionario_codigo, sr.nombre, sr.rol, sr.rama
        ORDER BY ventas_atendidas DESC
        LIMIT 1
    """)
    rep_row = (await db.execute(q_rep, {"cust_id": cust_id})).fetchone()
    vendedor_asignado = {
        "codigo": rep_row.codigo if rep_row else "V-01",
        "nombre": rep_row.nombre if rep_row else "Equipo Comercial Distribuidora",
        "rol": rep_row.rol if rep_row else "vendedor",
        "rama": rep_row.rama if rep_row else "General",
        "ventas_atendidas": rep_row.ventas_atendidas if rep_row else len(estacionalidad),
    }

    # 8. Purchase Behavior & LTV Metrics
    q_beh = text("""
        SELECT COUNT(id) as total_compras, SUM(total) as ltv, AVG(total) as ticket_promedio,
               MAX(fecha) as ultima_compra
        FROM sales
        WHERE customer_id = :cust_id
    """)
    beh_row = (await db.execute(q_beh, {"cust_id": cust_id})).fetchone()
    total_compras = int(beh_row.total_compras or 0) if beh_row else 0
    ltv = float(beh_row.ltv or 0) if beh_row else 0.0
    ticket_promedio = float(beh_row.ticket_promedio or 0) if beh_row else 0.0
    ultima_compra = str(beh_row.ultima_compra) if beh_row and beh_row.ultima_compra else "-"

    facturas_p = float(row.facturas_pendiente) if row else 0.0
    monto_v = float(row.monto_vencido) if row else 0.0
    dias_mora = int(row.dias_mora_max) if row else 0
    cantidad_facturas = int(row.cantidad_facturas) if row else len(facturas_detalle)
    ch_cartera = float(row.cheques_cartera) if row else 0.0
    ch_rechazados = float(row.cheques_rechazados) if row else 0.0
    pagares = float(row.pagares) if row else 0.0
    deuda_total = facturas_p + ch_cartera + ch_rechazados + pagares

    return {
        "customer_id": str(customer.id),
        "razon_social": customer.razon_social,
        "ruc": customer.ruc or "-",
        "telefono": customer.telefono or "-",
        "direccion": customer.direccion or "-",
        "ciudad": customer.ciudad or "-",
        "facturas_pendiente": facturas_p,
        "cantidad_facturas": cantidad_facturas,
        "monto_vencido": monto_v,
        "dias_mora_max": dias_mora,
        "cheques_cartera": ch_cartera,
        "cheques_rechazados": ch_rechazados,
        "pagares": pagares,
        "deuda_total": deuda_total,
        "limite_credito": float(row.limite_credito) if row else 0.0,
        "saldo_utilizado": float(row.saldo_utilizado) if row else 0.0,
        "saldo_disponible": float(row.saldo_disponible) if row else 0.0,
        "facturas_detalle": facturas_detalle,
        "cheques_detalle": cheques_detalle,
        "top_productos": top_productos,
        "estacionalidad_compras": estacionalidad,
        "vendedor_asignado": vendedor_asignado,
        "comportamiento": {
            "total_compras": total_compras,
            "ltv": ltv,
            "ticket_promedio": ticket_promedio,
            "ultima_compra": ultima_compra,
        }
    }

async def list_consolidated_debts(
    db: AsyncSession,
    company_id: str,
    search: Optional[str] = None,
    solo_con_deuda: bool = False,
    solo_con_rechazados: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> Dict[str, Any]:
    cid = uuid.UUID(company_id)

    search_filter = ""
    params: Dict[str, Any] = {"company_id": cid, "limit": limit, "offset": offset}
    if search:
        search_filter = "AND (c.razon_social ILIKE :search OR c.ruc ILIKE :search OR c.ci ILIKE :search)"
        params["search"] = f"%{search}%"

    where_clauses = []
    if solo_con_deuda:
        where_clauses.append("deuda_total > 0")
    if solo_con_rechazados:
        where_clauses.append("cheques_rechazados > 0")

    where_str = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

    query = text(f"""
        WITH debt_calc AS (
            SELECT 
                c.id as customer_id,
                c.razon_social,
                c.ruc,
                c.telefono,
                COALESCE(ar.facturas_pendiente, 0) as facturas_pendiente,
                COALESCE(ar.monto_vencido, 0) as monto_vencido,
                COALESCE(ar.dias_mora_max, 0) as dias_mora_max,
                COALESCE(ch.cheques_cartera, 0) as cheques_cartera,
                COALESCE(ch.cheques_rechazados, 0) as cheques_rechazados,
                COALESCE(ch.pagares, 0) as pagares,
                (COALESCE(ar.facturas_pendiente, 0) + COALESCE(ch.cheques_cartera, 0) + COALESCE(ch.cheques_rechazados, 0) + COALESCE(ch.pagares, 0)) as deuda_total,
                COALESCE(ca.limite_credito, c.credito_limite, 0) as limite_credito,
                COALESCE(ca.saldo_disponible, 0) as saldo_disponible,
                s.last_numero, s.last_fecha, s.last_total
            FROM customers c
            LEFT JOIN (
                SELECT customer_id,
                       SUM(saldo_pendiente) as facturas_pendiente,
                       SUM(CASE WHEN fecha_vencimiento < CURRENT_DATE THEN saldo_pendiente ELSE 0 END) as monto_vencido,
                       MAX(CASE WHEN fecha_vencimiento < CURRENT_DATE THEN (CURRENT_DATE - fecha_vencimiento) ELSE 0 END) as dias_mora_max
                FROM accounts_receivable
                WHERE estado = 'pendiente'
                GROUP BY customer_id
            ) ar ON ar.customer_id = c.id
            LEFT JOIN (
                SELECT customer_id,
                       SUM(CASE WHEN tipo = 'cheque' AND estado IN ('cartera', 'depositado') THEN monto ELSE 0 END) as cheques_cartera,
                       SUM(CASE WHEN tipo = 'cheque' AND estado = 'rechazado' THEN monto ELSE 0 END) as cheques_rechazados,
                       SUM(CASE WHEN tipo = 'pagare' AND estado IN ('cartera', 'depositado', 'rechazado') THEN monto ELSE 0 END) as pagares
                FROM checks
                GROUP BY customer_id
            ) ch ON ch.customer_id = c.id
            LEFT JOIN credit_accounts ca ON ca.customer_id = c.id
            LEFT JOIN LATERAL (
                SELECT numero as last_numero, fecha as last_fecha, total as last_total
                FROM sales
                WHERE customer_id = c.id AND company_id = :company_id
                ORDER BY fecha DESC LIMIT 1
            ) s ON true
            WHERE c.company_id = :company_id {search_filter}
        )
        SELECT * FROM debt_calc
        {where_str}
        ORDER BY deuda_total DESC
        LIMIT :limit OFFSET :offset
    """)
    res = await db.execute(query, params)
    rows = res.fetchall()

    # Total summary KPIs across company
    summary_query = text("""
        SELECT 
            COALESCE(SUM(saldo_pendiente), 0) as total_facturas_pendiente,
            COALESCE(SUM(CASE WHEN fecha_vencimiento < CURRENT_DATE THEN saldo_pendiente ELSE 0 END), 0) as total_monto_vencido
        FROM accounts_receivable WHERE company_id = :company_id AND estado = 'pendiente'
    """)
    sum_res = await db.execute(summary_query, {"company_id": cid})
    sum_row = sum_res.fetchone()

    checks_summary = text("""
        SELECT 
            COALESCE(SUM(CASE WHEN tipo = 'cheque' AND estado IN ('cartera', 'depositado') THEN monto ELSE 0 END), 0) as total_cheques_cartera,
            COALESCE(SUM(CASE WHEN tipo = 'cheque' AND estado = 'rechazado' THEN monto ELSE 0 END), 0) as total_cheques_rechazados,
            COALESCE(SUM(CASE WHEN tipo = 'pagare' THEN monto ELSE 0 END), 0) as total_pagares
        FROM checks WHERE company_id = :company_id
    """)
    ch_res = await db.execute(checks_summary, {"company_id": cid})
    ch_row = ch_res.fetchone()

    facturas_sum = float(sum_row.total_facturas_pendiente) if sum_row else 0.0
    vencidos_sum = float(sum_row.total_monto_vencido) if sum_row else 0.0
    cartera_sum = float(ch_row.total_cheques_cartera) if ch_row else 0.0
    rechazados_sum = float(ch_row.total_cheques_rechazados) if ch_row else 0.0
    pagares_sum = float(ch_row.total_pagares) if ch_row else 0.0
    grand_total_debt = facturas_sum + cartera_sum + rechazados_sum + pagares_sum

    formatted_items = []
    for r in rows:
        f_p = float(r.facturas_pendiente)
        c_c = float(r.cheques_cartera)
        c_r = float(r.cheques_rechazados)
        p_g = float(r.pagares)
        d_tot = float(r.deuda_total)
        formatted_items.append({
            "customer_id": str(r.customer_id),
            "razon_social": r.razon_social,
            "ruc": r.ruc,
            "telefono": r.telefono,
            "facturas_pendiente": f_p,
            "monto_vencido": float(r.monto_vencido),
            "dias_mora_max": int(r.dias_mora_max),
            "cheques_cartera": c_c,
            "cheques_rechazados": c_r,
            "pagares": p_g,
            "deuda_total_consolidada": d_tot,
            "limite_credito": float(r.limite_credito),
            "saldo_disponible": float(r.saldo_disponible),
            "ultima_compra": {
                "numero": r.last_numero,
                "fecha": r.last_fecha.isoformat() if r.last_fecha else None,
                "total": float(r.last_total) if r.last_total else None,
            } if r.last_numero else None,
        })

    return {
        "summary": {
            "deuda_total_sistema": grand_total_debt,
            "total_facturas_pendiente": facturas_sum,
            "total_monto_vencido": vencidos_sum,
            "total_cheques_cartera": cartera_sum,
            "total_cheques_rechazados": rechazados_sum,
            "total_pagares": pagares_sum,
        },
        "clientes": formatted_items,
    }
