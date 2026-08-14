"""Checks/pagares service"""

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, date
from decimal import Decimal
import uuid

from api.src.checks.models import Check, CheckEvent
from api.src.checks.schemas import CheckCreate, CheckChangeStatus, CheckReplace

TRANSICIONES_VALIDAS = {
    "cartera": {"depositado", "rechazado"},
    "depositado": {"acreditado", "rechazado"},
}


async def record_check(db: AsyncSession, data: CheckCreate) -> Check:
    """Crea el cheque/pagare y su primer evento SIN comitear — para uso desde
    otro flujo (ej. sales.service.add_payment) que maneja su propio commit
    atomico. create_check() (uso directo via router) le agrega el commit."""
    check = Check(
        company_id=data.company_id,
        customer_id=data.customer_id,
        tipo=data.tipo,
        numero=data.numero,
        banco=data.banco,
        titular=data.titular,
        monto=data.monto,
        moneda=data.moneda,
        fecha_emision=data.fecha_emision,
        fecha_vencimiento=data.fecha_vencimiento,
        payment_id=data.payment_id,
        accounts_receivable_id=data.accounts_receivable_id,
        observaciones=data.observaciones,
        estado="cartera",
    )
    db.add(check)
    await db.flush()
    db.add(CheckEvent(check_id=check.id, estado_anterior=None, estado_nuevo="cartera"))
    await db.flush()
    return check


async def create_check(db: AsyncSession, data: CheckCreate) -> Check:
    check = await record_check(db, data)
    await db.commit()
    await db.refresh(check)
    return check


async def get_check(db: AsyncSession, check_id: str) -> Check | None:
    result = await db.execute(select(Check).where(Check.id == uuid.UUID(check_id)))
    return result.scalar_one_or_none()


