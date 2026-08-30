"""Caja (Cash Register) service"""

from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from datetime import datetime, timezone
from decimal import Decimal
import uuid

from api.src.caja.models import CashRegister, CashSession
from api.src.sales.models import Sale


async def list_registers(db: AsyncSession, branch_id: str | None = None) -> list[CashRegister]:
    query = select(CashRegister).where(CashRegister.activo == True)
    if branch_id:
        query = query.where(CashRegister.branch_id == branch_id)
    query = query.order_by(CashRegister.nombre)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_register(db: AsyncSession, register_id: str) -> CashRegister | None:
    result = await db.execute(
        select(CashRegister).where(CashRegister.id == uuid.UUID(register_id))
    )
    return result.scalar_one_or_none()


async def create_register(db: AsyncSession, data: dict) -> CashRegister:
    register = CashRegister(**data)
    db.add(register)
    await db.flush()
    await db.refresh(register)
    return register


async def update_register(db: AsyncSession, register_id: str, data: dict) -> CashRegister | None:
    register = await get_register(db, register_id)
    if not register:
        return None
    for key, value in data.items():
        if value is not None:
            setattr(register, key, value)
    await db.flush()
    await db.refresh(register)
    return register


async def delete_register(db: AsyncSession, register_id: str) -> bool:
    register = await get_register(db, register_id)
    if not register:
        return False
    register.activo = False
    await db.flush()
    return True


