"""Caja (Cash Register) service"""

from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from datetime import datetime, timezone, date, timedelta
from decimal import Decimal
import uuid

from api.src.caja.models import (
    CashRegister, CashSession, CashCount, CashRegisterMovement, CashHandoff,
    VaultEntry, VaultDepositApprovalRequest, CashDropRequest,
    TreasuryRemittance, TreasuryRemittanceItem,
)
from api.src.sales.models import Sale, SalePayment
from api.src.financial.models import BankAccount, BankTransaction
from api.src.auth.models import User


async def list_registers(db: AsyncSession, company_id: str, branch_id: str | None = None) -> list[CashRegister]:
    query = select(CashRegister).where(CashRegister.activo == True, CashRegister.company_id == company_id)
    if branch_id:
        query = query.where(CashRegister.branch_id == branch_id)
    query = query.order_by(CashRegister.nombre)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_register(db: AsyncSession, register_id: str, company_id: str) -> CashRegister | None:
    result = await db.execute(
        select(CashRegister).where(CashRegister.id == uuid.UUID(register_id), CashRegister.company_id == uuid.UUID(company_id))
    )
    return result.scalar_one_or_none()


async def create_register(db: AsyncSession, data: dict) -> CashRegister:
    register = CashRegister(**data)
    db.add(register)
    await db.flush()
    await db.refresh(register)
    return register


async def update_register(db: AsyncSession, register_id: str, company_id: str, data: dict) -> CashRegister | None:
    register = await get_register(db, register_id, company_id)
    if not register:
        return None
    for key, value in data.items():
        if value is not None:
            setattr(register, key, value)
    await db.flush()
    await db.refresh(register)
    return register


async def delete_register(db: AsyncSession, register_id: str, company_id: str) -> bool:
    register = await get_register(db, register_id, company_id)
    if not register:
        return False
    register.activo = False
    await db.flush()
    return True