async def list_checks(
    db: AsyncSession,
    company_id: str,
    customer_id: str | None = None,
    estado: str | None = None,
    tipo: str | None = None,
    search: str | None = None,
    vigente_only: bool = False,
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    where_clauses = ["ch.company_id = :cid"]
    params: dict = {"cid": uuid.UUID(company_id), "limit": limit, "offset": offset}

    if customer_id:
        where_clauses.append("ch.customer_id = :cust_id")
        params["cust_id"] = uuid.UUID(customer_id)
    if estado:
        where_clauses.append("ch.estado = :estado")
        params["estado"] = estado
    if tipo:
        where_clauses.append("ch.tipo = :tipo")
        params["tipo"] = tipo
    if vigente_only:
        where_clauses.append("ch.fecha_vencimiento >= '2026-01-01'")
    if fecha_desde:
        where_clauses.append("ch.fecha_vencimiento >= :f_desde")
        params["f_desde"] = fecha_desde
    if fecha_hasta:
        where_clauses.append("ch.fecha_vencimiento <= :f_hasta")
        params["f_hasta"] = fecha_hasta
    if search:
        where_clauses.append(
            "(ch.numero ILIKE :search OR ch.banco ILIKE :search OR ch.titular ILIKE :search "
            "OR c.razon_social ILIKE :search OR c.ruc ILIKE :search OR ch.observaciones ILIKE :search)"
        )
        params["search"] = f"%{search}%"

    where_stmt = " AND ".join(where_clauses)

    query = text(f"""
        SELECT 
            ch.id, ch.company_id, ch.customer_id, c.razon_social as customer_name, c.ruc as customer_ruc,
            ch.tipo, ch.numero, ch.banco, ch.titular, ch.monto, ch.moneda,
            ch.fecha_emision, ch.fecha_vencimiento, ch.payment_id, ch.accounts_receivable_id,
            ch.reemplaza_check_id, ch.estado, ch.observaciones, ch.created_at, ch.updated_at,
            CASE 
                WHEN ch.fecha_vencimiento IS NOT NULL AND ch.fecha_vencimiento < CURRENT_DATE THEN (CURRENT_DATE - ch.fecha_vencimiento)::int 
                ELSE 0 
            END as dias_vencido,
            CASE 
                WHEN ch.fecha_vencimiento > CURRENT_DATE THEN (ch.fecha_vencimiento - CURRENT_DATE)::int 
                ELSE 0 
            END as dias_para_cobro
        FROM checks ch
        LEFT JOIN customers c ON c.id = ch.customer_id
        WHERE {where_stmt}
        ORDER BY 
            CASE WHEN ch.estado = 'rechazado' THEN 0 WHEN ch.estado = 'cartera' THEN 1 WHEN ch.estado = 'depositado' THEN 2 ELSE 3 END ASC,
            ch.fecha_vencimiento ASC,
            ch.created_at DESC
        LIMIT :limit OFFSET :offset
    """)
    res = await db.execute(query, params)
    rows = res.fetchall()
    return [dict(r._mapping) for r in rows]


async def get_checks_summary(db: AsyncSession, company_id: str, vigente_only: bool = False, fecha_desde: date | None = None, fecha_hasta: date | None = None) -> dict:
    where_extra = ""
    params: dict = {"cid": uuid.UUID(company_id)}
    if vigente_only:
        where_extra += " AND fecha_vencimiento >= '2026-01-01'"
    if fecha_desde:
        where_extra += " AND fecha_vencimiento >= :f_desde"
        params["f_desde"] = fecha_desde
    if fecha_hasta:
        where_extra += " AND fecha_vencimiento <= :f_hasta"
        params["f_hasta"] = fecha_hasta

    query = text(f"""
        SELECT 
            COUNT(id) as total_documentos,
            
            -- Cartera (Custodia)
            COALESCE(SUM(CASE WHEN tipo = 'cheque' AND estado = 'cartera' THEN monto ELSE 0 END), 0) as total_cartera,
            COALESCE(COUNT(CASE WHEN tipo = 'cheque' AND estado = 'cartera' THEN id END), 0) as cant_cartera,
            COALESCE(SUM(CASE WHEN tipo = 'cheque' AND estado = 'cartera' AND fecha_vencimiento <= CURRENT_DATE THEN monto ELSE 0 END), 0) as total_cartera_al_dia,
            COALESCE(SUM(CASE WHEN tipo = 'cheque' AND estado = 'cartera' AND fecha_vencimiento > CURRENT_DATE THEN monto ELSE 0 END), 0) as total_cartera_diferido,
            
            -- Depositados (En Clearing Bancario)
            COALESCE(SUM(CASE WHEN tipo = 'cheque' AND estado = 'depositado' THEN monto ELSE 0 END), 0) as total_depositado,
            COALESCE(COUNT(CASE WHEN tipo = 'cheque' AND estado = 'depositado' THEN id END), 0) as cant_depositado,
            
            -- Acreditados (Fondos Cobrados)
            COALESCE(SUM(CASE WHEN tipo = 'cheque' AND estado = 'acreditado' THEN monto ELSE 0 END), 0) as total_acreditado,
            COALESCE(COUNT(CASE WHEN tipo = 'cheque' AND estado = 'acreditado' THEN id END), 0) as cant_acreditado,
            
            -- Rechazados (Riesgo y Deuda Reabierta)
            COALESCE(SUM(CASE WHEN tipo = 'cheque' AND estado = 'rechazado' THEN monto ELSE 0 END), 0) as total_rechazado,
            COALESCE(COUNT(CASE WHEN tipo = 'cheque' AND estado = 'rechazado' THEN id END), 0) as cant_rechazado,
            
            -- Pagarés
            COALESCE(SUM(CASE WHEN tipo = 'pagare' AND estado IN ('cartera', 'depositado') THEN monto ELSE 0 END), 0) as total_pagares_activos,
            COALESCE(COUNT(CASE WHEN tipo = 'pagare' AND estado IN ('cartera', 'depositado') THEN id END), 0) as cant_pagares_activos,
            COALESCE(SUM(CASE WHEN tipo = 'pagare' AND estado = 'rechazado' THEN monto ELSE 0 END), 0) as total_pagares_vencidos,
            COALESCE(COUNT(CASE WHEN tipo = 'pagare' AND estado = 'rechazado' THEN id END), 0) as cant_pagares_vencidos,
            COALESCE(SUM(CASE WHEN tipo = 'pagare' THEN monto ELSE 0 END), 0) as total_pagares_historico
        FROM checks
        WHERE company_id = :cid {where_extra}
    """)
    res = await db.execute(query, params)
    r = res.fetchone()
    return {
        "total_documentos": int(r.total_documentos or 0),
        "total_cartera": float(r.total_cartera or 0),
        "cant_cartera": int(r.cant_cartera or 0),
        "total_cartera_al_dia": float(r.total_cartera_al_dia or 0),
        "total_cartera_diferido": float(r.total_cartera_diferido or 0),
        "total_depositado": float(r.total_depositado or 0),
        "cant_depositado": int(r.cant_depositado or 0),
        "total_acreditado": float(r.total_acreditado or 0),
        "cant_acreditado": int(r.cant_acreditado or 0),
        "total_rechazado": float(r.total_rechazado or 0),
        "cant_rechazado": int(r.cant_rechazado or 0),
        "total_pagares_activos": float(r.total_pagares_activos or 0),
        "cant_pagares_activos": int(r.cant_pagares_activos or 0),
        "total_pagares_vencidos": float(r.total_pagares_vencidos or 0),
        "cant_pagares_vencidos": int(r.cant_pagares_vencidos or 0),
        "total_pagares": float(r.total_pagares_activos or 0),
    }

async def get_cartera(db: AsyncSession, company_id: str, dias: int = 30) -> list[dict]:
    """Cheques/pagares en cartera o depositados con vencimiento dentro de `dias`
    — reemplaza la consulta de 4 fuentes separadas del legacy (Credito/selchckcli.asp)
    por una sola vista."""
    query = text("""
        SELECT ch.*, c.razon_social as customer_name
        FROM checks ch
        LEFT JOIN customers c ON c.id = ch.customer_id
        WHERE ch.company_id = :company_id
        AND ch.estado IN ('cartera', 'depositado')
        AND ch.fecha_vencimiento <= CURRENT_DATE + make_interval(days => :dias)
        ORDER BY ch.fecha_vencimiento ASC
    """)
    result = await db.execute(query, {"company_id": company_id, "dias": dias})
    return [dict(row._mapping) for row in result.fetchall()]


async def _reverse_payment_effects(db: AsyncSession, company_id: str, check: Check) -> None:
    """Al rechazar un cheque/pagare que ya habia saldado (total o parcial) una
    cuenta por cobrar, hay que reabrirla — y reabrir el credito consumido si
    la venta original era a credito. Espejo de accounts_receivable.service
    ::apply_payment_to_receivable, pero en reversa."""
    if not check.accounts_receivable_id:
        return

    result = await db.execute(
        text("SELECT sale_id, saldo_pendiente FROM accounts_receivable WHERE id = :id"),
        {"id": check.accounts_receivable_id},
    )
    ar_row = result.fetchone()
    if not ar_row:
        return

    await db.execute(
        text("""
            UPDATE accounts_receivable
            SET saldo_pendiente = saldo_pendiente + :monto, estado = 'pendiente'
            WHERE id = :id
        """),
        {"monto": float(check.monto), "id": check.accounts_receivable_id},
    )

    if ar_row.sale_id:
        from api.src.sales.models import Sale
        sale_result = await db.execute(select(Sale).where(Sale.id == ar_row.sale_id))
        sale = sale_result.scalar_one_or_none()
        if sale:
            sale.total_pagado = max(Decimal("0"), (sale.total_pagado or Decimal("0")) - check.monto)
            sale.saldo = sale.total - sale.total_pagado
            sale.estado = "parcial" if sale.total_pagado > 0 else "pendiente"
            sale.updated_at = datetime.now(timezone.utc)

    from api.src.credit_accounts.models import CreditAccount, CreditMovement
    cred_result = await db.execute(
        select(CreditAccount).where(
            CreditAccount.company_id == company_id, CreditAccount.customer_id == check.customer_id,
        )
    )
    account = cred_result.scalar_one_or_none()
    if account:
        saldo_anterior = Decimal(str(account.saldo_utilizado))
        account.saldo_utilizado += check.monto
        account.saldo_disponible -= check.monto
        db.add(CreditMovement(
            company_id=company_id, credit_account_id=account.id, customer_id=check.customer_id,
            tipo="ajuste", monto=check.monto, saldo_anterior=saldo_anterior, saldo_nuevo=account.saldo_utilizado,
            referencia_type="check_rechazado", referencia_id=check.id,
            observaciones=f"Reversa por rechazo de {check.tipo} {check.numero}",
        ))


async def change_check_status(db: AsyncSession, check_id: str, data: CheckChangeStatus) -> Check | None:
    check = await get_check(db, check_id)
    if not check:
        return None

    validas = TRANSICIONES_VALIDAS.get(check.estado, set())
    if data.estado not in validas:
        return None

    estado_anterior = check.estado
    check.estado = data.estado
    check.updated_at = datetime.now(timezone.utc)
    if data.motivo:
        check.observaciones = f"{check.observaciones or ''}\n[{data.estado}] {data.motivo}".strip()

    if data.estado == "rechazado":
        await _reverse_payment_effects(db, str(check.company_id), check)

    db.add(CheckEvent(
        check_id=check.id, estado_anterior=estado_anterior, estado_nuevo=data.estado,
        motivo=data.motivo, user_id=data.user_id,
    ))
    await db.commit()
    await db.refresh(check)
    return check


async def replace_check(db: AsyncSession, check_id: str, data: CheckReplace) -> Check | None:
    original = await get_check(db, check_id)
    if not original or original.estado != "rechazado":
        return None

    nuevo = Check(
        company_id=original.company_id,
        customer_id=original.customer_id,
        tipo=original.tipo,
        numero=data.numero,
        banco=data.banco or original.banco,
        titular=data.titular or original.titular,
        monto=original.monto,
        moneda=original.moneda,
        fecha_vencimiento=data.fecha_vencimiento,
        payment_id=original.payment_id,
        accounts_receivable_id=original.accounts_receivable_id,
        reemplaza_check_id=original.id,
        estado="cartera",
        observaciones=f"Reemplaza a {original.tipo} {original.numero} (rechazado)",
    )
    db.add(nuevo)

    original.estado = "reemplazado"
    original.updated_at = datetime.now(timezone.utc)

    await db.flush()
    db.add(CheckEvent(check_id=nuevo.id, estado_anterior=None, estado_nuevo="cartera", user_id=data.user_id))
    db.add(CheckEvent(
        check_id=original.id, estado_anterior="rechazado", estado_nuevo="reemplazado", user_id=data.user_id,
    ))
    await db.commit()
    await db.refresh(nuevo)
    return nuevo


async def get_events(db: AsyncSession, check_id: str) -> list[CheckEvent]:
    result = await db.execute(
        select(CheckEvent).where(CheckEvent.check_id == uuid.UUID(check_id)).order_by(CheckEvent.created_at.asc())
    )
    return list(result.scalars().all())