async def get_open_session(db: AsyncSession, register_id: str) -> CashSession | None:
    try:
        reg_uuid = uuid.UUID(register_id)
    except Exception:
        return None
    result = await db.execute(
        select(CashSession)
        .where(CashSession.register_id == reg_uuid)
        .where(CashSession.estado == "abierta")
        .order_by(CashSession.fecha_apertura.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def list_sessions(
    db: AsyncSession,
    register_id: str | None = None,
    user_id: str | None = None,
    estado: str | None = None,
    fecha_desde: datetime | None = None,
    fecha_hasta: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[CashSession]:
    query = select(CashSession)
    if register_id:
        try:
            query = query.where(CashSession.register_id == uuid.UUID(register_id))
        except Exception:
            pass
    if user_id:
        try:
            query = query.where(CashSession.user_id == uuid.UUID(user_id))
        except Exception:
            pass
    if estado:
        query = query.where(CashSession.estado == estado)
    if fecha_desde:
        query = query.where(CashSession.fecha_apertura >= fecha_desde)
    if fecha_hasta:
        query = query.where(CashSession.fecha_apertura <= fecha_hasta)
    query = query.order_by(CashSession.fecha_apertura.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_session_with_summary(db: AsyncSession, session_id: str) -> dict | None:
    result = await db.execute(
        select(CashSession).where(CashSession.id == uuid.UUID(session_id))
    )
    session_obj = result.scalar_one_or_none()
    if not session_obj:
        return None

    sales_result = await db.execute(
        select(
            func.count(Sale.id).label("total_ventas"),
            func.coalesce(func.sum(Sale.total), 0).label("total_cobrado"),
        ).where(
            Sale.branch_id == session_obj.register_id,
            Sale.fecha >= session_obj.fecha_apertura,
            Sale.estado == "confirmado",
        )
    )
    row = sales_result.first()
    return {
        "session": session_obj,
        "total_ventas": row.total_ventas if row else 0,
        "total_cobrado": row.total_cobrado if row else 0,
    }


async def open_session(db: AsyncSession, data: dict) -> CashSession:
    reg_id = data.get("register_id") or data.get("cash_register_id") or data.get("caja_id")
    if not reg_id:
        first_reg = (await db.execute(select(CashRegister).where(CashRegister.activo == True).limit(1))).scalar_one_or_none()
        if first_reg:
            reg_id = first_reg.id
        else:
            # Crear una caja base automática si no existe
            new_reg = CashRegister(
                company_id=uuid.UUID("00000000-0000-0000-0000-000000000010"),
                nombre="Caja Mostrador 01",
                codigo="001-001",
                activo=True
            )
            db.add(new_reg)
            await db.flush()
            reg_id = new_reg.id

    if isinstance(reg_id, str):
        reg_id = uuid.UUID(reg_id)

    user_id = data.get("user_id")
    if not user_id:
        user_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    elif isinstance(user_id, str):
        user_id = uuid.UUID(user_id)

    existing = await get_open_session(db, str(reg_id))
    if existing:
        return existing

    monto = Decimal(str(data.get("monto_apertura", 0)))
    session_obj = CashSession(
        register_id=reg_id,
        user_id=user_id,
        monto_apertura=monto,
        estado="abierta",
    )
    db.add(session_obj)
    await db.commit()
    await db.refresh(session_obj)
    return session_obj


async def close_session(db: AsyncSession, session_id: str, monto_cierre_real: Decimal, observaciones: str | None = None) -> CashSession | None:
    result = await db.execute(
        select(CashSession).where(CashSession.id == uuid.UUID(session_id))
    )
    session_obj = result.scalar_one_or_none()
    if not session_obj or session_obj.estado != "abierta":
        return None

    sales_result = await db.execute(
        select(func.coalesce(func.sum(Sale.total), 0)).where(
            Sale.branch_id == session_obj.cash_register_id,
            Sale.fecha >= session_obj.fecha_apertura,
            Sale.estado == "confirmado",
        )
    )
    total_cobrado = sales_result.scalar() or 0

    monto_cierre_esperado = Decimal(str(session_obj.monto_apertura)) + Decimal(str(total_cobrado))
    diferencia = Decimal(str(monto_cierre_real)) - monto_cierre_esperado

    session_obj.fecha_cierre = datetime.now(timezone.utc)
    session_obj.monto_cierre_esperado = monto_cierre_esperado
    session_obj.monto_cierre_real = monto_cierre_real
    session_obj.diferencia = diferencia
    session_obj.observaciones_cierre = observaciones
    session_obj.estado = "cerrada"

    await db.flush()
    await db.refresh(session_obj)
    return session_obj


# ── Liquidaciones de caja por cobrador/ruta (route_cash_settlements) ──────────

async def list_route_settlements(
    db: AsyncSession, company_id: str,
    fecha_desde=None, fecha_hasta=None, cobrador_codigo: str | None = None,
    cerrado: bool | None = None, search: str | None = None,
    limit: int = 50, offset: int = 0,
) -> list[dict]:
    where = "rcs.company_id = :company_id"
    params = {"company_id": company_id, "limit": limit, "offset": offset}
    if fecha_desde:
        where += " AND rcs.fecha >= :fecha_desde"
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        where += " AND rcs.fecha <= :fecha_hasta"
        params["fecha_hasta"] = fecha_hasta
    if cobrador_codigo:
        where += " AND (rcs.cobrador_codigo = :cobrador_codigo OR rcs.funcionario_codigo = :cobrador_codigo)"
        params["cobrador_codigo"] = cobrador_codigo
    if cerrado is not None:
        where += " AND rcs.cerrado = :cerrado"
        params["cerrado"] = cerrado
    if search:
        where += " AND (rcs.observaciones ILIKE :search OR rcs.codigo_legacy ILIKE :search OR rcs.cobrador_codigo ILIKE :search OR sr_cob.nombre ILIKE :search)"
        params["search"] = f"%{search}%"

    result = await db.execute(
        text(f"""
            SELECT 
                rcs.id, rcs.codigo_legacy, rcs.cobrador_codigo, rcs.funcionario_codigo,
                COALESCE(sr_cob.nombre, CASE WHEN rcs.cobrador_codigo != '0' THEN 'Cobrador #' || rcs.cobrador_codigo ELSE 'Caja Salón' END) as cobrador_nombre,
                COALESCE(sr_fun.nombre, 'Operador #' || rcs.funcionario_codigo) as funcionario_nombre,
                sr_cob.rama as cobrador_rama,
                rcs.fecha, rcs.fecha_cierre, rcs.cerrado, 
                COALESCE(rcs.a_rendir, 0) as a_rendir,
                COALESCE(rcs.total, 0) as total,
                COALESCE(rcs.efectivo, 0) as efectivo,
                COALESCE(rcs.anticipo, 0) as anticipo,
                COALESCE(rcs.descuentos, 0) as descuentos,
                COALESCE(rcs.otro_egreso, 0) as otro_egreso,
                COALESCE(rcs.otro_ingreso, 0) as otro_ingreso,
                COALESCE(rcs.pagares, 0) as pagares,
                rcs.observaciones, rcs.usuario_cierre,
                ((COALESCE(rcs.total, 0) + COALESCE(rcs.anticipo, 0) + COALESCE(rcs.descuentos, 0) + COALESCE(rcs.otro_egreso, 0) + COALESCE(rcs.otro_ingreso, 0) + COALESCE(rcs.pagares, 0)) - COALESCE(rcs.a_rendir, 0)) as diferencia
            FROM route_cash_settlements rcs
            LEFT JOIN sales_reps sr_cob ON sr_cob.funcionario_codigo = rcs.cobrador_codigo AND sr_cob.company_id = rcs.company_id
            LEFT JOIN sales_reps sr_fun ON sr_fun.funcionario_codigo = rcs.funcionario_codigo AND sr_fun.company_id = rcs.company_id
            WHERE {where}
            ORDER BY rcs.fecha DESC, rcs.id DESC
            LIMIT :limit OFFSET :offset
        """),
        params,
    )
    return [dict(row._mapping) for row in result.fetchall()]


async def get_route_settlement_detail(db: AsyncSession, company_id: str, settlement_id: str) -> dict | None:
    q_main = text("""
        SELECT 
            rcs.id, rcs.codigo_legacy, rcs.cobrador_codigo, rcs.funcionario_codigo,
            COALESCE(sr_cob.nombre, CASE WHEN rcs.cobrador_codigo != '0' THEN 'Cobrador #' || rcs.cobrador_codigo ELSE 'Caja Salón' END) as cobrador_nombre,
            COALESCE(sr_fun.nombre, 'Operador #' || rcs.funcionario_codigo) as funcionario_nombre,
            sr_cob.rama as cobrador_rama, sr_cob.cedula as cobrador_cedula,
            rcs.fecha, rcs.fecha_cierre, rcs.cerrado, 
            COALESCE(rcs.a_rendir, 0) as a_rendir,
            COALESCE(rcs.total, 0) as total,
            COALESCE(rcs.efectivo, 0) as efectivo,
            COALESCE(rcs.anticipo, 0) as anticipo,
            COALESCE(rcs.descuentos, 0) as descuentos,
            COALESCE(rcs.otro_egreso, 0) as otro_egreso,
            COALESCE(rcs.otro_ingreso, 0) as otro_ingreso,
            COALESCE(rcs.pagares, 0) as pagares,
            rcs.observaciones, rcs.usuario_cierre,
            ((COALESCE(rcs.total, 0) + COALESCE(rcs.anticipo, 0) + COALESCE(rcs.descuentos, 0) + COALESCE(rcs.otro_egreso, 0) + COALESCE(rcs.otro_ingreso, 0) + COALESCE(rcs.pagares, 0)) - COALESCE(rcs.a_rendir, 0)) as diferencia
        FROM route_cash_settlements rcs
        LEFT JOIN sales_reps sr_cob ON sr_cob.funcionario_codigo = rcs.cobrador_codigo AND sr_cob.company_id = rcs.company_id
        LEFT JOIN sales_reps sr_fun ON sr_fun.funcionario_codigo = rcs.funcionario_codigo AND sr_fun.company_id = rcs.company_id
        WHERE rcs.id = :id AND rcs.company_id = :company_id
    """)
    res = await db.execute(q_main, {"id": settlement_id, "company_id": company_id})
    row = res.fetchone()
    if not row:
        return None

    data = dict(row._mapping)

    # Fetch Detailed Movements
    q_movs = text("""
        SELECT id, fecha, monto, observaciones, recibo, moneda, created_at
        FROM route_cash_settlement_movements
        WHERE settlement_id = :id
        ORDER BY fecha DESC, id DESC
        LIMIT 100
    """)
    m_rows = (await db.execute(q_movs, {"id": settlement_id})).fetchall()
    data["movimientos"] = [dict(m._mapping) for m in m_rows]
    data["total_movimientos_count"] = len(data["movimientos"])

    return data


async def get_route_settlements_summary(db: AsyncSession, company_id: str, fecha_desde=None, fecha_hasta=None) -> dict:
    where = "company_id = :company_id"
    params = {"company_id": company_id}
    
    # If no dates specified, default to latest operating date (CURRENT_DATE)
    if fecha_desde:
        where += " AND fecha >= :fecha_desde"
        params["fecha_desde"] = fecha_desde
    if fecha_hasta:
        where += " AND fecha <= :fecha_hasta"
        params["fecha_hasta"] = fecha_hasta

    if not fecha_desde and not fecha_hasta:
        # Default to today so KPIs reflect current day operations
        where += " AND fecha = CURRENT_DATE"

    result = await db.execute(
        text(f"""
            SELECT
                COUNT(*) as total_liquidaciones,
                COUNT(*) FILTER (WHERE NOT cerrado) as activas_hoy,
                COUNT(*) FILTER (WHERE cerrado) as cerradas,
                COUNT(*) FILTER (WHERE cerrado AND usuario_cierre IS NOT NULL) as autorizadas_tesoreria,
                COUNT(*) FILTER (WHERE NOT cerrado OR usuario_cierre IS NULL) as pendientes_autorizacion,
                COUNT(DISTINCT cobrador_codigo) as cobradores_activos,
                COALESCE(SUM(a_rendir), 0) as total_a_rendir,
                COALESCE(SUM(total), 0) as total_liquidado,
                COALESCE(SUM(efectivo), 0) as efectivo,
                COALESCE(SUM(anticipo), 0) as anticipo,
                COALESCE(SUM(descuentos), 0) as descuentos,
                COALESCE(SUM(otro_egreso), 0) as otro_egreso,
                COALESCE(SUM(otro_ingreso), 0) as otro_ingreso,
                COALESCE(SUM(pagares), 0) as pagares,
                COALESCE(SUM((total + anticipo + descuentos + otro_egreso + otro_ingreso + pagares) - a_rendir), 0) as diferencia_neta
            FROM route_cash_settlements
            WHERE {where}
        """),
        params,
    )
    row = result.first()
    res = dict(row._mapping) if row else {}
    res["fecha_filtro_aplicada"] = str(fecha_desde or "hoy (CURRENT_DATE)")
    return res


async def authorize_route_settlement(db: AsyncSession, company_id: str, settlement_id: str, usuario_tesorero: str = "Tesoreria Central", observaciones: str | None = None) -> dict | None:
    q = text("""
        UPDATE route_cash_settlements
        SET cerrado = true,
            fecha_cierre = CURRENT_DATE,
            usuario_cierre = :usuario,
            observaciones = CASE 
                WHEN :obs IS NOT NULL AND :obs != '' THEN COALESCE(observaciones, '') || ' | ' || :obs 
                ELSE observaciones 
            END
        WHERE id = :id AND company_id = :company_id
        RETURNING id, codigo_legacy, cerrado, fecha_cierre, usuario_cierre, total, efectivo
    """)
    res = await db.execute(q, {
        "id": settlement_id,
        "company_id": company_id,
        "usuario": usuario_tesorero,
        "obs": observaciones or "Autorizado por Tesorería"
    })
    row = res.fetchone()
    if not row:
        return None
    return dict(row._mapping)


async def close_route_settlement_with_count(
    db: AsyncSession, company_id: str, settlement_id: str,
    efectivo: Decimal, pagares: Decimal = Decimal(0),
    descuentos: Decimal = Decimal(0), otro_egreso: Decimal = Decimal(0),
    anticipo: Decimal = Decimal(0), observaciones: str | None = None,
    usuario: str = "Cajero"
) -> dict | None:
    total_declarado = efectivo + pagares + anticipo
    q = text("""
        UPDATE route_cash_settlements
        SET cerrado = true,
            fecha_cierre = CURRENT_DATE,
            total = :total,
            efectivo = :efectivo,
            pagares = :pagares,
            descuentos = :descuentos,
            otro_egreso = :otro_egreso,
            anticipo = :anticipo,
            usuario_cierre = :usuario,
            observaciones = CASE 
                WHEN :obs IS NOT NULL AND :obs != '' THEN COALESCE(observaciones, '') || ' | ' || :obs 
                ELSE observaciones 
            END
        WHERE id = :id AND company_id = :company_id
        RETURNING id, codigo_legacy, cerrado, a_rendir, total, efectivo, usuario_cierre
    """)
    res = await db.execute(q, {
        "id": settlement_id,
        "company_id": company_id,
        "total": float(total_declarado),
        "efectivo": float(efectivo),
        "pagares": float(pagares),
        "descuentos": float(descuentos),
        "otro_egreso": float(otro_egreso),
        "anticipo": float(anticipo),
        "usuario": usuario,
        "obs": observaciones or "Arqueo y Cierre Físico Declarado"
    })
    row = res.fetchone()
    if not row:
        return None
    return dict(row._mapping)


async def open_route_settlement(
    db: AsyncSession, company_id: str, data: dict
) -> dict:
    cobrador_codigo = str(data.get("cobrador_codigo", "0"))
    funcionario_codigo = str(data.get("funcionario_codigo", "1001"))
    a_rendir = Decimal(str(data.get("a_rendir", 0)))
    observaciones = str(data.get("observaciones", "Apertura de Caja / Ruta"))
    import uuid
    legacy_code = f"CJ-{uuid.uuid4().hex[:6].upper()}"

    q = text("""
        INSERT INTO route_cash_settlements (
            id, company_id, codigo_legacy, cobrador_codigo, funcionario_codigo,
            fecha, cerrado, a_rendir, total, efectivo, anticipo, descuentos,
            otro_egreso, otro_ingreso, pagares, observaciones, created_at
        ) VALUES (
            gen_random_uuid(), :company_id, :codigo_legacy, :cobrador, :funcionario,
            CURRENT_DATE, false, :a_rendir, 0, 0, 0, 0, 0, 0, 0, :obs, NOW()
        )
        RETURNING id, codigo_legacy, cobrador_codigo, funcionario_codigo, fecha, cerrado, a_rendir, observaciones
    """)
    res = await db.execute(q, {
        "company_id": company_id,
        "codigo_legacy": legacy_code,
        "cobrador": cobrador_codigo,
        "funcionario": funcionario_codigo,
        "a_rendir": float(a_rendir),
        "obs": observaciones
    })
    row = res.fetchone()
    return dict(row._mapping)


# ── Bóveda Central de Tesorería & Remesas de Caudales ──────────────────────

async def get_vault_summary(db: AsyncSession, company_id: str) -> dict:
    # 1. Calculate vault cash balance
    q_cash = text("""
        SELECT 
            COALESCE(SUM(CASE WHEN tipo LIKE 'ingreso%' THEN monto ELSE -monto END), 0) as saldo_efectivo,
            COALESCE(SUM(CASE WHEN tipo LIKE 'ingreso%' AND created_at::date = CURRENT_DATE THEN monto ELSE 0 END), 0) as ingresos_hoy,
            COALESCE(SUM(CASE WHEN tipo LIKE 'egreso%' AND created_at::date = CURRENT_DATE THEN monto ELSE 0 END), 0) as egresos_hoy,
            COALESCE(SUM(CASE WHEN tipo = 'egreso_remesa_blindado' AND estado = 'en_transito' THEN monto ELSE 0 END), 0) as remesas_transito_monto,
            COUNT(*) FILTER (WHERE tipo = 'egreso_remesa_blindado' AND estado = 'en_transito') as remesas_transito_cant
        FROM treasury_vault_movements
        WHERE company_id = :cid
    """)
    cash_row = (await db.execute(q_cash, {"cid": uuid.UUID(company_id)})).fetchone()

    # 2. Query checks in custody
    q_checks = text("""
        SELECT 
            COALESCE(SUM(monto), 0) as cheques_custodia_monto,
            COUNT(*) as cheques_custodia_cant
        FROM checks
        WHERE company_id = :cid AND tipo = 'cheque' AND estado = 'cartera' AND fecha_vencimiento >= '2026-01-01'
    """)
    checks_row = (await db.execute(q_checks, {"cid": uuid.UUID(company_id)})).fetchone()

    # 3. Query active POS cash registers that exceed operating cash limit (> 3.000.000 Gs)
    q_alerts = text("""
        SELECT 
            rcs.id, rcs.observaciones as caja_nombre, 
            COALESCE(sr_fun.nombre, 'Cajero #' || rcs.funcionario_codigo) as cajero_nombre,
            rcs.a_rendir as saldo_actual,
            3000000 as limite_maximo,
            (rcs.a_rendir - 3000000) as exceso_monto
        FROM route_cash_settlements rcs
        LEFT JOIN sales_reps sr_fun ON sr_fun.funcionario_codigo = rcs.funcionario_codigo AND sr_fun.company_id = rcs.company_id
        WHERE rcs.company_id = :cid AND rcs.fecha = CURRENT_DATE AND NOT rcs.cerrado AND rcs.a_rendir > 3000000
        ORDER BY rcs.a_rendir DESC
        LIMIT 5
    """)
    alerts_rows = (await db.execute(q_alerts, {"cid": uuid.UUID(company_id)})).fetchall()

    saldo_efectivo = float(cash_row.saldo_efectivo or 0)

    cheques_monto = float(checks_row.cheques_custodia_monto or 0)
    total_custodia = saldo_efectivo + cheques_monto

    return {
        "saldo_efectivo_boveda": saldo_efectivo,
        "ingresos_hoy": float(cash_row.ingresos_hoy or 0),
        "egresos_hoy": float(cash_row.egresos_hoy or 0),
        "cheques_custodia_monto": cheques_monto,
        "cheques_custodia_cant": int(checks_row.cheques_custodia_cant or 0),
        "remesas_transito_monto": float(cash_row.remesas_transito_monto or 0),
        "remesas_transito_cant": int(cash_row.remesas_transito_cant or 0),
        "total_valores_custodia": total_custodia,
        "alertas_cajas_limite": [dict(a._mapping) for a in alerts_rows]
    }


async def list_vault_movements(db: AsyncSession, company_id: str, tipo: str | None = None, limit: int = 50, offset: int = 0) -> list[dict]:
    where = "company_id = :cid"
    params: dict = {"cid": uuid.UUID(company_id), "limit": limit, "offset": offset}
    if tipo:
        where += " AND tipo = :tipo"
        params["tipo"] = tipo

    q = text(f"""
        SELECT 
            id, company_id, tipo, origen_tipo, origen_nombre, monto, moneda,
            transportadora, precinto_bolsa, banco_destino, cuenta_banco,
            cajero, supervisor, estado, observaciones, created_at
        FROM treasury_vault_movements
        WHERE {where}
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
    """)
    res = await db.execute(q, params)
    return [dict(r._mapping) for r in res.fetchall()]


async def create_vault_drop_cash(db: AsyncSession, company_id: str, data: dict) -> dict:
    caja_nombre = data.get("caja_nombre", "Caja Salón")
    cajero = data.get("cajero", "Cajera POS")
    supervisor = data.get("supervisor", "Supervisor de Salón")
    monto = float(data.get("monto", 0))
    obs = data.get("observaciones", "Retiro parcial de efectivo (Drop Cash)")

    q = text("""
        INSERT INTO treasury_vault_movements (
            company_id, tipo, origen_tipo, origen_nombre, monto, moneda,
            cajero, supervisor, estado, observaciones, created_at
        ) VALUES (
            :cid, 'ingreso_caja', 'caja_pos', :caja_nombre, :monto, 'PYG',
            :cajero, :supervisor, 'confirmado', :obs, NOW()
        )
        RETURNING *
    """)
    res = await db.execute(q, {
        "cid": uuid.UUID(company_id),
        "caja_nombre": caja_nombre,
        "monto": monto,
        "cajero": cajero,
        "supervisor": supervisor,
        "obs": obs
    })
    return dict(res.fetchone()._mapping)


async def create_vault_armored_dispatch(db: AsyncSession, company_id: str, data: dict) -> dict:
    transportadora = data.get("transportadora", "Prosegur Paraguay")
    precinto = data.get("precinto_bolsa", "BAG-PY-001")
    banco = data.get("banco_destino", "Banco Itaú Paraguay")
    cuenta = data.get("cuenta_banco", "Cta Cte Principal")
    supervisor = data.get("supervisor", "Tesorero Central")
    monto = float(data.get("monto", 0))
    obs = data.get("observaciones", "Despacho de remesa blindada")

    q = text("""
        INSERT INTO treasury_vault_movements (
            company_id, tipo, origen_tipo, origen_nombre, monto, moneda,
            transportadora, precinto_bolsa, banco_destino, cuenta_banco,
            supervisor, estado, observaciones, created_at
        ) VALUES (
            :cid, 'egreso_remesa_blindado', 'boveda_central', 'Bóveda Central', :monto, 'PYG',
            :transportadora, :precinto, :banco, :cuenta,
            :supervisor, 'en_transito', :obs, NOW()
        )
        RETURNING *
    """)
    res = await db.execute(q, {
        "cid": uuid.UUID(company_id),
        "transportadora": transportadora,
        "precinto": precinto,
        "banco": banco,
        "cuenta": cuenta,
        "supervisor": supervisor,
        "monto": monto,
        "obs": obs
    })
    return dict(res.fetchone()._mapping)