async def get_open_session(db: AsyncSession, register_id: str) -> CashSession | None:
    result = await db.execute(
        select(CashSession)
        .where(CashSession.register_id == uuid.UUID(register_id))
        .where(CashSession.estado == "abierta")
        .order_by(CashSession.fecha_apertura.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def list_sessions(
    db: AsyncSession,
    company_id: str,
    register_id: str | None = None,
    user_id: str | None = None,
    estado: str | None = None,
    fecha_desde: datetime | None = None,
    fecha_hasta: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[CashSession]:
    # Sin este join+filtro, cualquier usuario autenticado de CUALQUIER
    # empresa podia listar las sesiones de caja de todas las demas (nombre
    # de cajero, montos de apertura/cierre, estado) -- el unico filtro de
    # tenant en este endpoint faltaba por completo.
    query = select(CashSession).join(CashRegister, CashRegister.id == CashSession.register_id).where(
        CashRegister.company_id == uuid.UUID(company_id)
    )
    if register_id:
        query = query.where(CashSession.register_id == uuid.UUID(register_id))
    if user_id:
        query = query.where(CashSession.user_id == uuid.UUID(user_id))
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
            func.coalesce(func.sum(Sale.monto_donacion), 0).label("total_donaciones"),
        ).where(
            Sale.session_id == session_obj.id,
            Sale.fecha >= session_obj.fecha_apertura,
            Sale.estado == "confirmado",
        )
    )
    row = sales_result.first()
    return {
        "session": session_obj,
        "total_ventas": row.total_ventas if row else 0,
        "total_cobrado": row.total_cobrado if row else 0,
        "total_donaciones": row.total_donaciones if row else 0,
    }


async def get_active_user_session(db: AsyncSession, user_id: str) -> dict | None:
    """Busca si el usuario tiene un turno activo ('abierta') o en relevo ('pausada').
    Permite Turno Nómada (retomar en otra caja) y Modelo A (reanudar tras almuerzo).
    """
    result = await db.execute(
        select(CashSession, CashRegister.nombre.label("register_nombre"), CashRegister.codigo.label("register_codigo"))
        .join(CashRegister, CashRegister.id == CashSession.register_id)
        .where(CashSession.user_id == uuid.UUID(user_id))
        .where(CashSession.estado.in_(["abierta", "pausada"]))
        .order_by(CashSession.fecha_apertura.desc())
        .limit(1)
    )
    row = result.first()
    if not row:
        return None

    session_obj = row[0]

    # Blindaje contra turnos huérfanos o de jornadas anteriores:
    # Si la sesión fue abierta hace más de 16 horas, se considera expirada de la jornada anterior.
    ahora_utc = datetime.now(timezone.utc)
    apertura_utc = session_obj.fecha_apertura
    if apertura_utc.tzinfo is None:
        apertura_utc = apertura_utc.replace(tzinfo=timezone.utc)
    if (ahora_utc - apertura_utc) > timedelta(hours=16):
        session_obj.estado = "cerrada"
        session_obj.fecha_cierre = ahora_utc
        session_obj.observaciones = (session_obj.observaciones or "") + " [Cierre automático por vencimiento de jornada anterior (>16h)]"
        await db.commit()
        return None

    sales_res = await db.execute(
        select(
            func.count(Sale.id).label("total_ventas"),
            func.coalesce(func.sum(Sale.total), 0).label("total_cobrado"),
        ).where(
            Sale.session_id == session_obj.id,
            Sale.estado == "confirmado",
        )
    )
    sales_row = sales_res.first()

    return {
        "id": str(session_obj.id),
        "register_id": str(session_obj.register_id),
        "register_nombre": row.register_nombre,
        "register_codigo": row.register_codigo,
        "user_id": str(session_obj.user_id),
        "cajero_nombre": session_obj.cajero_nombre,
        "monto_apertura": float(session_obj.monto_apertura or 0),
        "monto_apertura_usd": float(session_obj.monto_apertura_usd or 0),
        "monto_apertura_brl": float(session_obj.monto_apertura_brl or 0),
        "fecha_apertura": session_obj.fecha_apertura.isoformat() if session_obj.fecha_apertura else None,
        "estado": session_obj.estado,
        "total_ventas": sales_row.total_ventas if sales_row else 0,
        "total_cobrado": float(sales_row.total_cobrado if sales_row else 0),
    }


async def pause_session(db: AsyncSession, session_id: str, motivo: str | None = None) -> CashSession | None:
    """Pausa el turno de la cajera (Modelo A: Relevo / Salida a Almuerzo con gaveta extraíble).
    La terminal física queda libre para que otra cajera abra su propio turno.
    """
    result = await db.execute(select(CashSession).where(CashSession.id == uuid.UUID(session_id)))
    session_obj = result.scalar_one_or_none()
    if not session_obj:
        return None
    session_obj.estado = "pausada"
    ts = datetime.now(timezone.utc).isoformat()
    nota = f"[{ts}] ⏸️ TURNO PAUSADO (Relevo / Almuerzo) — Motivo: {motivo or 'Salida a almuerzo / relevo de gaveta'}"
    session_obj.observaciones = f"{session_obj.observaciones}\n{nota}" if session_obj.observaciones else nota
    await db.commit()
    await db.refresh(session_obj)
    return session_obj


async def resume_session(
    db: AsyncSession,
    session_id: str,
    register_id: str | None = None,
    punto_emision: str | None = None,
) -> CashSession | None:
    """Reanuda el turno de la cajera en la terminal física actual (Turno Nómada o Reanudación de Almuerzo)."""
    result = await db.execute(select(CashSession).where(CashSession.id == uuid.UUID(session_id)))
    session_obj = result.scalar_one_or_none()
    if not session_obj:
        return None

    prev_reg = str(session_obj.register_id)
    if register_id and uuid.UUID(register_id) != session_obj.register_id:
        session_obj.register_id = uuid.UUID(register_id)

    session_obj.estado = "abierta"
    ts = datetime.now(timezone.utc).isoformat()
    nota = f"[{ts}] ▶️ TURNO REANUDADO / ACTIVO en Caja {register_id or prev_reg} (Punto {punto_emision or 'N/A'})"
    session_obj.observaciones = f"{session_obj.observaciones}\n{nota}" if session_obj.observaciones else nota
    await db.commit()
    await db.refresh(session_obj)
    return session_obj


async def open_session(db: AsyncSession, data: dict) -> CashSession:
    register_id = data["cash_register_id"]
    user_id = data.get("user_id")

    # 1. Si este MISMO usuario ya tiene un turno abierto o pausado, reanudarlo/actualizarlo
    if user_id:
        existing_user_session = await db.execute(
            select(CashSession)
            .where(CashSession.user_id == uuid.UUID(str(user_id)))
            .where(CashSession.estado.in_(["abierta", "pausada"]))
            .order_by(CashSession.fecha_apertura.desc())
            .limit(1)
        )
        user_sess = existing_user_session.scalar_one_or_none()
        if user_sess:
            user_sess.estado = "abierta"
            if register_id:
                user_sess.register_id = register_id
            if data.get("cajero_nombre"):
                user_sess.cajero_nombre = data.get("cajero_nombre")
            if data.get("monto_apertura") is not None and float(data.get("monto_apertura") or 0) > 0 and float(user_sess.monto_apertura or 0) == 0:
                user_sess.monto_apertura = data.get("monto_apertura")
            await db.flush()
            await db.refresh(user_sess)
            return user_sess

    # 2. Si no es el mismo usuario, crear una sesión INDEPENDIENTE y limpia para este cajero
    session_obj = CashSession(
        register_id=register_id,
        user_id=user_id,
        cajero_nombre=data.get("cajero_nombre"),
        monto_apertura=data.get("monto_apertura", 0),
        monto_apertura_usd=data.get("monto_apertura_usd", 0),
        monto_apertura_brl=data.get("monto_apertura_brl", 0),
    )
    db.add(session_obj)
    await db.flush()
    await db.refresh(session_obj)
    return session_obj


async def _efectivo_esperado_por_moneda(db: AsyncSession, session_id, moneda: str) -> Decimal:
    """Efectivo recibido en una moneda durante la sesion (sin conversion — el
    legado tampoco convierte, cada moneda de caja se cuenta por separado)."""
    result = await db.execute(
        select(func.coalesce(func.sum(SalePayment.monto), 0))
        .select_from(SalePayment)
        .join(Sale, Sale.id == SalePayment.sale_id)
        .where(
            Sale.session_id == session_id,
            func.upper(SalePayment.forma_pago) == "EFECTIVO",
            SalePayment.moneda == moneda,
            Sale.estado.in_(["confirmado", "completada", "completado", "pagado"]),
        )
    )
    return Decimal(str(result.scalar() or 0))


async def close_session(
    db: AsyncSession,
    session_id: str,
    monto_cierre_real: Decimal,
    monto_cierre_usd: Decimal = Decimal("0"),
    monto_cierre_brl: Decimal = Decimal("0"),
    observaciones: str | None = None,
    tenant_id: str | None = None,
) -> dict | None:
    result = await db.execute(
        select(CashSession).where(CashSession.id == uuid.UUID(session_id)).with_for_update()
    )
    session_obj = result.scalar_one_or_none()
    if not session_obj or session_obj.estado != "abierta":
        return None

    sales_result = await db.execute(
        select(func.coalesce(func.sum(Sale.total), 0)).where(
            Sale.session_id == session_obj.id,
            Sale.fecha >= session_obj.fecha_apertura,
            Sale.estado.in_(["confirmado", "completada", "completado", "pagado"]),
        )
    )
    total_cobrado = sales_result.scalar() or 0

    monto_apertura_pyg = Decimal(str(session_obj.monto_apertura or 0))
    monto_apertura_usd = Decimal(str(session_obj.monto_apertura_usd or 0))
    monto_apertura_brl = Decimal(str(session_obj.monto_apertura_brl or 0))

    efectivo_pyg_esperado = await _efectivo_esperado_por_moneda(db, session_obj.id, "PYG")
    monto_cierre_esperado = monto_apertura_pyg + efectivo_pyg_esperado
    diferencia = Decimal(str(monto_cierre_real)) - monto_cierre_esperado

    efectivo_usd_esperado = await _efectivo_esperado_por_moneda(db, session_obj.id, "USD")
    efectivo_brl_esperado = await _efectivo_esperado_por_moneda(db, session_obj.id, "BRL")
    
    monto_cierre_esperado_usd = monto_apertura_usd + efectivo_usd_esperado
    monto_cierre_esperado_brl = monto_apertura_brl + efectivo_brl_esperado

    diferencia_usd = monto_cierre_usd - monto_cierre_esperado_usd
    diferencia_brl = monto_cierre_brl - monto_cierre_esperado_brl


    # Desglose de TODAS las formas de pago del turno (no solo efectivo) --
    # antes el cierre no mostraba nada de esto, asi que la cajera/supervisora
    # no tenia forma de ver de un vistazo cuanto se cobro por tarjeta, QR o
    # Extra Club durante el turno.
    payments_result = await db.execute(
        select(SalePayment.forma_pago, SalePayment.moneda, func.coalesce(func.sum(SalePayment.monto), 0))
        .select_from(SalePayment)
        .join(Sale, Sale.id == SalePayment.sale_id)
        .where(Sale.session_id == session_obj.id, Sale.estado == "confirmado")
        .group_by(SalePayment.forma_pago, SalePayment.moneda)
    )
    desglose_formas_pago = [
        {"forma_pago": fp, "moneda": mon, "monto": Decimal(str(monto))}
        for fp, mon, monto in payments_result.all()
    ]

    register_result = await db.execute(select(CashRegister).where(CashRegister.id == session_obj.register_id))
    register = register_result.scalar_one_or_none()
    requiere_revision = bool(
        register and register.diferencia_maxima_tolerada is not None
        and abs(diferencia) > register.diferencia_maxima_tolerada
    )

    session_obj.fecha_cierre = datetime.now(timezone.utc)
    session_obj.monto_cierre = monto_cierre_real
    session_obj.observaciones = observaciones
    session_obj.estado = "cerrada"
    await db.flush()

    count = CashCount(
        session_id=session_obj.id,
        monto_efectivo=monto_cierre_real,
        monto_total=monto_cierre_real,
        diferencia=diferencia,
        monto_efectivo_usd=monto_cierre_usd,
        monto_efectivo_brl=monto_cierre_brl,
        diferencia_usd=diferencia_usd,
        diferencia_brl=diferencia_brl,
        requiere_revision=requiere_revision,
    )
    db.add(count)
    await db.flush()
    await db.refresh(count)

    # Punto de custodia: la sesión se cierra igual (no se bloquea por diferencia,
    # segun lo definido con el cliente), pero el efectivo contado queda "pendiente"
    # bajo responsabilidad de la cajera hasta que un supervisor confirme que lo
    # recibio — antes esto no existia, el cierre era un callejon sin salida.
    handoff = CashHandoff(
        company_id=register.company_id if register else None,
        session_id=session_obj.id,
        cash_count_id=count.id,
        entregado_por=session_obj.user_id,
        entregado_por_nombre=session_obj.cajero_nombre,
        monto_pyg=monto_cierre_real,
        monto_usd=monto_cierre_usd,
        monto_brl=monto_cierre_brl,
        requiere_revision=requiere_revision,
        estado="pendiente",
    )
    db.add(handoff)
    await db.flush()
    await db.refresh(session_obj)

    if requiere_revision and tenant_id:
        # Antes esta alerta se calculaba y se descartaba sin avisar a nadie —
        # ahora dispara una notificacion real a quienes pueden actuar (rol
        # Administrador, hasta que exista un rol dedicado de Supervisor).
        try:
            from api.src.notifications import service as notifications_service
            await notifications_service.create_notification_for_role(
                db, uuid.UUID(tenant_id), "Administrador",
                title="Descuadre de caja requiere revisión",
                body=f"{session_obj.cajero_nombre or 'Un cajero'} cerró con una diferencia de {diferencia:,.0f} Gs. que supera la tolerancia configurada.",
                tipo="alerta_caja",
                link="/caja",
            )
        except Exception:
            pass

    return {
        "session": session_obj,
        "monto_apertura": Decimal(str(session_obj.monto_apertura or 0)),
        "monto_apertura_usd": Decimal(str(session_obj.monto_apertura_usd or 0)),
        "monto_apertura_brl": Decimal(str(session_obj.monto_apertura_brl or 0)),
        "monto_cierre_esperado": monto_cierre_esperado,
        "monto_cierre_esperado_usd": monto_cierre_esperado_usd,
        "monto_cierre_esperado_brl": monto_cierre_esperado_brl,
        "diferencia": diferencia,
        "diferencia_usd": diferencia_usd,
        "diferencia_brl": diferencia_brl,
        "requiere_revision": requiere_revision,
        "handoff_id": handoff.id,
        "total_cobrado": Decimal(str(total_cobrado)),
        "desglose_formas_pago": desglose_formas_pago,
    }



async def list_register_movements(db: AsyncSession, company_id: str, tipo: str | None = None, limit: int = 100) -> list[dict]:
    query = select(CashRegisterMovement).where(CashRegisterMovement.company_id == uuid.UUID(company_id))
    if tipo:
        query = query.where(CashRegisterMovement.tipo == tipo)
    query = query.order_by(CashRegisterMovement.fecha.desc()).limit(limit)
    result = await db.execute(query)
    return [
        {
            "id": str(m.id),
            "register_id": str(m.register_id),
            "tipo": m.tipo,
            "monto": float(m.monto),
            "moneda": m.moneda,
            "fecha": m.fecha.isoformat(),
            "usuario": m.usuario,
            "observaciones": m.observaciones,
        }
        for m in result.scalars().all()
    ]


async def list_sessions_with_totals(
    db: AsyncSession,
    company_id: str,
    register_id: str | None = None,
    estado: str | None = None,
    limit: int = 50,
    offset: int = 0,
    fecha_desde=None,
) -> list[dict]:
    """Sesiones con el monto realmente cobrado (ventas confirmadas vinculadas
    a la sesion real, no una aproximacion por sucursal) y alerta de cash drop.

    fecha_desde filtra por fecha_apertura -- lo usa la PWA de supervisora para
    listar solo cajas de HOY. Una caja abierta que quedo sin cerrar de un dia
    anterior es un problema distinto (arqueo/turno colgado), no algo que la
    supervisora deba seguir viendo en su cola de "cajas activas" del dia."""
    query = select(CashSession).join(CashRegister, CashRegister.id == CashSession.register_id).where(
        CashRegister.company_id == uuid.UUID(company_id)
    )
    if register_id:
        query = query.where(CashSession.register_id == uuid.UUID(register_id))
    if estado:
        query = query.where(CashSession.estado == estado)
    if fecha_desde:
        query = query.where(CashSession.fecha_apertura >= fecha_desde)
    query = query.order_by(CashSession.fecha_apertura.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    sessions = list(result.scalars().all())

    out = []
    for s in sessions:
        cobrado_result = await db.execute(
            select(func.coalesce(func.sum(Sale.total), 0)).where(
                Sale.session_id == s.id,
                Sale.estado == "confirmado",
            )
        )
        monto_cobrado = float(cobrado_result.scalar() or 0)

        cash_drop_alert = False
        cash_drop_warning = False
        cash_drop_threshold_val = None
        efectivo_acumulado = 0.0
        efectivo_usd_acumulado = 0.0
        efectivo_brl_acumulado = 0.0
        if s.estado == "abierta":
            register_result = await db.execute(select(CashRegister).where(CashRegister.id == s.register_id))
            register = register_result.scalar_one_or_none()
            if register:
                desde = s.ultimo_cash_drop_at or s.fecha_apertura
                # Los pagos sincronizados del legado solo tienen granularidad de dia
                # (fin_recebimento.DT_RECEBIMENTO es DATE, sin hora) — comparar por
                # dia en vez de timestamp exacto, o una sesion abierta hoy nunca
                # verian sus propios cobros de hoy (medianoche < hora de apertura).
                # Solo PYG entra en el acumulado que dispara la alerta — el efectivo
                # en USD/BRL se informa aparte, sin mezclarlo (el legado tampoco
                # convierte moneda al arquear).
                monedas_result = await db.execute(
                    select(SalePayment.moneda, func.coalesce(func.sum(SalePayment.monto), 0))
                    .select_from(SalePayment)
                    .join(Sale, Sale.id == SalePayment.sale_id)
                    .where(
                        Sale.session_id == s.id,
                        SalePayment.forma_pago == "EFECTIVO",
                        func.date(SalePayment.fecha) >= func.date(desde),
                    )
                    .group_by(SalePayment.moneda)
                )
                por_moneda = {row[0]: float(row[1]) for row in monedas_result.all()}
                efectivo_acumulado = por_moneda.get("PYG", 0.0)
                efectivo_usd_acumulado = por_moneda.get("USD", 0.0)
                efectivo_brl_acumulado = por_moneda.get("BRL", 0.0)
                if register.cash_drop_threshold:
                    cash_drop_threshold_val = float(register.cash_drop_threshold)
                    cash_drop_alert = efectivo_acumulado >= cash_drop_threshold_val
                    # Aviso temprano al 80% del umbral -- antes era todo o nada
                    # (recien avisaba al superarlo), sin margen para que el
                    # cajero se organice antes de que sea urgente.
                    cash_drop_warning = (not cash_drop_alert) and efectivo_acumulado >= cash_drop_threshold_val * 0.8

        # Arqueo real (CashCount) — antes el historial calculaba una
        # "diferencia" en el frontend como monto_cierre - monto_apertura (eso
        # es la recaudacion del turno, no un descuadre de caja) y nunca
        # mostraba el diferencia real ya sincronizado del legado.
        diferencia = None
        diferencia_usd = None
        diferencia_brl = None
        monto_cierre_esperado = None
        if s.estado == "cerrada":
            count_result = await db.execute(
                select(CashCount).where(CashCount.session_id == s.id).order_by(CashCount.created_at.desc()).limit(1)
            )
            count = count_result.scalar_one_or_none()
            if count:
                diferencia = float(count.diferencia) if count.diferencia is not None else None
                diferencia_usd = float(count.diferencia_usd) if count.diferencia_usd is not None else None
                diferencia_brl = float(count.diferencia_brl) if count.diferencia_brl is not None else None
                monto_cierre_esperado = float(count.monto_total) - float(count.diferencia or 0)
            else:
                monto_cierre_esperado = float(s.monto_apertura) + float(efectivo_acumulado)

        out.append({
            "id": str(s.id),
            "register_id": str(s.register_id),
            "user_id": str(s.user_id),
            "cajero_nombre": s.cajero_nombre,
            "fecha_apertura": s.fecha_apertura.isoformat(),
            "fecha_cierre": s.fecha_cierre.isoformat() if s.fecha_cierre else None,
            "monto_apertura": float(s.monto_apertura),
            "monto_apertura_brl": float(s.monto_apertura_brl or 0),
            "monto_apertura_usd": float(s.monto_apertura_usd or 0),
            "monto_cierre": float(s.monto_cierre) if s.monto_cierre is not None else None,
            "monto_cierre_esperado": monto_cierre_esperado,
            "diferencia": diferencia,
            "diferencia_usd": diferencia_usd,
            "diferencia_brl": diferencia_brl,
            "monto_cobrado": monto_cobrado,
            "estado": s.estado,
            "cash_drop_alert": cash_drop_alert,
            "cash_drop_warning": cash_drop_warning,
            "cash_drop_threshold": cash_drop_threshold_val,
            "efectivo_acumulado": efectivo_acumulado,
            "efectivo_usd_acumulado": efectivo_usd_acumulado,
            "efectivo_brl_acumulado": efectivo_brl_acumulado,
            "ultimo_cash_drop_at": s.ultimo_cash_drop_at.isoformat() if s.ultimo_cash_drop_at else None,
        })
    return out


async def get_session_payment_breakdown(db: AsyncSession, session_id: str) -> dict:
    """Desglose por forma de pago. Se separa PYG (base de los % mostrados) de
    otras monedas (USD/BRL) — mezclarlas en un mismo total daria un porcentaje
    sin sentido, ya que el legado tampoco convierte esos montos."""
    result = await db.execute(
        select(
            SalePayment.forma_pago,
            SalePayment.moneda,
            func.count().label("cantidad"),
            func.sum(SalePayment.monto).label("monto"),
        )
        .select_from(SalePayment)
        .join(Sale, Sale.id == SalePayment.sale_id)
        .where(Sale.session_id == uuid.UUID(session_id))
        .group_by(SalePayment.forma_pago, SalePayment.moneda)
        .order_by(func.sum(SalePayment.monto).desc())
    )
    rows = result.all()
    pyg_rows = [r for r in rows if r.moneda == "PYG"]
    otras_rows = [r for r in rows if r.moneda != "PYG"]
    total_pyg = float(sum(r.monto for r in pyg_rows)) or 1
    return {
        "pyg": [
            {
                "forma_pago": r.forma_pago,
                "cantidad": r.cantidad,
                "monto": float(r.monto),
                "porcentaje": round((float(r.monto) / total_pyg) * 100, 1),
            }
            for r in pyg_rows
        ],
        "otras_monedas": [
            {
                "forma_pago": r.forma_pago,
                "moneda": r.moneda,
                "cantidad": r.cantidad,
                "monto": float(r.monto),
            }
            for r in otras_rows
        ],
    }


async def register_cash_drop(
    db: AsyncSession, session_id: str, monto: Decimal, monto_usd: Decimal = Decimal("0"),
    monto_brl: Decimal = Decimal("0"), observaciones: str | None = None, registrado_por: str | None = None,
) -> CashDropRequest | None:
    """Registra el retiro DECLARADO por la cajera -- ya no entra a boveda de
    forma automatica. Queda pendiente hasta que un supervisor lo confirma con
    su propio recuento (mismo control de doble conteo que ya existe en la
    entrega de cierre de turno via CashHandoff) -- antes el retiro mid-turno
    era el unico movimiento de efectivo sin ningun control de supervisor."""
    result = await db.execute(select(CashSession).where(CashSession.id == uuid.UUID(session_id)))
    session_obj = result.scalar_one_or_none()
    if not session_obj or session_obj.estado != "abierta":
        return None

    register_result = await db.execute(select(CashRegister).where(CashRegister.id == session_obj.register_id))
    register = register_result.scalar_one_or_none()

    request = CashDropRequest(
        company_id=register.company_id if register else None,
        session_id=session_obj.id,
        register_id=session_obj.register_id,
        solicitado_por=uuid.UUID(registrado_por) if registrado_por else session_obj.user_id,
        solicitado_por_nombre=session_obj.cajero_nombre,
        monto_pyg=monto,
        monto_usd=monto_usd,
        monto_brl=monto_brl,
        observaciones=observaciones,
        estado="pendiente",
    )
    db.add(request)
    session_obj.ultimo_cash_drop_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(request)
    return request


async def list_cash_drop_requests(db: AsyncSession, company_id: str, estado: str | None = "pendiente") -> list[dict]:
    query = select(CashDropRequest).where(CashDropRequest.company_id == uuid.UUID(company_id))
    if estado:
        query = query.where(CashDropRequest.estado == estado)
    query = query.order_by(CashDropRequest.created_at.desc())
    result = await db.execute(query)
    requests = list(result.scalars().all())

    register_ids = {r.register_id for r in requests if r.register_id}
    register_nombre_by_id: dict = {}
    if register_ids:
        rows = await db.execute(select(CashRegister.id, CashRegister.nombre).where(CashRegister.id.in_(register_ids)))
        register_nombre_by_id = {rid: nombre for rid, nombre in rows.all()}

    return [
        {
            "id": str(r.id),
            "session_id": str(r.session_id),
            "register_nombre": register_nombre_by_id.get(r.register_id),
            "solicitado_por_nombre": r.solicitado_por_nombre,
            "monto_pyg": float(r.monto_pyg or 0),
            "monto_usd": float(r.monto_usd or 0),
            "monto_brl": float(r.monto_brl or 0),
            "observaciones": r.observaciones,
            "estado": r.estado,
            "confirmado_por_nombre": r.confirmado_por_nombre,
            "monto_confirmado_pyg": float(r.monto_confirmado_pyg) if r.monto_confirmado_pyg is not None else None,
            "monto_confirmado_usd": float(r.monto_confirmado_usd) if r.monto_confirmado_usd is not None else None,
            "monto_confirmado_brl": float(r.monto_confirmado_brl) if r.monto_confirmado_brl is not None else None,
            "discrepancia_confirmacion": r.discrepancia_confirmacion,
            "created_at": r.created_at.isoformat(),
            "fecha_confirmacion": r.fecha_confirmacion.isoformat() if r.fecha_confirmacion else None,
        }
        for r in requests
    ]


async def confirm_cash_drop_request(
    db: AsyncSession, request_id: str, company_id: str, confirmado_por: str, confirmado_por_nombre: str,
    monto_confirmado_pyg: Decimal | None = None, monto_confirmado_usd: Decimal | None = None,
    monto_confirmado_brl: Decimal | None = None,
) -> CashDropRequest | str | None:
    user_result = await db.execute(select(User).where(User.id == uuid.UUID(confirmado_por)))
    supervisor = user_result.scalar_one_or_none()
    if not supervisor or not supervisor.activo or (supervisor.rol not in ("admin", "supervisor") and not supervisor.is_superadmin):
        return "forbidden"

    # SELECT ... FOR UPDATE -- las otras 4 funciones de custodia de dinero en
    # este archivo (void_confirmed_cash_drop, confirm_handoff,
    # approve_vault_deposit, reject_vault_deposit) ya bloquean la fila para
    # evitar que dos confirmaciones casi simultaneas del mismo retiro (doble
    # clic, dos supervisores) lean "pendiente" antes de que cualquiera
    # escriba y ambas terminen insertando un CashRegisterMovement + VaultEntry
    # duplicado -- esta era la unica que faltaba.
    result = await db.execute(
        select(CashDropRequest).where(CashDropRequest.id == uuid.UUID(request_id), CashDropRequest.company_id == uuid.UUID(company_id)).with_for_update()
    )
    req = result.scalar_one_or_none()
    if not req or req.estado != "pendiente":
        return None

    register_result = await db.execute(select(CashRegister).where(CashRegister.id == req.register_id))
    register = register_result.scalar_one_or_none()

    m_pyg = monto_confirmado_pyg if monto_confirmado_pyg is not None else req.monto_pyg
    m_usd = monto_confirmado_usd if monto_confirmado_usd is not None else (req.monto_usd or Decimal("0"))
    m_brl = monto_confirmado_brl if monto_confirmado_brl is not None else (req.monto_brl or Decimal("0"))
    discrepancia = bool(m_pyg != (req.monto_pyg or Decimal("0")) or m_usd != (req.monto_usd or Decimal("0")) or m_brl != (req.monto_brl or Decimal("0")))

    req.estado = "confirmado"
    req.confirmado_por = uuid.UUID(confirmado_por)
    req.confirmado_por_nombre = confirmado_por_nombre
    req.monto_confirmado_pyg = m_pyg
    req.monto_confirmado_usd = m_usd
    req.monto_confirmado_brl = m_brl
    req.discrepancia_confirmacion = discrepancia
    req.fecha_confirmacion = datetime.now(timezone.utc)
    await db.flush()

    db.add(CashRegisterMovement(
        company_id=req.company_id,
        register_id=req.register_id,
        tipo="retiro",
        monto=m_pyg,
        moneda="PYG",
        fecha=datetime.now(timezone.utc),
        observaciones=f"Retiro confirmado, sesión {req.session_id}" + (f" — {req.observaciones}" if req.observaciones else ""),
    ))
    db.add(VaultEntry(
        company_id=req.company_id,
        branch_id=register.branch_id if register else None,
        origen="cash_drop",
        monto_pyg=m_pyg,
        monto_usd=m_usd,
        monto_brl=m_brl,
        estado="en_boveda",
        registrado_por=uuid.UUID(confirmado_por),
        observaciones="Discrepancia con lo declarado por la cajera en el retiro" if discrepancia else None,
    ))
    await db.flush()
    await db.refresh(req)
    return req


async def reject_cash_drop_request(db: AsyncSession, request_id: str, company_id: str, motivo: str) -> CashDropRequest | None:
    result = await db.execute(
        select(CashDropRequest).where(CashDropRequest.id == uuid.UUID(request_id), CashDropRequest.company_id == uuid.UUID(company_id))
    )
    req = result.scalar_one_or_none()
    if not req or req.estado != "pendiente":
        return None
    req.estado = "rechazado"
    req.motivo_rechazo = motivo
    req.fecha_confirmacion = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(req)
    return req


async def void_confirmed_cash_drop(
    db: AsyncSession, request_id: str, company_id: str, anulado_por: str, anulado_por_nombre: str, motivo: str,
) -> CashDropRequest | str | None:
    """Antes, un retiro YA confirmado por un supervisor (con monto mal
    contado, o cargado por error) no tenia forma de deshacerse -- ni la
    CashRegisterMovement ni la VaultEntry que genero confirm_cash_drop_request
    podian anularse, solo corrigiendose a mano en la base. Requiere el mismo
    nivel de autorizacion que confirmar (admin/supervisor), deja el monto
    fuera del saldo de boveda (VaultEntry.estado deja de ser 'en_boveda') y
    dos asientos nuevos (uno en cada ledger) documentando la anulacion en
    vez de borrar el rastro de lo que paso."""
    user_result = await db.execute(select(User).where(User.id == uuid.UUID(anulado_por)))
    supervisor = user_result.scalar_one_or_none()
    if not supervisor or not supervisor.activo or (supervisor.rol not in ("admin", "supervisor") and not supervisor.is_superadmin):
        return "forbidden"

    result = await db.execute(
        select(CashDropRequest)
        .where(CashDropRequest.id == uuid.UUID(request_id), CashDropRequest.company_id == uuid.UUID(company_id))
        .with_for_update()
    )
    req = result.scalar_one_or_none()
    if not req or req.estado != "confirmado":
        return None

    vault_result = await db.execute(
        select(VaultEntry).where(
            VaultEntry.company_id == req.company_id,
            VaultEntry.origen == "cash_drop",
            VaultEntry.estado == "en_boveda",
            VaultEntry.monto_pyg == req.monto_confirmado_pyg,
        ).order_by(VaultEntry.created_at.desc()).limit(1)
    )
    vault_entry = vault_result.scalar_one_or_none()
    if vault_entry:
        vault_entry.estado = "anulado"
        vault_entry.observaciones = f"{vault_entry.observaciones + ' -- ' if vault_entry.observaciones else ''}Anulado por {anulado_por_nombre}: {motivo}"

    req.estado = "anulado"
    req.observaciones = f"{req.observaciones + ' -- ' if req.observaciones else ''}ANULADO por {anulado_por_nombre}: {motivo}"

    db.add(CashRegisterMovement(
        company_id=req.company_id,
        register_id=req.register_id,
        tipo="retiro_anulado",
        monto=req.monto_confirmado_pyg or req.monto_pyg,
        moneda="PYG",
        fecha=datetime.now(timezone.utc),
        observaciones=f"Anulacion de retiro confirmado, sesion {req.session_id} -- {motivo}",
    ))
    await db.flush()
    await db.refresh(req)
    return req


# ── Entregas de efectivo (custodia cajera -> supervisor) ────────────────

async def list_pending_handoffs(db: AsyncSession, company_id: str, estado: str | None = None, limit: int = 100) -> list[dict]:
    """Pese al nombre (mantenido por compatibilidad), lista TODAS las entregas
    por defecto, no solo las pendientes — antes una entrega confirmada
    desaparecia de la lista sin dejar ningun registro visible.

    Antes resolvia session_id -> register_nombre con 2 queries POR FILA (N+1
    real, ~100 queries para 50 entregas) -- con la pantalla de supervisor
    consultando esto cada 15s, el pool de conexiones se agotaba y algunas
    llamadas volvian 500. Se resuelve con un join en batch, una sola vuelta."""
    query = select(CashHandoff).where(CashHandoff.company_id == uuid.UUID(company_id))
    if estado:
        query = query.where(CashHandoff.estado == estado)
    query = query.order_by(CashHandoff.created_at.desc()).limit(limit)
    result = await db.execute(query)
    handoffs = list(result.scalars().all())

    session_ids = {h.session_id for h in handoffs if h.session_id}
    register_by_session: dict = {}
    if session_ids:
        rows = await db.execute(
            select(CashSession.id, CashRegister.nombre)
            .join(CashRegister, CashRegister.id == CashSession.register_id)
            .where(CashSession.id.in_(session_ids))
        )
        register_by_session = {sid: nombre for sid, nombre in rows.all()}

    out = []
    for h in handoffs:
        register_nombre = register_by_session.get(h.session_id)
        out.append({
            "id": str(h.id),
            "session_id": str(h.session_id),
            "register_nombre": register_nombre,
            "entregado_por_nombre": h.entregado_por_nombre,
            "recibido_por_nombre": h.recibido_por_nombre,
            "monto_pyg": float(h.monto_pyg),
            "monto_usd": float(h.monto_usd or 0),
            "monto_brl": float(h.monto_brl or 0),
            "monto_confirmado_pyg": float(h.monto_confirmado_pyg) if h.monto_confirmado_pyg is not None else None,
            "monto_confirmado_usd": float(h.monto_confirmado_usd) if h.monto_confirmado_usd is not None else None,
            "monto_confirmado_brl": float(h.monto_confirmado_brl) if h.monto_confirmado_brl is not None else None,
            "discrepancia_confirmacion": h.discrepancia_confirmacion,
            "requiere_revision": h.requiere_revision,
            "estado": h.estado,
            "created_at": h.created_at.isoformat(),
            "fecha_confirmacion": h.fecha_confirmacion.isoformat() if h.fecha_confirmacion else None,
        })
    return out


async def confirm_handoff(
    db: AsyncSession, handoff_id: str, company_id: str, recibido_por: str, recibido_por_nombre: str,
    monto_confirmado_pyg: Decimal | None = None, monto_confirmado_usd: Decimal | None = None,
    monto_confirmado_brl: Decimal | None = None,
) -> CashHandoff | str | None:
    """El supervisor confirma que recibió el efectivo de la cajera — con su
    propio recuento independiente (no solo aceptar el numero de la cajera),
    que es el control real de doble conteo en el traspaso. A partir de aca la
    responsabilidad del dinero es de tesoreria/boveda, no de la cajera — y se
    genera la entrada real en boveda (antes no existia ningun vinculo).

    Retorna None si no se encontro / ya estaba confirmada / no pertenece a la
    empresa. Retorna "forbidden" (string) si quien confirma no tiene nivel de
    supervisor — se verifica de nuevo aca ademas de en verify-supervisor, para
    que este endpoint no dependa unicamente de que el frontend haya llamado
    a ese paso antes."""
    user_result = await db.execute(select(User).where(User.id == uuid.UUID(recibido_por)))
    supervisor = user_result.scalar_one_or_none()
    if not supervisor or not supervisor.activo or (supervisor.rol not in ("admin", "supervisor") and not supervisor.is_superadmin):
        return "forbidden"

    # FOR UPDATE: dos supervisores confirmando el mismo traspaso casi a la
    # vez no deben generar dos VaultEntry para el mismo efectivo contado una
    # sola vez -- el segundo espera, relee el estado ya "confirmado" y sale
    # por el mismo camino de "ya estaba confirmada" de siempre.
    result = await db.execute(
        select(CashHandoff)
        .where(CashHandoff.id == uuid.UUID(handoff_id), CashHandoff.company_id == uuid.UUID(company_id))
        .with_for_update()
    )
    handoff = result.scalar_one_or_none()
    if not handoff or handoff.estado != "pendiente":
        return None

    session_result = await db.execute(select(CashSession).where(CashSession.id == handoff.session_id))
    session_obj = session_result.scalar_one_or_none()
    branch_id = None
    if session_obj:
        reg_result = await db.execute(select(CashRegister).where(CashRegister.id == session_obj.register_id))
        reg = reg_result.scalar_one_or_none()
        branch_id = reg.branch_id if reg else None

    m_pyg = monto_confirmado_pyg if monto_confirmado_pyg is not None else handoff.monto_pyg
    m_usd = monto_confirmado_usd if monto_confirmado_usd is not None else (handoff.monto_usd or Decimal("0"))
    m_brl = monto_confirmado_brl if monto_confirmado_brl is not None else (handoff.monto_brl or Decimal("0"))
    discrepancia = bool(m_pyg != handoff.monto_pyg or m_usd != (handoff.monto_usd or Decimal("0")) or m_brl != (handoff.monto_brl or Decimal("0")))

    handoff.estado = "confirmado"
    handoff.recibido_por = uuid.UUID(recibido_por)
    handoff.recibido_por_nombre = recibido_por_nombre
    handoff.monto_confirmado_pyg = m_pyg
    handoff.monto_confirmado_usd = m_usd
    handoff.monto_confirmado_brl = m_brl
    handoff.discrepancia_confirmacion = discrepancia
    handoff.fecha_confirmacion = datetime.now(timezone.utc)
    await db.flush()

    # La boveda registra lo que el supervisor efectivamente contó recibir, no
    # lo que la cajera declaró — si hay discrepancia, ese es el monto real
    # que entra a custodia de tesoreria.
    db.add(VaultEntry(
        company_id=handoff.company_id,
        branch_id=branch_id,
        origen="entrega_cajero",
        handoff_id=handoff.id,
        monto_pyg=m_pyg,
        monto_usd=m_usd,
        monto_brl=m_brl,
        estado="en_boveda",
        registrado_por=uuid.UUID(recibido_por),
        observaciones="Discrepancia con lo declarado por la cajera en la entrega" if discrepancia else None,
    ))
    await db.flush()
    await db.refresh(handoff)
    return handoff


# ── Bóveda central ────────────────────────────────────────────────────

async def get_vault_dashboard(db: AsyncSession, company_id: str) -> dict:
    cid = uuid.UUID(company_id)
    en_boveda = await db.execute(
        select(
            func.coalesce(func.sum(VaultEntry.monto_pyg), 0),
            func.coalesce(func.sum(VaultEntry.monto_usd), 0),
            func.coalesce(func.sum(VaultEntry.monto_brl), 0),
            func.count(),
        ).where(VaultEntry.company_id == cid, VaultEntry.estado == "en_boveda")
    )
    pyg, usd, brl, cantidad = en_boveda.first()

    # Custodia y Tránsito
    en_custodia = await db.execute(
        select(func.coalesce(func.sum(VaultEntry.monto_pyg), 0))
        .where(VaultEntry.company_id == cid, VaultEntry.estado == "custodia_supervisor")
    )
    saldo_custodia = en_custodia.scalar() or 0

    en_transito = await db.execute(
        select(func.coalesce(func.sum(VaultEntry.monto_pyg), 0))
        .where(VaultEntry.company_id == cid, VaultEntry.estado == "en_transito")
    )
    saldo_transito = en_transito.scalar() or 0

    pendientes = await list_pending_handoffs(db, company_id, estado="pendiente")
    retiros_pendientes = await list_cash_drop_requests(db, company_id, estado="pendiente")

    # Remitos en tránsito
    remitos_res = await db.execute(
        select(TreasuryRemittance)
        .where(TreasuryRemittance.company_id == cid, TreasuryRemittance.estado == "en_transito")
        .order_by(TreasuryRemittance.created_at.desc())
    )
    remitos_transito = [
        {
            "id": str(r.id),
            "numero": r.numero,
            "supervisor_nombre": r.supervisor_nombre,
            "total_sobres": r.total_sobres,
            "total_pyg": float(r.total_pyg),
            "total_usd": float(r.total_usd or 0),
            "total_brl": float(r.total_brl or 0),
            "fecha_envio": r.fecha_envio.isoformat() if r.fecha_envio else None,
            "observaciones": r.observaciones,
        }
        for r in remitos_res.scalars().all()
    ]

    ultimos_result = await db.execute(
        select(VaultEntry).where(VaultEntry.company_id == cid).order_by(VaultEntry.created_at.desc()).limit(20)
    )
    ultimos = [
        {
            "id": str(v.id), "origen": v.origen, "monto_pyg": float(v.monto_pyg),
            "monto_usd": float(v.monto_usd or 0), "monto_brl": float(v.monto_brl or 0),
            "estado": v.estado, "created_at": v.created_at.isoformat(),
            "fecha_deposito": v.fecha_deposito.isoformat() if v.fecha_deposito else None,
        }
        for v in ultimos_result.scalars().all()
    ]

    return {
        "saldo_en_boveda_pyg": float(pyg), "saldo_en_boveda_usd": float(usd), "saldo_en_boveda_brl": float(brl),
        "saldo_en_custodia_supervisor_pyg": float(saldo_custodia),
        "saldo_en_transito_pyg": float(saldo_transito),
        "entradas_en_boveda": int(cantidad),
        "entregas_pendientes": len(pendientes),
        "entregas_pendientes_detalle": pendientes,
        "retiros_pendientes": len(retiros_pendientes),
        "retiros_pendientes_detalle": retiros_pendientes,
        "remitos_pendientes": len(remitos_transito),
        "remitos_pendientes_detalle": remitos_transito,
        "movimientos_recientes": ultimos,
    }



async def list_vault_entries(db: AsyncSession, company_id: str, estado: str | None = None) -> list[dict]:
    query = select(VaultEntry).where(VaultEntry.company_id == uuid.UUID(company_id))
    if estado:
        query = query.where(VaultEntry.estado == estado)
    query = query.order_by(VaultEntry.created_at.desc())
    result = await db.execute(query)
    return [
        {
            "id": str(v.id), "origen": v.origen, "monto_pyg": float(v.monto_pyg),
            "monto_usd": float(v.monto_usd or 0), "monto_brl": float(v.monto_brl or 0),
            "estado": v.estado, "bank_transaction_id": str(v.bank_transaction_id) if v.bank_transaction_id else None,
            "created_at": v.created_at.isoformat(),
        }
        for v in result.scalars().all()
    ]


async def deposit_vault_entries(db: AsyncSession, company_id: str, entry_ids: list[str], bank_transaction_id: str | None, user_id: str | None) -> int:
    """Marca un lote de entradas de boveda como depositadas — el cierre del
    ciclo cajera -> boveda -> banco. Enlazarlas con un bank_transaction real
    es opcional (se puede hacer despues via conciliacion en Bancos)."""
    result = await db.execute(
        select(VaultEntry).where(VaultEntry.id.in_([uuid.UUID(i) for i in entry_ids]), VaultEntry.company_id == uuid.UUID(company_id))
    )
    entries = list(result.scalars().all())
    count = 0
    for e in entries:
        if e.estado != "en_boveda":
            continue
        e.estado = "depositado"
        e.fecha_deposito = datetime.now(timezone.utc)
        e.bank_transaction_id = uuid.UUID(bank_transaction_id) if bank_transaction_id else None
        e.registrado_por = uuid.UUID(user_id) if user_id else e.registrado_por
        count += 1
    await db.flush()
    return count


# ── Doble aprobación en depósitos grandes a bóveda ───────────────────────
#
# Umbral a partir del cual un depósito a bóveda no se ejecuta de un solo
# paso: queda retenido hasta que Supervisor Y Gerente aprueben (mismo
# patrón que credit_accounts y la corrección de saldo de Bancos). Valor
# inicial razonable, ajustable — no hay un umbral "correcto" único, solo
# uno que empieza a exigir un segundo par de ojos en montos grandes.
VAULT_DEPOSIT_APPROVAL_THRESHOLD = Decimal("10000000")


async def request_or_execute_vault_deposit(
    db: AsyncSession, company_id: str, entry_ids: list[str], bank_transaction_id: str | None, user_id: str | None,
) -> dict:
    result = await db.execute(
        select(VaultEntry).where(
            VaultEntry.id.in_([uuid.UUID(i) for i in entry_ids]),
            VaultEntry.company_id == uuid.UUID(company_id),
            VaultEntry.estado == "en_boveda",
        )
    )
    entries = list(result.scalars().all())
    if not entries:
        return {"error": "Ninguna de las entradas seleccionadas está disponible para depositar"}

    monto_total = sum((e.monto_pyg for e in entries), Decimal("0"))

    if monto_total <= VAULT_DEPOSIT_APPROVAL_THRESHOLD:
        count = await deposit_vault_entries(db, company_id, [str(e.id) for e in entries], bank_transaction_id, user_id)
        return {"deposited": True, "depositadas": count}

    request = VaultDepositApprovalRequest(
        company_id=uuid.UUID(company_id),
        entry_ids=[e.id for e in entries],
        monto_total_pyg=monto_total,
        solicitado_por=uuid.UUID(user_id) if user_id else None,
    )
    db.add(request)
    await db.flush()
    await db.refresh(request)
    return {"pending_approval": True, "request_id": str(request.id), "monto_total_pyg": float(monto_total)}


async def list_vault_deposit_approvals(db: AsyncSession, company_id: str, estado: str | None = "pendiente") -> list[dict]:
    query = select(VaultDepositApprovalRequest).where(VaultDepositApprovalRequest.company_id == uuid.UUID(company_id))
    if estado:
        query = query.where(VaultDepositApprovalRequest.estado == estado)
    query = query.order_by(VaultDepositApprovalRequest.created_at.desc())
    result = await db.execute(query)
    return [
        {
            "id": str(r.id),
            "entry_ids": [str(i) for i in r.entry_ids],
            "monto_total_pyg": float(r.monto_total_pyg),
            "estado": r.estado,
            "aprobado_supervisor_id": str(r.aprobado_supervisor_id) if r.aprobado_supervisor_id else None,
            "aprobado_gerente_id": str(r.aprobado_gerente_id) if r.aprobado_gerente_id else None,
            "created_at": r.created_at.isoformat(),
        }
        for r in result.scalars().all()
    ]


async def approve_vault_deposit(db: AsyncSession, request_id: str, company_id: str, user_id: str, tenant_id: str) -> dict:
    from api.src.rbac.service import get_user_roles

    # FOR UPDATE: dos aprobadores del mismo rol llenando el mismo slot casi
    # a la vez (ej. dos Gerentes) no deben poder pisarse el id el uno al
    # otro -- el segundo espera, relee el slot ya lleno y no vuelve a
    # sobreescribirlo (el UPDATE por PK de SQLAlchemy no distinguia esto).
    result = await db.execute(
        select(VaultDepositApprovalRequest).where(
            VaultDepositApprovalRequest.id == uuid.UUID(request_id),
            VaultDepositApprovalRequest.company_id == uuid.UUID(company_id),
        ).with_for_update()
    )
    request = result.scalar_one_or_none()
    if not request:
        return {"error": "Solicitud no encontrada"}
    if request.estado != "pendiente":
        return {"error": f"La solicitud ya está en estado '{request.estado}'"}

    uid = uuid.UUID(user_id)
    roles = {r["role_name"] for r in await get_user_roles(db, uid, uuid.UUID(tenant_id))}

    # Un solo llamado llena UN solo slot. Ademas de exigir que el slot este
    # vacio, se exige que la OTRA persona (si ya aprobo) no sea la misma —
    # sin este segundo chequeo, alguien con Supervisor+Gerente podria
    # llenar los dos slots solo con roles, sin que importe el orden.
    filled_now = None
    if "Supervisor" in roles and not request.aprobado_supervisor_id and request.aprobado_gerente_id != uid:
        request.aprobado_supervisor_id = uid
        request.aprobado_supervisor_at = datetime.now(timezone.utc)
        filled_now = "supervisor"
    elif "Gerente" in roles and not request.aprobado_gerente_id and request.aprobado_supervisor_id != uid:
        request.aprobado_gerente_id = uid
        request.aprobado_gerente_at = datetime.now(timezone.utc)
        filled_now = "gerente"

    if not filled_now:
        return {"error": "No autorizado: se requiere rol Supervisor o Gerente, y tiene que ser una persona distinta a quien ya aprobó"}

    await db.flush()

    completo = bool(request.aprobado_supervisor_id and request.aprobado_gerente_id)
    if completo:
        request.estado = "aprobado"
        await deposit_vault_entries(db, company_id, [str(i) for i in request.entry_ids], None, user_id)
        await db.flush()

    await db.refresh(request)
    return {"success": True, "completo": completo, "request_id": str(request.id)}


async def reject_vault_deposit(db: AsyncSession, request_id: str, company_id: str, user_id: str, tenant_id: str, motivo: str) -> dict:
    from api.src.rbac.service import get_user_roles

    result = await db.execute(
        select(VaultDepositApprovalRequest).where(
            VaultDepositApprovalRequest.id == uuid.UUID(request_id),
            VaultDepositApprovalRequest.company_id == uuid.UUID(company_id),
        ).with_for_update()
    )
    request = result.scalar_one_or_none()
    if not request:
        return {"error": "Solicitud no encontrada"}
    if request.estado != "pendiente":
        return {"error": f"La solicitud ya está en estado '{request.estado}'"}

    roles = {r["role_name"] for r in await get_user_roles(db, uuid.UUID(user_id), uuid.UUID(tenant_id))}
    if "Supervisor" not in roles and "Gerente" not in roles:
        return {"error": "No autorizado: se requiere rol Supervisor o Gerente"}

    request.estado = "rechazado"
    request.rechazado_por = uuid.UUID(user_id)
    request.rechazado_at = datetime.now(timezone.utc)
    request.rechazado_motivo = motivo
    await db.flush()
    await db.refresh(request)
    return {"success": True}


# ── Remitos de Supervisión a Tesorería / Bóveda Central ─────────────────

async def list_supervisor_pending_sobres(db: AsyncSession, company_id: str, supervisor_id: str | None = None) -> list[dict]:
    cid = uuid.UUID(company_id)
    # Buscamos VaultEntry en estado "custodia_supervisor" o "en_boveda" (no asignadas a remitos)
    query = select(VaultEntry).where(
        VaultEntry.company_id == cid,
        VaultEntry.estado.in_(["custodia_supervisor", "en_boveda"]),
    ).order_by(VaultEntry.created_at.desc())

    res = await db.execute(query)
    entries = list(res.scalars().all())

    # Excluir entradas que ya pertenecen a un remito
    rem_items_res = await db.execute(
        select(TreasuryRemittanceItem.vault_entry_id).where(TreasuryRemittanceItem.vault_entry_id.isnot(None))
    )
    used_entry_ids = set(rem_items_res.scalars().all())

    available = [e for e in entries if e.id not in used_entry_ids]

    results = []
    for e in available:
        caja_nombre = "Caja Principal"
        caja_codigo = "—"
        cajero_nombre = "—"
        tipo_lbl = "sangria" if e.origen == "cash_drop" else ("cierre_turno" if e.origen == "entrega_cajero" else e.origen)

        if e.handoff_id:
            h_res = await db.execute(select(CashHandoff).where(CashHandoff.id == e.handoff_id))
            h = h_res.scalar_one_or_none()
            if h and h.session_id:
                s_res = await db.execute(select(CashSession).where(CashSession.id == h.session_id))
                s = s_res.scalar_one_or_none()
                if s:
                    cajero_nombre = s.cajero_nombre or "—"
                    reg_res = await db.execute(select(CashRegister).where(CashRegister.id == s.register_id))
                    reg = reg_res.scalar_one_or_none()
                    if reg:
                        caja_nombre = reg.nombre
                        caja_codigo = reg.codigo

        results.append({
            "id": str(e.id),
            "tipo_sobre": tipo_lbl,
            "origen": e.origen,
            "monto_pyg": float(e.monto_pyg),
            "monto_usd": float(e.monto_usd or 0),
            "monto_brl": float(e.monto_brl or 0),
            "caja_nombre": caja_nombre,
            "caja_codigo": caja_codigo,
            "cajero_nombre": cajero_nombre,
            "observaciones": e.observaciones,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        })
    return results


async def create_treasury_remittance(
    db: AsyncSession,
    company_id: str,
    supervisor_id: str,
    supervisor_nombre: str,
    item_ids: list[str],
    observaciones: str | None = None,
) -> dict:
    cid = uuid.UUID(company_id)
    sid = uuid.UUID(supervisor_id)
    e_uuids = [uuid.UUID(i) for i in item_ids]

    entries_res = await db.execute(
        select(VaultEntry).where(VaultEntry.id.in_(e_uuids), VaultEntry.company_id == cid)
    )
    entries = list(entries_res.scalars().all())
    if not entries:
        raise ValueError("No se encontraron sobres válidos para incluir en el remito")

    # Generar correlativo REM-YYYYMMDD-XXXX
    today_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    prefix = f"REM-{today_str}-"
    count_res = await db.execute(
        select(func.count()).select_from(TreasuryRemittance).where(
            TreasuryRemittance.company_id == cid,
            TreasuryRemittance.numero.like(f"{prefix}%"),
        )
    )
    count_today = count_res.scalar() or 0
    numero = f"{prefix}{count_today + 1:04d}"

    tot_pyg = sum((e.monto_pyg for e in entries), Decimal("0"))
    tot_usd = sum((e.monto_usd or 0 for e in entries), Decimal("0"))
    tot_brl = sum((e.monto_brl or 0 for e in entries), Decimal("0"))

    remittance = TreasuryRemittance(
        company_id=cid,
        numero=numero,
        supervisor_id=sid,
        supervisor_nombre=supervisor_nombre,
        estado="en_transito",
        total_sobres=len(entries),
        total_pyg=tot_pyg,
        total_usd=tot_usd,
        total_brl=tot_brl,
        fecha_envio=datetime.now(timezone.utc),
        observaciones=observaciones,
    )
    db.add(remittance)
    await db.flush()
    await db.refresh(remittance)

    for e in entries:
        caja_nombre = "Caja Principal"
        caja_codigo = "—"
        cajero_nombre = "—"
        tipo_lbl = "sangria" if e.origen == "cash_drop" else ("cierre_turno" if e.origen == "entrega_cajero" else e.origen)

        if e.handoff_id:
            h_res = await db.execute(select(CashHandoff).where(CashHandoff.id == e.handoff_id))
            h = h_res.scalar_one_or_none()
            if h and h.session_id:
                s_res = await db.execute(select(CashSession).where(CashSession.id == h.session_id))
                s = s_res.scalar_one_or_none()
                if s:
                    cajero_nombre = s.cajero_nombre or "—"
                    reg_res = await db.execute(select(CashRegister).where(CashRegister.id == s.register_id))
                    reg = reg_res.scalar_one_or_none()
                    if reg:
                        caja_nombre = reg.nombre
                        caja_codigo = reg.codigo

        it = TreasuryRemittanceItem(
            remittance_id=remittance.id,
            tipo_sobre=tipo_lbl,
            referencia_id=e.handoff_id,
            vault_entry_id=e.id,
            caja_codigo=caja_codigo,
            caja_nombre=caja_nombre,
            cajero_nombre=cajero_nombre,
            monto_pyg=e.monto_pyg,
            monto_usd=e.monto_usd or 0,
            monto_brl=e.monto_brl or 0,
            verificado_tesoreria=False,
            observaciones=e.observaciones,
        )
        db.add(it)
        e.estado = "en_transito"

    await db.flush()
    await db.refresh(remittance)
    return await get_treasury_remittance(db, company_id, str(remittance.id))


async def list_treasury_remittances(db: AsyncSession, company_id: str, estado: str | None = None) -> list[dict]:
    cid = uuid.UUID(company_id)
    query = select(TreasuryRemittance).where(TreasuryRemittance.company_id == cid)
    if estado:
        query = query.where(TreasuryRemittance.estado == estado)
    query = query.order_by(TreasuryRemittance.created_at.desc())

    res = await db.execute(query)
    remittances = list(res.scalars().all())

    return [
        {
            "id": str(r.id),
            "company_id": str(r.company_id),
            "numero": r.numero,
            "supervisor_id": str(r.supervisor_id),
            "supervisor_nombre": r.supervisor_nombre,
            "tesorero_id": str(r.tesorero_id) if r.tesorero_id else None,
            "tesorero_nombre": r.tesorero_nombre,
            "estado": r.estado,
            "total_sobres": r.total_sobres,
            "total_pyg": float(r.total_pyg),
            "total_usd": float(r.total_usd or 0),
            "total_brl": float(r.total_brl or 0),
            "fecha_envio": r.fecha_envio.isoformat() if r.fecha_envio else None,
            "fecha_recepcion": r.fecha_recepcion.isoformat() if r.fecha_recepcion else None,
            "observaciones": r.observaciones,
            "created_at": r.created_at.isoformat(),
            "updated_at": r.updated_at.isoformat(),
        }
        for r in remittances
    ]


async def get_treasury_remittance(db: AsyncSession, company_id: str, remittance_id: str) -> dict | None:
    cid = uuid.UUID(company_id)
    rid = uuid.UUID(remittance_id)

    r_res = await db.execute(
        select(TreasuryRemittance).where(TreasuryRemittance.id == rid, TreasuryRemittance.company_id == cid)
    )
    r = r_res.scalar_one_or_none()
    if not r:
        return None

    items_res = await db.execute(
        select(TreasuryRemittanceItem).where(TreasuryRemittanceItem.remittance_id == rid).order_by(TreasuryRemittanceItem.created_at.asc())
    )
    items = list(items_res.scalars().all())

    return {
        "id": str(r.id),
        "company_id": str(r.company_id),
        "numero": r.numero,
        "supervisor_id": str(r.supervisor_id),
        "supervisor_nombre": r.supervisor_nombre,
        "tesorero_id": str(r.tesorero_id) if r.tesorero_id else None,
        "tesorero_nombre": r.tesorero_nombre,
        "estado": r.estado,
        "total_sobres": r.total_sobres,
        "total_pyg": float(r.total_pyg),
        "total_usd": float(r.total_usd or 0),
        "total_brl": float(r.total_brl or 0),
        "fecha_envio": r.fecha_envio.isoformat() if r.fecha_envio else None,
        "fecha_recepcion": r.fecha_recepcion.isoformat() if r.fecha_recepcion else None,
        "observaciones": r.observaciones,
        "created_at": r.created_at.isoformat(),
        "updated_at": r.updated_at.isoformat(),
        "items": [
            {
                "id": str(it.id),
                "remittance_id": str(it.remittance_id),
                "tipo_sobre": it.tipo_sobre,
                "referencia_id": str(it.referencia_id) if it.referencia_id else None,
                "vault_entry_id": str(it.vault_entry_id) if it.vault_entry_id else None,
                "caja_codigo": it.caja_codigo,
                "caja_nombre": it.caja_nombre,
                "cajero_nombre": it.cajero_nombre,
                "monto_pyg": float(it.monto_pyg),
                "monto_usd": float(it.monto_usd or 0),
                "monto_brl": float(it.monto_brl or 0),
                "ticket_numero": it.ticket_numero,
                "verificado_tesoreria": it.verificado_tesoreria,
                "observaciones": it.observaciones,
                "created_at": it.created_at.isoformat(),
            }
            for it in items
        ],
    }


async def receive_treasury_remittance(
    db: AsyncSession,
    company_id: str,
    remittance_id: str,
    tesorero_id: str,
    tesorero_nombre: str,
    observaciones: str | None = None,
) -> dict:
    cid = uuid.UUID(company_id)
    rid = uuid.UUID(remittance_id)

    r_res = await db.execute(
        select(TreasuryRemittance).where(TreasuryRemittance.id == rid, TreasuryRemittance.company_id == cid)
    )
    rem = r_res.scalar_one_or_none()
    if not rem:
        raise ValueError("Remito no encontrado")

    if rem.estado == "recibido_en_boveda":
        return await get_treasury_remittance(db, company_id, remittance_id)

    rem.estado = "recibido_en_boveda"
    rem.tesorero_id = uuid.UUID(tesorero_id)
    rem.tesorero_nombre = tesorero_nombre
    rem.fecha_recepcion = datetime.now(timezone.utc)
    if observaciones:
        rem.observaciones = f"{rem.observaciones + ' -- ' if rem.observaciones else ''}{observaciones}"

    # Marcar items verificados y pasar VaultEntry a "en_boveda" (Consolidación definitiva)
    items_res = await db.execute(
        select(TreasuryRemittanceItem).where(TreasuryRemittanceItem.remittance_id == rid)
    )
    items = list(items_res.scalars().all())
    for it in items:
        it.verificado_tesoreria = True
        if it.vault_entry_id:
            ve_res = await db.execute(select(VaultEntry).where(VaultEntry.id == it.vault_entry_id))
            ve = ve_res.scalar_one_or_none()
            if ve:
                ve.estado = "en_boveda"

    await db.flush()
    await db.refresh(rem)
    return await get_treasury_remittance(db, company_id, remittance_id)


async def deposit_vault_to_bank(
    db: AsyncSession,
    company_id: str,
    user_id: str | None,
    bank_account_id: str,
    entry_ids: list[str],
    numero_boleta: str,
    transportadora: str | None = None,
    fecha_deposito_str: str | None = None,
    observaciones: str | None = None,
) -> dict:
    cid = uuid.UUID(company_id)
    bid = uuid.UUID(bank_account_id)
    e_uuids = [uuid.UUID(i) for i in entry_ids]

    # 1. Verificar cuenta bancaria destino
    acc_res = await db.execute(select(BankAccount).where(BankAccount.id == bid, BankAccount.company_id == cid))
    acc = acc_res.scalar_one_or_none()
    if not acc:
        raise ValueError("Cuenta bancaria destino no encontrada")

    # 2. Verificar entradas en bóveda
    entries_res = await db.execute(
        select(VaultEntry).where(
            VaultEntry.id.in_(e_uuids),
            VaultEntry.company_id == cid,
            VaultEntry.estado == "en_boveda",
        )
    )
    entries = list(entries_res.scalars().all())
    if not entries:
        raise ValueError("Ninguna de las entradas seleccionadas está disponible en bóveda")

    tot_pyg = sum((e.monto_pyg for e in entries), Decimal("0"))

    # Fecha del depósito
    f_dep = date.today()
    if fecha_deposito_str:
        try:
            f_dep = date.fromisoformat(fecha_deposito_str.split("T")[0])
        except Exception:
            f_dep = date.today()

    # 3. Crear BankTransaction
    desc = f"Depósito Recaudación Bóveda - Boleta #{numero_boleta}" + (f" ({transportadora})" if transportadora else "")
    if observaciones:
        desc += f" - {observaciones}"

    bank_tx = BankTransaction(
        company_id=cid,
        bank_account_id=acc.id,
        fecha=f_dep,
        tipo="deposito",
        monto=tot_pyg,
        moneda="PYG",
        categoria="deposito_recaudacion_caja",
        descripcion=desc,
        referencia=numero_boleta,
        conciliado=False,
    )
    db.add(bank_tx)
    await db.flush()
    await db.refresh(bank_tx)

    # 4. Acreditar saldo en la cuenta bancaria
    acc.saldo_actual = (acc.saldo_actual or Decimal("0")) + tot_pyg

    # 5. Marcar VaultEntry como depositado
    now_dt = datetime.now(timezone.utc)
    for e in entries:
        e.estado = "depositado"
        e.fecha_deposito = now_dt
        e.bank_transaction_id = bank_tx.id
        if user_id:
            e.registrado_por = uuid.UUID(user_id)

    await db.flush()
    return {
        "success": True,
        "monto_total_pyg": float(tot_pyg),
        "entradas_depositadas": len(entries),
        "bank_transaction_id": str(bank_tx.id),
        "banco_nombre": acc.banco,
        "numero_cuenta": acc.numero_cuenta,
        "numero_boleta": numero_boleta,
    }


# ── Datos para reportes PDF ────────────────────────────────────────────

async def get_arqueo_diario(db: AsyncSession, company_id: str, fecha_desde: datetime, fecha_hasta: datetime) -> list[dict]:
    query = (
        select(CashSession, CashCount, CashRegister.nombre)
        .join(CashRegister, CashRegister.id == CashSession.register_id)
        .join(CashCount, CashCount.session_id == CashSession.id)
        .where(
            CashRegister.company_id == uuid.UUID(company_id),
            CashSession.estado == "cerrada",
            CashSession.fecha_cierre >= fecha_desde,
            CashSession.fecha_cierre <= fecha_hasta,
        )
        .order_by(CashSession.fecha_cierre.desc())
    )
    result = await db.execute(query)
    out = []
    for session_obj, count, register_nombre in result.all():
        # count.monto_total ya es el efectivo contado (monto_cierre_real) y
        # count.diferencia = contado - esperado, asi que
        # (monto_total - diferencia) YA es el esperado completo (que ya
        # incluye el fondo de apertura, sumado en close_session). Sumar
        # monto_apertura de nuevo aca duplicaba el fondo en cada fila del
        # arqueo diario -- el PDF mostraba un "esperado" inflado que nunca
        # cuadraba con la diferencia real de la misma fila.
        monto_cierre_esperado = float(count.monto_total) - float(count.diferencia or 0)
        out.append({
            "cajero_nombre": session_obj.cajero_nombre,
            "register_nombre": register_nombre,
            "fecha_cierre": session_obj.fecha_cierre,
            "monto_cierre_esperado": monto_cierre_esperado,
            "monto_cierre": float(session_obj.monto_cierre) if session_obj.monto_cierre is not None else None,
            "diferencia": float(count.diferencia) if count.diferencia is not None else None,
            "requiere_revision": bool(count.requiere_revision),
        })
    return out


async def get_vault_movimientos(db: AsyncSession, company_id: str, fecha_desde: datetime, fecha_hasta: datetime) -> list[dict]:
    query = (
        select(VaultEntry)
        .where(
            VaultEntry.company_id == uuid.UUID(company_id),
            VaultEntry.created_at >= fecha_desde,
            VaultEntry.created_at <= fecha_hasta,
        )
        .order_by(VaultEntry.created_at.desc())
    )
    result = await db.execute(query)
    return [
        {
            "origen": v.origen,
            "created_at": v.created_at,
            "monto_pyg": float(v.monto_pyg),
            "estado": v.estado,
            "fecha_deposito": v.fecha_deposito,
        }
        for v in result.scalars().all()
    ]


# ── Performance de cajeros ────────────────────────────────────────────

async def get_cajero_performance(db: AsyncSession, company_id: str) -> list[dict]:
    """Ranking de cajeros por descuadre de caja acumulado, usando datos reales
    de cash_sessions/cash_counts (no hay tabla de turnos/horarios porque el
    legado nunca la tuvo — armar una fabricaria datos que no existen; esto
    se calcula sobre lo que sí hay: cada cierre real y su diferencia)."""
    query = (
        select(
            CashSession.cajero_nombre,
            func.count(CashCount.id).label("total_cierres"),
            func.coalesce(func.sum(CashCount.monto_efectivo), 0).label("monto_total_manejado"),
            func.coalesce(func.sum(func.abs(CashCount.diferencia)), 0).label("diferencia_acumulada"),
            func.count(CashCount.id).filter(CashCount.requiere_revision == True).label("cierres_con_revision"),
            func.max(CashSession.fecha_cierre).label("ultimo_cierre"),
        )
        .select_from(CashSession)
        .join(CashRegister, CashRegister.id == CashSession.register_id)
        .join(CashCount, CashCount.session_id == CashSession.id)
        .where(CashRegister.company_id == uuid.UUID(company_id), CashSession.estado == "cerrada")
        .group_by(CashSession.cajero_nombre)
        .order_by(func.coalesce(func.sum(func.abs(CashCount.diferencia)), 0).desc())
    )
    result = await db.execute(query)
    rows = result.all()
    return [
        {
            "cajero_nombre": r.cajero_nombre or "Sin nombre",
            "total_cierres": r.total_cierres,
            "monto_total_manejado": float(r.monto_total_manejado),
            "diferencia_acumulada": float(r.diferencia_acumulada),
            "diferencia_promedio": float(r.diferencia_acumulada) / r.total_cierres if r.total_cierres else 0.0,
            "cierres_con_revision": r.cierres_con_revision,
            "pct_con_revision": round((r.cierres_con_revision / r.total_cierres) * 100, 1) if r.total_cierres else 0.0,
            "ultimo_cierre": r.ultimo_cierre.isoformat() if r.ultimo_cierre else None,
        }
        for r in rows
    ]


# ── Pre-Cierre y Reportes Individuales ─────────────────────────────────

async def get_session_pre_close_summary(db: AsyncSession, session_id: str) -> dict | None:
    """Resumen previo al cierre para que el cajero pueda visualizar los totales
    por medio de pago, donaciones y retiros antes de ingresar el conteo final."""
    result = await db.execute(
        select(CashSession).where(CashSession.id == uuid.UUID(session_id))
    )
    session_obj = result.scalar_one_or_none()
    if not session_obj:
        return None

    # 1. Total ventas y donaciones
    sales_res = await db.execute(
        select(
            func.count(Sale.id).label("total_ventas"),
            func.coalesce(func.sum(Sale.total), 0).label("total_cobrado"),
            func.coalesce(func.sum(Sale.monto_donacion), 0).label("total_donaciones"),
        ).where(
            Sale.session_id == session_obj.id,
            Sale.estado.in_(["confirmado", "completada", "completado", "pagado"]),
        )
    )
    sales_row = sales_res.first()

    # 2. Efectivo esperado por moneda
    efectivo_pyg = await _efectivo_esperado_por_moneda(db, session_obj.id, "PYG")
    efectivo_usd = await _efectivo_esperado_por_moneda(db, session_obj.id, "USD")
    efectivo_brl = await _efectivo_esperado_por_moneda(db, session_obj.id, "BRL")

    # 3. Desglose formas de pago
    payments_res = await db.execute(
        select(
            SalePayment.forma_pago,
            SalePayment.moneda,
            func.count().label("cantidad"),
            func.coalesce(func.sum(SalePayment.monto), 0).label("monto"),
        )
        .select_from(SalePayment)
        .join(Sale, Sale.id == SalePayment.sale_id)
        .where(
            Sale.session_id == session_obj.id,
            Sale.estado.in_(["confirmado", "completada", "completado", "pagado"]),
        )
        .group_by(SalePayment.forma_pago, SalePayment.moneda)
        .order_by(func.sum(SalePayment.monto).desc())
    )
    payments_breakdown = [
        {"forma_pago": fp, "moneda": mon, "cantidad": cant, "monto": float(monto)}
        for fp, mon, cant, monto in payments_res.all()
    ]

    # 4. Retiros (Cash Drops) de esta sesión
    cd_res = await db.execute(
        select(CashDropRequest).where(CashDropRequest.session_id == session_obj.id).order_by(CashDropRequest.created_at.asc())
    )
    drops = list(cd_res.scalars().all())
    drops_list = [
        {
            "id": str(d.id),
            "monto_pyg": float(d.monto_pyg or 0),
            "monto_usd": float(d.monto_usd or 0),
            "monto_brl": float(d.monto_brl or 0),
            "monto_confirmado_pyg": float(d.monto_confirmado_pyg) if d.monto_confirmado_pyg is not None else None,
            "monto_confirmado_usd": float(d.monto_confirmado_usd) if d.monto_confirmado_usd is not None else None,
            "monto_confirmado_brl": float(d.monto_confirmado_brl) if d.monto_confirmado_brl is not None else None,
            "estado": d.estado,
            "created_at": d.created_at.isoformat(),
            "confirmado_por_nombre": d.confirmado_por_nombre,
        }
        for d in drops
    ]

    total_drops_confirmados_pyg = sum(float(d.monto_confirmado_pyg or d.monto_pyg or 0) for d in drops if d.estado == "confirmado")
    total_drops_confirmados_usd = sum(float(d.monto_confirmado_usd or d.monto_usd or 0) for d in drops if d.estado == "confirmado")
    total_drops_confirmados_brl = sum(float(d.monto_confirmado_brl or d.monto_brl or 0) for d in drops if d.estado == "confirmado")

    monto_apertura = float(session_obj.monto_apertura or 0)
    monto_apertura_usd = float(session_obj.monto_apertura_usd or 0)
    monto_apertura_brl = float(session_obj.monto_apertura_brl or 0)

    efectivo_en_gaveta_esperado_pyg = monto_apertura + float(efectivo_pyg) - total_drops_confirmados_pyg
    efectivo_en_gaveta_esperado_usd = monto_apertura_usd + float(efectivo_usd) - total_drops_confirmados_usd
    efectivo_en_gaveta_esperado_brl = monto_apertura_brl + float(efectivo_brl) - total_drops_confirmados_brl

    medios_no_efectivo = [
        {
            "forma_pago": p["forma_pago"],
            "moneda": p["moneda"],
            "cantidad": p["cantidad"],
            "monto": p["monto"],
            "total": p["monto"],
        }
        for p in payments_breakdown
        if p["forma_pago"].upper() != "EFECTIVO"
    ]

    return {
        "session_id": str(session_obj.id),
        "cajero_nombre": session_obj.cajero_nombre,
        "fecha_apertura": session_obj.fecha_apertura.isoformat(),
        "monto_apertura": monto_apertura,
        "monto_apertura_pyg": monto_apertura,
        "monto_apertura_usd": monto_apertura_usd,
        "monto_apertura_brl": monto_apertura_brl,
        "ventas_count": sales_row.total_ventas if sales_row else 0,
        "total_ventas_count": sales_row.total_ventas if sales_row else 0,
        "total_cobrado_pyg": float(sales_row.total_cobrado if sales_row else 0),
        "total_donaciones_pyg": float(sales_row.total_donaciones if sales_row else 0),
        "efectivo_pyg_esperado": float(efectivo_pyg),
        "efectivo_usd_esperado": float(efectivo_usd),
        "efectivo_brl_esperado": float(efectivo_brl),
        "monto_cierre_esperado_pyg": monto_apertura + float(efectivo_pyg),
        "monto_cierre_esperado_usd": monto_apertura_usd + float(efectivo_usd),
        "monto_cierre_esperado_brl": monto_apertura_brl + float(efectivo_brl),
        "efectivo_en_gaveta_esperado_pyg": efectivo_en_gaveta_esperado_pyg,
        "efectivo_en_gaveta_esperado_usd": efectivo_en_gaveta_esperado_usd,
        "efectivo_en_gaveta_esperado_brl": efectivo_en_gaveta_esperado_brl,
        "desglose_formas_pago": payments_breakdown,
        "medios_no_efectivo": medios_no_efectivo,
        "cash_drops": drops_list,
        "total_cash_drops_pyg": total_drops_confirmados_pyg,
        "total_drops_confirmados_pyg": total_drops_confirmados_pyg,
        "total_drops_confirmados_usd": total_drops_confirmados_usd,
        "total_drops_confirmados_brl": total_drops_confirmados_brl,
    }




async def get_cierre_individual_report_data(db: AsyncSession, session_id: str, company_id: str) -> dict | None:
    """Obtiene los datos completos del cierre de una sesión para el PDF."""
    result = await db.execute(
        select(CashSession).where(CashSession.id == uuid.UUID(session_id))
    )
    s = result.scalar_one_or_none()
    if not s:
        return None

    # Obtener caja
    reg_res = await db.execute(select(CashRegister).where(CashRegister.id == s.register_id))
    reg = reg_res.scalar_one_or_none()
    if reg and str(reg.company_id) != str(company_id):
        return None

    # Arqueo (CashCount)
    count_res = await db.execute(
        select(CashCount).where(CashCount.session_id == s.id).order_by(CashCount.created_at.desc()).limit(1)
    )
    count = count_res.scalar_one_or_none()

    efectivo_pyg = await _efectivo_esperado_por_moneda(db, s.id, "PYG")
    efectivo_usd = await _efectivo_esperado_por_moneda(db, s.id, "USD")
    efectivo_brl = await _efectivo_esperado_por_moneda(db, s.id, "BRL")

    monto_apertura_pyg = float(s.monto_apertura or 0)
    monto_apertura_usd = float(s.monto_apertura_usd or 0)
    monto_apertura_brl = float(s.monto_apertura_brl or 0)

    monto_cierre_esperado = monto_apertura_pyg + float(efectivo_pyg)
    monto_cierre_esperado_usd = monto_apertura_usd + float(efectivo_usd)
    monto_cierre_esperado_brl = monto_apertura_brl + float(efectivo_brl)

    # Breakdown formas de pago
    breakdown = await get_session_payment_breakdown(db, str(s.id))

    # Cash drops
    cd_res = await db.execute(
        select(CashDropRequest).where(CashDropRequest.session_id == s.id).order_by(CashDropRequest.created_at.asc())
    )
    drops = list(cd_res.scalars().all())
    drops_list = [
        {
            "created_at": d.created_at,
            "solicitado_por_nombre": d.solicitado_por_nombre,
            "monto_pyg": float(d.monto_pyg or 0),
            "monto_usd": float(d.monto_usd or 0),
            "monto_brl": float(d.monto_brl or 0),
            "monto_confirmado_pyg": float(d.monto_confirmado_pyg) if d.monto_confirmado_pyg is not None else None,
            "confirmado_por_nombre": d.confirmado_por_nombre,
            "estado": d.estado,
        }
        for d in drops
    ]

    session_data = {
        "id": str(s.id),
        "register_nombre": reg.nombre if reg else "Caja",
        "cajero_nombre": s.cajero_nombre or "—",
        "fecha_apertura": s.fecha_apertura,
        "fecha_cierre": s.fecha_cierre,
        "monto_apertura": monto_apertura_pyg,
        "monto_apertura_usd": monto_apertura_usd,
        "monto_apertura_brl": monto_apertura_brl,
        "monto_cierre": float(s.monto_cierre or 0) if s.monto_cierre is not None else 0,
        "monto_cierre_esperado": monto_cierre_esperado,
        "monto_cierre_esperado_usd": monto_cierre_esperado_usd,
        "monto_cierre_esperado_brl": monto_cierre_esperado_brl,
        "efectivo_cobrado_pyg": float(efectivo_pyg),
        "efectivo_usd_esperado": float(efectivo_usd),
        "efectivo_brl_esperado": float(efectivo_brl),
        "monto_efectivo_usd": float(count.monto_efectivo_usd or 0) if count else 0,
        "monto_efectivo_brl": float(count.monto_efectivo_brl or 0) if count else 0,
        "diferencia": float(count.diferencia or 0) if count else 0,
        "diferencia_usd": float(count.diferencia_usd or 0) if count else 0,
        "diferencia_brl": float(count.diferencia_brl or 0) if count else 0,
        "requiere_revision": count.requiere_revision if count else False,
        "observaciones": s.observaciones,
        "estado": s.estado,
    }

    return {
        "session_data": session_data,
        "payments_breakdown": breakdown,
        "cash_drops": drops_list,
    }


async def update_session_fondo_inicial(
    db: AsyncSession,
    session_id: str,
    company_id: str,
    monto_pyg: Decimal,
    monto_brl: Decimal,
    monto_usd: Decimal,
    motivo: str | None,
    supervisor_user: dict,
) -> CashSession:
    res = await db.execute(
        select(CashSession)
        .join(CashRegister, CashRegister.id == CashSession.register_id)
        .where(CashSession.id == uuid.UUID(session_id), CashRegister.company_id == uuid.UUID(company_id))
    )
    session_obj = res.scalar_one_or_none()
    if not session_obj:
        raise ValueError("Sesión de caja no encontrada")

    old_pyg = float(session_obj.monto_apertura or 0)
    old_brl = float(session_obj.monto_apertura_brl or 0)
    old_usd = float(session_obj.monto_apertura_usd or 0)

    session_obj.monto_apertura = monto_pyg
    session_obj.monto_apertura_brl = monto_brl
    session_obj.monto_apertura_usd = monto_usd

    sup_nombre = supervisor_user.get("user_nombre") or supervisor_user.get("user_email") or "Supervisor"
    nota = f" [Fondo ajustado por {sup_nombre}: ₲ {old_pyg:,.0f} -> ₲ {float(monto_pyg):,.0f}, R$ {old_brl} -> R$ {float(monto_brl)}, US$ {old_usd} -> US$ {float(monto_usd)}]"
    if motivo:
        nota += f" (Motivo: {motivo})"
    session_obj.observaciones = (session_obj.observaciones or "") + nota

    await db.commit()
    await db.refresh(session_obj)
    return session_obj


