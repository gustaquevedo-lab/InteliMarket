"""Caja (Cash Register) service"""

from sqlalchemy import select, func, text, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from datetime import datetime, timezone, date, timedelta, time
from zoneinfo import ZoneInfo
from decimal import Decimal
import uuid
import base64
import re

TZ_ASUNCION = ZoneInfo("America/Asuncion")

def _to_asuncion_tz(dt: datetime | None) -> datetime | None:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(TZ_ASUNCION)

from api.src.caja.models import (
    CashRegister, CashSession, CashCount, CashRegisterMovement, CashHandoff,
    VaultEntry, VaultDepositApprovalRequest, CashDropRequest,
    TreasuryRemittance, TreasuryRemittanceItem,
    PaymentMethodBankMapping, CashShortageDeductionRequest, CashShortageConfig,
)
from api.src.sales.models import Sale, SalePayment
from api.src.pos_terminal_transactions.models import PosTerminalTransaction
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
    sess = result.scalar_one_or_none()
    if not sess:
        return None
    # Blindaje contra turnos huérfanos de jornadas anteriores (>16h)
    ahora_utc = datetime.now(timezone.utc)
    apertura_utc = sess.fecha_apertura
    if apertura_utc.tzinfo is None:
        apertura_utc = apertura_utc.replace(tzinfo=timezone.utc)
    if (ahora_utc - apertura_utc) > timedelta(hours=16):
        sess.estado = "cerrada"
        sess.fecha_cierre = ahora_utc
        sess.observaciones = (sess.observaciones or "") + " [Cierre automático por vencimiento (>16h)]"
        await db.commit()
        return None
    return sess


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
    if register_id and uuid.UUID(str(register_id)) != session_obj.register_id:
        session_obj.register_id = uuid.UUID(str(register_id))

    session_obj.estado = "abierta"
    hora_py = datetime.now(TZ_ASUNCION).strftime("%Y-%m-%d %H:%M:%S")
    nota = f"[{hora_py}] ▶️ TURNO REANUDADO / ACTIVO en Caja {register_id or prev_reg} (Punto {punto_emision or 'N/A'})"
    session_obj.observaciones = f"{session_obj.observaciones}\n{nota}" if session_obj.observaciones else nota
    await db.commit()
    await db.refresh(session_obj)
    return session_obj


async def open_session(db: AsyncSession, data: dict) -> CashSession:
    raw_reg = data.get("cash_register_id") or data.get("caja_id")
    register_id = uuid.UUID(str(raw_reg)) if raw_reg else None
    raw_user = data.get("user_id")
    user_id = uuid.UUID(str(raw_user)) if raw_user else None

    # 1. Si este MISMO usuario ya tiene un turno abierto o pausado, reanudarlo/actualizarlo
    if user_id:
        existing_user_session = await db.execute(
            select(CashSession)
            .where(CashSession.user_id == user_id)
            .where(CashSession.estado.in_(["abierta", "pausada"]))
            .order_by(CashSession.fecha_apertura.desc())
            .limit(1)
        )
        user_sess = existing_user_session.scalar_one_or_none()
        if user_sess:
            user_sess.estado = "abierta"
            if register_id and user_sess.register_id != register_id:
                hora_py = datetime.now(TZ_ASUNCION).strftime("%Y-%m-%d %H:%M:%S")
                nota = f"[{hora_py}] 🔄 Rotación nómada: operando en Caja {register_id}"
                user_sess.observaciones = f"{user_sess.observaciones}\n{nota}" if user_sess.observaciones else nota
                user_sess.register_id = register_id
            if data.get("cajero_nombre"):
                user_sess.cajero_nombre = data.get("cajero_nombre")
            if data.get("monto_apertura") is not None and float(data.get("monto_apertura") or 0) > 0 and float(user_sess.monto_apertura or 0) == 0:
                user_sess.monto_apertura = data.get("monto_apertura")
            await db.flush()
            await db.refresh(user_sess)
            return user_sess

    # 2. Si no tiene turno previo de hoy, crear una sesión INDEPENDIENTE y limpia para este cajero
    user_res = await db.execute(select(User).where(User.id == user_id)) if user_id else None
    user_obj = user_res.scalar_one_or_none() if user_res else None
    user_rol = (user_obj.rol if user_obj else "").lower()
    cajero_nom = (data.get("cajero_nombre") or (user_obj.nombre if user_obj else "")).lower()
    is_supervisora = (
        user_rol in ["supervisor", "admin", "administrador"]
        or any(s in cajero_nom for s in ["supervisor", "zunilda", "maristela", "admin"])
    )

    raw_pyg = data.get("monto_apertura")
    raw_brl = data.get("monto_apertura_brl")
    raw_usd = data.get("monto_apertura_usd", 0)

    if is_supervisora:
        monto_pyg = Decimal("0")
        monto_brl = Decimal("0.00")
        monto_usd = Decimal("0.00")
    else:
        monto_pyg = Decimal(str(raw_pyg)) if raw_pyg is not None and float(raw_pyg) > 0 else Decimal("500000")
        monto_brl = Decimal(str(raw_brl)) if raw_brl is not None and float(raw_brl) > 0 else Decimal("300.00")

    session_obj = CashSession(
        register_id=register_id,
        user_id=user_id,
        cajero_nombre=data.get("cajero_nombre") or (user_obj.nombre if user_obj else "Cajero"),
        monto_apertura=monto_pyg,
        monto_apertura_usd=Decimal(str(raw_usd or 0)),
        monto_apertura_brl=monto_brl,
    )
    db.add(session_obj)
    await db.flush()
    await db.refresh(session_obj)
    return session_obj


async def get_effective_exchange_rates_for_session(db: AsyncSession, session_id: uuid.UUID, fecha_apertura: datetime) -> tuple[Decimal, Decimal]:
    """Retorna (tasa_brl, tasa_usd) para la sesión basándose en las cotizaciones
    oficiales registradas en exchange_rates para la fecha de la sesión (o la vigente
    anterior más cercana). NUNCA inventa tasas dividiendo montos de ventas."""
    f_ref = fecha_apertura.date() if fecha_apertura else datetime.now(timezone.utc).date()

    # 1. Tasa BRL oficial de exchange_rates
    er_b = await db.execute(
        text("""
            SELECT tasa_venta FROM exchange_rates
            WHERE moneda = 'BRL' AND fecha <= :f_ape
            ORDER BY fecha DESC, created_at DESC
            LIMIT 1
        """),
        {"f_ape": f_ref}
    )
    erb = er_b.first()
    tasa_brl = Decimal(str(erb[0])) if erb and erb[0] else Decimal("1105.00")

    # 2. Tasa USD oficial de exchange_rates
    er_u = await db.execute(
        text("""
            SELECT tasa_venta FROM exchange_rates
            WHERE moneda = 'USD' AND fecha <= :f_ape
            ORDER BY fecha DESC, created_at DESC
            LIMIT 1
        """),
        {"f_ape": f_ref}
    )
    eru = er_u.first()
    tasa_usd = Decimal(str(eru[0])) if eru and eru[0] else Decimal("5840.00")

    return tasa_brl, tasa_usd


def _format_two_col(left: str, right: str, width: int = 42) -> str:
    space = width - len(left) - len(right)
    if space < 1:
        left = left[:max(1, width - len(right) - 1)]
        space = 1
    return left + (" " * space) + right


def generate_cierre_escpos(recon: dict) -> dict:
    """Genera texto formateado y comandos binarios ESC/POS para impresión térmica de arqueo conforme a la Lógica Inmutable de Arqueo."""
    W = 42
    lines = []
    
    # Header
    lines.append("=" * W)
    lines.append("EXTRA SUPERMERCADO MAYORISTA".center(W))
    lines.append("GRUPO SANTA TERESA E.A.S.".center(W))
    lines.append("RUC: 80150377-9".center(W))
    lines.append("TIMBRADO: 18545636".center(W))
    lines.append("=" * W)
    lines.append("CIERRE DE CAJA / ARQUEO".center(W))
    lines.append("-" * W)
    
    # Metadata
    lines.append(f"Cajero/a:   {recon['cajero_nombre']}")
    if len(recon.get("terminales_operadas", [])) > 1:
        pts = ", ".join(f"P.{t['punto']}" for t in recon["terminales_operadas"])
        lines.append(f"Cajas (Nómada): {pts}")
    else:
        lines.append(f"Caja:       {recon['register_nombre']}")
    lines.append(f"Turno ID:   {recon['session_id'][:8].upper()}")
    lines.append(f"Apertura:   {recon['fecha_apertura_str']}")
    lines.append(f"Cierre:     {recon['fecha_cierre_str']}")
    lines.append(f"Cotiz. BRL: 1 R$ = {recon['tasa_brl']:,.0f} Gs.")
    if recon.get('efectivo_usd', 0) > 0 or recon.get('contado_usd', 0) > 0 or recon.get('fondo_usd', 0) > 0:
        lines.append(f"Cotiz. USD: 1 U$ = {recon['tasa_usd']:,.0f} Gs.")
    lines.append("-" * W)
    
    # 1. Fondos de Apertura Recibidos (Desglosados Bimonetarios)
    lines.append("[1. FONDOS DE APERTURA RECIBIDOS]")
    lines.append(_format_two_col("  Fondo Inicial Gs.:", f"{recon['fondo_pyg']:,.0f} Gs.", W))
    lines.append(_format_two_col("  Fondo Inicial R$ (Vuelto):", f"R$ {recon['fondo_brl']:,.2f}", W))
    if recon.get('fondo_usd', 0) > 0:
        lines.append(_format_two_col("  Fondo Inicial US$:", f"US$ {recon['fondo_usd']:,.2f}", W))
    lines.append("-" * W)

    # 2. Comprobantes de Pago No Efectivo (para cotejo físico)
    lines.append("[2. COMPROBANTES DE PAGO NO EFECTIVO]")
    medios_no_ef = [item for item in recon.get("medios_pago_detallados", []) if "EFECTIVO" not in item.get("clave", "")]
    tot_no_ef_gs = sum(item["monto_gs"] for item in medios_no_ef)
    if medios_no_ef:
        for item in medios_no_ef:
            lines.append(_format_two_col(f"  {item['label']}:", item['monto_formateado'], W))
        lines.append("-" * W)
        lines.append(_format_two_col("  Total Comprobantes:", f"{tot_no_ef_gs:,.0f} Gs.", W))
    else:
        lines.append("  (Sin comprobantes no efectivo)")
    lines.append(_format_two_col("TOTAL FACTURADO (Tickets):", f"{recon['total_cobrado_gs']:,.0f} Gs.", W))
    lines.append("-" * W)

    # 3. Efectivo Esperado en Gaveta
    lines.append("[3. EFECTIVO ESPERADO EN GAVETA]")
    lines.append(_format_two_col("  Devolución Fondo Gs.:", f"{recon['fondo_pyg']:,.0f} Gs.", W))
    lines.append(_format_two_col("  (+) Ventas Efectivo Gs.:", f"{recon.get('efectivo_pyg', 0):,.0f} Gs.", W))
    if recon.get('total_drops_gs', 0) > 0:
        lines.append(_format_two_col("  (-) Retiros / Drops Gs.:", f"-{recon['total_drops_gs']:,.0f} Gs.", W))
    esp_pyg = recon.get('esp_pyg', recon['fondo_pyg'] + recon.get('efectivo_pyg', 0) - recon.get('total_drops_gs', 0))
    lines.append(_format_two_col("  >> Total Esperado Gs.:", f"{esp_pyg:,.0f} Gs.", W))
    lines.append("")
    lines.append(_format_two_col("  Devolución Fondo R$:", f"R$ {recon['fondo_brl']:,.2f}", W))
    if recon.get('efectivo_brl', 0) > 0:
        lines.append(_format_two_col("  (+) Cobros en Reales:", f"R$ {recon['efectivo_brl']:,.2f}", W))
    esp_brl = recon.get('esp_brl', recon['fondo_brl'] + recon.get('efectivo_brl', 0))
    lines.append(_format_two_col("  >> Total Esperado R$:", f"R$ {esp_brl:,.2f}", W))
    if recon.get('efectivo_usd', 0) > 0 or recon.get('fondo_usd', 0) > 0:
        esp_usd = recon['fondo_usd'] + recon.get('efectivo_usd', 0)
        lines.append(_format_two_col("  >> Total Esperado US$:", f"US$ {esp_usd:,.2f}", W))
    lines.append("-" * W)

    # 4. Arqueo Físico Real en Gaveta
    lines.append("[4. ARQUEO FISICO REAL EN GAVETA]")
    lines.append(_format_two_col("  Contado Guaraníes:", f"{recon['contado_pyg']:,.0f} Gs.", W))
    lines.append("  (Fondo devuelto + Recaudación Gs.)")
    lines.append(_format_two_col("  Contado Reales:", f"R$ {recon['contado_brl']:,.2f}", W))
    lines.append(f"  ({recon['contado_brl_gs']:,.0f} Gs. equivalentes)")
    if recon.get('contado_usd', 0) > 0:
        lines.append(_format_two_col("  Contado Dólares:", f"US$ {recon['contado_usd']:,.2f}", W))
        lines.append(f"  ({recon['contado_usd_gs']:,.0f} Gs. equivalentes)")
    lines.append("-" * W)
    lines.append(_format_two_col("TOTAL RENDIDO EN GAVETA:", f"{recon['contado_total_gs']:,.0f} Gs.", W))
    lines.append("=" * W)

    # 5. Conciliación y Dictamen
    dif = recon['diferencia_consolidada_gs']
    signo = "+" if dif > 0 else ""
    lines.append(_format_two_col("DIFERENCIA CONSOLIDADA GS:", f"{signo}{dif:,.0f} Gs.", W))
    estado_cuadre = "CUADRADO" if abs(dif) < 5000 else ("SOBRANTE" if dif > 0 else "FALTANTE")
    lines.append(f"DICTAMEN AUDITORIA: {estado_cuadre}".center(W))
    lines.append("=" * W)

    # Detalle de compensación por moneda
    dif_mon_pyg = recon['contado_pyg'] - esp_pyg
    dif_mon_brl = recon['contado_brl'] - esp_brl
    comp_brl_gs = dif_mon_brl * recon['tasa_brl']
    lines.append("Detalle por Moneda:")
    signo_p = "+" if dif_mon_pyg >= 0 else ""
    signo_b = "+" if dif_mon_brl >= 0 else ""
    signo_cb = "+" if comp_brl_gs >= 0 else ""
    lines.append(f"  • Guaraníes: {signo_p}{dif_mon_pyg:,.0f} Gs.")
    lines.append(f"  • Reales:    {signo_b}{dif_mon_brl:,.2f} R$ ({signo_cb}{comp_brl_gs:,.0f} Gs.)")
    lines.append("-" * W)
    lines.append("")
    lines.append("")
    lines.append("Firma Cajero/a:   ________________________")
    lines.append("")
    lines.append("Firma Supervisora: _______________________")
    lines.append("")
    lines.append("")
    
    ticket_text = "\n".join(lines)
    
    # Binario ESC/POS
    ESC = b"\x1b"
    GS = b"\x1d"
    escpos_bytes = bytearray()
    escpos_bytes.extend(ESC + b"@")  # Init
    escpos_bytes.extend(ESC + b"t\x00")  # Code table PC437
    
    for l in lines:
        if "=" in l or "EXTRA SUPERMERCADO" in l or "DIFERENCIA" in l or "TOTAL" in l or "DICTAMEN" in l or "FONDOS" in l or "ARQUEO" in l or "ESPERADO" in l:
            escpos_bytes.extend(ESC + b"E\x01")  # Bold on
            escpos_bytes.extend(l.encode("latin1", errors="replace") + b"\n")
            escpos_bytes.extend(ESC + b"E\x00")  # Bold off
        else:
            escpos_bytes.extend(l.encode("latin1", errors="replace") + b"\n")
            
    escpos_bytes.extend(b"\n\n\n\n")
    escpos_bytes.extend(GS + b"V\x01")  # Partial cut
    
    b64 = base64.b64encode(escpos_bytes).decode("ascii")
    return {
        "ticket_text": ticket_text,
        "ticket_escpos_b64": b64,
    }


async def get_session_reconciliation_data(db: AsyncSession, session_id: str | uuid.UUID) -> dict | None:
    """Calcula la conciliación y arqueo unificado en Guaraníes para una sesión de caja."""
    s_uuid = uuid.UUID(str(session_id))
    result = await db.execute(select(CashSession).where(CashSession.id == s_uuid))
    session_obj = result.scalar_one_or_none()
    if not session_obj:
        return None

    # Datos de caja
    reg_result = await db.execute(select(CashRegister).where(CashRegister.id == session_obj.register_id))
    register_obj = reg_result.scalar_one_or_none()

    # Arqueo existente
    count_result = await db.execute(
        select(CashCount).where(CashCount.session_id == session_obj.id).order_by(CashCount.created_at.desc()).limit(1)
    )
    count_obj = count_result.scalar_one_or_none()

    # Tasas efectivas
    tasa_brl, tasa_usd = await get_effective_exchange_rates_for_session(db, session_obj.id, session_obj.fecha_apertura)

    # Ventas totales
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

    # Formas de pago
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
    payments_rows = payments_res.all()

    # Clasificación individualizada
    efectivo_pyg = Decimal("0")
    efectivo_brl = Decimal("0")
    efectivo_usd = Decimal("0")
    
    medios_individuales = {
        "TARJETA_BANCARD": {"label": "Bancard Tarjeta", "cantidad": 0, "monto_gs": Decimal("0")},
        "TARJETA_DINELCO": {"label": "Dinelco Tarjeta", "cantidad": 0, "monto_gs": Decimal("0")},
        "BANCARD_QR": {"label": "Bancard QR", "cantidad": 0, "monto_gs": Decimal("0")},
        "DINELCO_QR": {"label": "Dinelco QR", "cantidad": 0, "monto_gs": Decimal("0")},
        "PIX": {"label": "PIX Brasil", "cantidad": 0, "monto_gs": Decimal("0")},
        "EXTRA_CLUB": {"label": "Extra Club (Crédito)", "cantidad": 0, "monto_gs": Decimal("0")},
        "VALES": {"label": "Vales / Cheques", "cantidad": 0, "monto_gs": Decimal("0")},
        "TRANSFERENCIA": {"label": "Transferencia Bancaria", "cantidad": 0, "monto_gs": Decimal("0")},
        "OTROS": {"label": "Otros Medios", "cantidad": 0, "monto_gs": Decimal("0")},
    }

    desglose_detallado = []

    for fp_raw, mon, cant, m in payments_rows:
        fp_upper = (fp_raw or "").upper()
        m_dec = Decimal(str(m))

        if fp_upper == "EFECTIVO":
            if mon == "PYG":
                efectivo_pyg += m_dec
            elif mon == "BRL":
                efectivo_brl += m_dec
            elif mon == "USD":
                efectivo_usd += m_dec
            continue

        # Convertir a Gs si el medio estuviera en divisa
        m_gs = m_dec * tasa_brl if mon == "BRL" else (m_dec * tasa_usd if mon == "USD" else m_dec)

        if "DINELCO" in fp_upper and ("QR" in fp_upper):
            medios_individuales["DINELCO_QR"]["cantidad"] += cant
            medios_individuales["DINELCO_QR"]["monto_gs"] += m_gs
        elif "QR" in fp_upper:
            medios_individuales["BANCARD_QR"]["cantidad"] += cant
            medios_individuales["BANCARD_QR"]["monto_gs"] += m_gs
        elif "DINELCO" in fp_upper:
            medios_individuales["TARJETA_DINELCO"]["cantidad"] += cant
            medios_individuales["TARJETA_DINELCO"]["monto_gs"] += m_gs
        elif "BANCARD" in fp_upper or "TARJETA" in fp_upper or "DEBITO" in fp_upper or "CREDITO" in fp_upper:
            medios_individuales["TARJETA_BANCARD"]["cantidad"] += cant
            medios_individuales["TARJETA_BANCARD"]["monto_gs"] += m_gs
        elif "PIX" in fp_upper:
            medios_individuales["PIX"]["cantidad"] += cant
            medios_individuales["PIX"]["monto_gs"] += m_gs
        elif "EXTRA_CLUB" in fp_upper:
            medios_individuales["EXTRA_CLUB"]["cantidad"] += cant
            medios_individuales["EXTRA_CLUB"]["monto_gs"] += m_gs
        elif "VALE" in fp_upper or "CHEQUE" in fp_upper:
            medios_individuales["VALES"]["cantidad"] += cant
            medios_individuales["VALES"]["monto_gs"] += m_gs
        elif "TRANSFERENCIA" in fp_upper:
            medios_individuales["TRANSFERENCIA"]["cantidad"] += cant
            medios_individuales["TRANSFERENCIA"]["monto_gs"] += m_gs
        else:
            medios_individuales["OTROS"]["cantidad"] += cant
            medios_individuales["OTROS"]["monto_gs"] += m_gs

    # Agregar efectivo a la lista de presentación
    desglose_detallado.append({
        "clave": "EFECTIVO_PYG",
        "label": "Efectivo Gs.",
        "monto_formateado": f"{efectivo_pyg:,.0f} Gs.",
        "monto_gs": float(efectivo_pyg),
    })
    if efectivo_brl > 0:
        brl_gs = efectivo_brl * tasa_brl
        desglose_detallado.append({
            "clave": "EFECTIVO_BRL",
            "label": "Efectivo R$",
            "monto_formateado": f"R$ {efectivo_brl:,.2f} ({brl_gs:,.0f} Gs.)",
            "monto_gs": float(brl_gs),
        })
    if efectivo_usd > 0:
        usd_gs = efectivo_usd * tasa_usd
        desglose_detallado.append({
            "clave": "EFECTIVO_USD",
            "label": "Efectivo US$",
            "monto_formateado": f"US$ {efectivo_usd:,.2f} ({usd_gs:,.0f} Gs.)",
            "monto_gs": float(usd_gs),
        })

    for k, v in medios_individuales.items():
        if v["monto_gs"] > 0 or v["cantidad"] > 0:
            desglose_detallado.append({
                "clave": k,
                "label": f"{v['label']} ({v['cantidad']})",
                "monto_formateado": f"{v['monto_gs']:,.0f} Gs.",
                "monto_gs": float(v["monto_gs"]),
            })

    # Drops confirmados
    drops_res = await db.execute(
        select(CashDropRequest).where(CashDropRequest.session_id == session_obj.id)
    )
    drops = list(drops_res.scalars().all())
    d_pyg = sum(Decimal(str(d.monto_confirmado_pyg or d.monto_pyg or 0)) for d in drops if d.estado == "confirmado")
    d_brl = sum(Decimal(str(d.monto_confirmado_brl or d.monto_brl or 0)) for d in drops if d.estado == "confirmado")
    d_usd = sum(Decimal(str(d.monto_confirmado_usd or d.monto_usd or 0)) for d in drops if d.estado == "confirmado")
    total_drops_gs = d_pyg + (d_brl * tasa_brl) + (d_usd * tasa_usd)

    # Total recaudado por medios no efectivo (Tarjetas, QR, Extra Club, etc.)
    total_no_efectivo_gs = sum(v["monto_gs"] for v in medios_individuales.values())
    total_cobrado_gs = Decimal(str(sales_row.total_cobrado or 0))

    # Ventas en efectivo netas consolidadas (el efectivo neto que ingresó a la gaveta por ventas,
    # compensando automáticamente cualquier vuelto entregado en Guaraníes por cobros en divisa)
    ventas_ef_total_gs = max(Decimal("0"), total_cobrado_gs - total_no_efectivo_gs)

    # Fondos iniciales (Regla inmutable: cajera no supervisora siempre abre con Gs. 500.000 y R$ 300; supervisoras abren sin inicial)
    user_res = await db.execute(select(User).where(User.id == session_obj.user_id)) if session_obj.user_id else None
    user_obj = user_res.scalar_one_or_none() if user_res else None
    user_rol = (user_obj.rol if user_obj else "").lower()
    cajero_nom = (session_obj.cajero_nombre or "").lower()
    is_supervisora = (
        user_rol in ["supervisor", "admin", "administrador"]
        or any(s in cajero_nom for s in ["supervisor", "zunilda", "maristela", "admin"])
    )

    fondo_pyg = Decimal(str(session_obj.monto_apertura or 0))
    fondo_brl = Decimal(str(session_obj.monto_apertura_brl or 0))
    fondo_usd = Decimal(str(session_obj.monto_apertura_usd or 0))

    if is_supervisora:
        fondo_pyg = Decimal("0")
        fondo_brl = Decimal("0.00")
        fondo_usd = Decimal("0.00")
    else:
        # Si la cajera contó exactamente su recaudación de ventas (sin incluir el fondo inicial en gaveta),
        # o si la apertura no registró fondo, evitar clavarle un descuadre ficticio de 833.000 Gs
        if count_obj:
            c_pyg = Decimal(str(count_obj.monto_efectivo or 0))
            c_brl = Decimal(str(count_obj.monto_efectivo_brl or 0))
            c_tot_gs = c_pyg + (c_brl * tasa_brl)
            if abs(c_tot_gs - ventas_ef_total_gs) < Decimal("25000") and c_tot_gs > Decimal("0"):
                fondo_pyg = Decimal("0")
                fondo_brl = Decimal("0.00")
            else:
                fondo_pyg = Decimal("500000")
                fondo_brl = Decimal("300.00")
        else:
            fondo_pyg = Decimal("500000")
            fondo_brl = Decimal("300.00")

    fondo_brl_gs = fondo_brl * tasa_brl
    fondo_usd_gs = fondo_usd * tasa_usd
    fondo_total_gs = fondo_pyg + fondo_brl_gs + fondo_usd_gs

    # Total esperado en gaveta
    esperado_total_gs = fondo_total_gs + ventas_ef_total_gs - total_drops_gs

    # Arqueo contado
    if count_obj:
        contado_pyg = Decimal(str(count_obj.monto_efectivo if count_obj.monto_efectivo is not None else (session_obj.monto_cierre or 0)))
        contado_brl = Decimal(str(count_obj.monto_efectivo_brl or 0))
        contado_usd = Decimal(str(count_obj.monto_efectivo_usd or 0))
    else:
        contado_pyg = Decimal(str(session_obj.monto_cierre or 0))
        contado_brl = Decimal("0")
        contado_usd = Decimal("0")

    contado_brl_gs = contado_brl * tasa_brl
    contado_usd_gs = contado_usd * tasa_usd
    contado_total_gs = contado_pyg + contado_brl_gs + contado_usd_gs

    # Diferencia Consolidada
    diferencia_consolidada_gs = contado_total_gs - esperado_total_gs

    ap_loc = _to_asuncion_tz(session_obj.fecha_apertura)
    ci_loc = _to_asuncion_tz(session_obj.fecha_cierre)
    fecha_ap_str = ap_loc.strftime("%d/%m/%Y %H:%M") if ap_loc else "-"
    fecha_ci_str = ci_loc.strftime("%d/%m/%Y %H:%M") if ci_loc else "EN CURSO"

    # Terminales / Puntos de emisión operados en esta sesión nómada
    sales_num_res = await db.execute(
        select(Sale.numero, Sale.total)
        .where(
            Sale.session_id == session_obj.id,
            Sale.estado.in_(["confirmado", "completada", "completado", "pagado"]),
            Sale.numero.isnot(None),
        )
    )
    terms_map: dict[str, dict] = {}
    for num, tot in sales_num_res.all():
        if num and "-" in num:
            parts = num.split("-")
            pto = parts[1] if len(parts) >= 2 else "001"
            if pto not in terms_map:
                terms_map[pto] = {"punto": pto, "tickets": 0, "total": 0.0}
            terms_map[pto]["tickets"] += 1
            terms_map[pto]["total"] += float(tot or 0)
    terminales_operadas = sorted(terms_map.values(), key=lambda x: x["tickets"], reverse=True)

    recon_data = {
        "session_id": str(session_obj.id),
        "register_id": str(session_obj.register_id),
        "register_nombre": register_obj.nombre if register_obj else "Caja",
        "cajero_nombre": session_obj.cajero_nombre or "—",
        "fecha_apertura_str": fecha_ap_str,
        "fecha_cierre_str": fecha_ci_str,
        "estado": session_obj.estado,
        "tasa_brl": float(tasa_brl),
        "tasa_usd": float(tasa_usd),
        "fondo_pyg": float(fondo_pyg),
        "fondo_brl": float(fondo_brl),
        "fondo_usd": float(fondo_usd),
        "fondo_brl_gs": float(fondo_brl_gs),
        "fondo_usd_gs": float(fondo_usd_gs),
        "fondo_total_gs": float(fondo_total_gs),
        "total_no_efectivo_gs": float(total_no_efectivo_gs),
        "efectivo_pyg": float(efectivo_pyg),
        "efectivo_brl": float(efectivo_brl),
        "efectivo_usd": float(efectivo_usd),
        "ventas_ef_total_gs": float(ventas_ef_total_gs),
        "esp_pyg": float(fondo_pyg + Decimal(str(efectivo_pyg)) - total_drops_gs),
        "esp_brl": float(fondo_brl + Decimal(str(efectivo_brl))),
        "esp_usd": float(fondo_usd + Decimal(str(efectivo_usd))),
        "total_drops_gs": float(total_drops_gs),
        "esperado_total_gs": float(esperado_total_gs),
        "contado_pyg": float(contado_pyg),
        "contado_brl": float(contado_brl),
        "contado_usd": float(contado_usd),
        "contado_brl_gs": float(contado_brl_gs),
        "contado_usd_gs": float(contado_usd_gs),
        "contado_total_gs": float(contado_total_gs),
        "diferencia_consolidada_gs": float(diferencia_consolidada_gs),
        "total_ventas_count": sales_row.total_ventas if sales_row else 0,
        "total_cobrado_gs": float(sales_row.total_cobrado if sales_row else 0),
        "terminales_operadas": terminales_operadas,
        "medios_pago_detallados": desglose_detallado,
        "desglose_detallado": desglose_detallado,
    }

    escpos = generate_cierre_escpos(recon_data)
    recon_data["ticket_text"] = escpos["ticket_text"]
    recon_data["ticket_escpos_b64"] = escpos["ticket_escpos_b64"]
    return recon_data


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
    if not session_obj or session_obj.estado not in ("abierta", "pausada"):
        return None

    # Registrar el cierre
    session_obj.fecha_cierre = datetime.now(timezone.utc)
    session_obj.monto_cierre = monto_cierre_real
    session_obj.observaciones = observaciones
    session_obj.estado = "cerrada"
    await db.flush()

    # Conciliación consolidada unificada en Guaraníes
    recon = await get_session_reconciliation_data(db, session_obj.id)
    tasa_brl = Decimal(str(recon["tasa_brl"])) if recon else Decimal("1")
    tasa_usd = Decimal(str(recon["tasa_usd"])) if recon else Decimal("1")

    monto_apertura_pyg = Decimal(str(recon["fondo_pyg"])) if recon else Decimal(str(session_obj.monto_apertura or 0))
    monto_apertura_usd = Decimal(str(recon["fondo_usd"])) if recon else Decimal(str(session_obj.monto_apertura_usd or 0))
    monto_apertura_brl = Decimal(str(recon["fondo_brl"])) if recon else Decimal(str(session_obj.monto_apertura_brl or 0))

    # Monto de cierre esperado consolidado (100% en Guaraníes)
    monto_cierre_esperado_total_gs = Decimal(str(recon["esperado_total_gs"])) if recon else Decimal("0")

    # Total contado declarado consolidado en Guaraníes
    contado_total_gs = Decimal(str(monto_cierre_real)) + (Decimal(str(monto_cierre_brl)) * tasa_brl) + (Decimal(str(monto_cierre_usd)) * tasa_usd)

    # Diferencia unificada en Guaraníes (sin desdoblar faltantes ni sobrantes en moneda extranjera)
    diferencia_consolidada = contado_total_gs - monto_cierre_esperado_total_gs

    register_result = await db.execute(select(CashRegister).where(CashRegister.id == session_obj.register_id))
    register = register_result.scalar_one_or_none()
    requiere_revision = bool(
        register and register.diferencia_maxima_tolerada is not None
        and abs(diferencia_consolidada) > register.diferencia_maxima_tolerada
    )

    count = CashCount(
        session_id=session_obj.id,
        monto_efectivo=monto_cierre_real,
        monto_total=contado_total_gs,
        diferencia=diferencia_consolidada,
        monto_efectivo_usd=monto_cierre_usd,
        monto_efectivo_brl=monto_cierre_brl,
        diferencia_usd=Decimal("0"),
        diferencia_brl=Decimal("0"),
        requiere_revision=requiere_revision,
    )
    db.add(count)
    await db.flush()
    await db.refresh(count)

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
        try:
            from api.src.notifications import service as notifications_service
            await notifications_service.create_notification_for_role(
                db, uuid.UUID(tenant_id), "Administrador",
                title="Descuadre de caja requiere revisión",
                body=f"{session_obj.cajero_nombre or 'Un cajero'} cerró con una diferencia de {diferencia_consolidada:,.0f} Gs. que supera la tolerancia configurada.",
                tipo="alerta_caja",
                link="/caja",
            )
        except Exception:
            pass

    # Obtener reconciliación completa para el ticket de cierre inmediato
    recon = await get_session_reconciliation_data(db, session_obj.id)

    return {
        "session": session_obj,
        "monto_apertura": monto_apertura_pyg,
        "monto_apertura_usd": monto_apertura_usd,
        "monto_apertura_brl": monto_apertura_brl,
        "monto_cierre_esperado": monto_cierre_esperado_total_gs,
        "monto_cierre_esperado_usd": monto_apertura_usd,
        "monto_cierre_esperado_brl": monto_apertura_brl,
        "diferencia": diferencia_consolidada,
        "diferencia_usd": Decimal("0"),
        "diferencia_brl": Decimal("0"),
        "requiere_revision": requiere_revision,
        "handoff_id": handoff.id,
        "reconciliation": recon,
        "ticket_text": recon.get("ticket_text") if recon else None,
        "ticket_escpos_b64": recon.get("ticket_escpos_b64") if recon else None,
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
    fecha_hasta=None,
    cajero_nombre: str | None = None,
    user_id: str | None = None,
    search: str | None = None,
) -> list[dict]:
    """Sesiones con el monto realmente cobrado (ventas confirmadas vinculadas
    a la sesion real) y conciliación consistente."""
    query = select(CashSession).join(CashRegister, CashRegister.id == CashSession.register_id).where(
        CashRegister.company_id == uuid.UUID(company_id)
    )
    if register_id:
        query = query.where(CashSession.register_id == uuid.UUID(register_id))
    if estado:
        query = query.where(CashSession.estado == estado)
    if user_id:
        query = query.where(CashSession.user_id == uuid.UUID(user_id))
    if cajero_nombre:
        query = query.where(CashSession.cajero_nombre.ilike(f"%{cajero_nombre.strip()}%"))
    if fecha_desde:
        query = query.where(func.coalesce(CashSession.fecha_cierre, CashSession.fecha_apertura) >= fecha_desde)
    if fecha_hasta:
        query = query.where(CashSession.fecha_apertura <= fecha_hasta)
    if search and search.strip():
        s_clean = search.strip()
        from sqlalchemy import or_, cast, String
        query = query.where(
            or_(
                CashSession.cajero_nombre.ilike(f"%{s_clean}%"),
                CashRegister.nombre.ilike(f"%{s_clean}%"),
                CashRegister.codigo.ilike(f"%{s_clean}%"),
                cast(CashSession.id, String).ilike(f"%{s_clean}%"),
                CashSession.observaciones.ilike(f"%{s_clean}%"),
            )
        )

    query = query.order_by(CashSession.fecha_apertura.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    sessions = list(result.scalars().all())

    if not sessions:
        return []

    session_ids = [s.id for s in sessions]

    # Batch 1: Total cobrado por sesión (1 sola query agregada para todo el listado)
    cobrado_query = (
        select(Sale.session_id, func.coalesce(func.sum(Sale.total), 0))
        .where(
            Sale.session_id.in_(session_ids),
            Sale.estado.in_(["confirmado", "completada", "completado", "pagado"]),
        )
        .group_by(Sale.session_id)
    )
    cobrado_res = await db.execute(cobrado_query)
    cobrado_map = {row[0]: float(row[1]) for row in cobrado_res.all()}

    # Batch 2: Último CashCount de cada sesión cerrada (1 sola query con DISTINCT ON)
    closed_session_ids = [s.id for s in sessions if s.estado == "cerrada"]
    counts_map = {}
    if closed_session_ids:
        counts_query = (
            select(CashCount)
            .where(CashCount.session_id.in_(closed_session_ids))
            .distinct(CashCount.session_id)
            .order_by(CashCount.session_id, CashCount.created_at.desc())
        )
        counts_res = await db.execute(counts_query)
        for c in counts_res.scalars().all():
            counts_map[c.session_id] = c

    out = []
    for s in sessions:
        monto_cobrado = cobrado_map.get(s.id, 0.0)

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
                monedas_result = await db.execute(
                    select(SalePayment.moneda, func.coalesce(func.sum(SalePayment.monto), 0))
                    .select_from(SalePayment)
                    .join(Sale, Sale.id == SalePayment.sale_id)
                    .where(
                        Sale.session_id == s.id,
                        Sale.estado.in_(["confirmado", "completada", "completado", "pagado"]),
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
                    cash_drop_warning = (not cash_drop_alert) and efectivo_acumulado >= cash_drop_threshold_val * 0.8

        # Arqueo real (CashCount)
        diferencia = None
        diferencia_usd = None
        diferencia_brl = None
        monto_cierre_esperado = None
        monto_cierre_declarado = None
        if s.estado == "cerrada":
            count = counts_map.get(s.id)
            if count:
                diferencia = float(count.diferencia) if count.diferencia is not None else 0.0
                diferencia_usd = float(count.diferencia_usd) if count.diferencia_usd is not None else 0.0
                diferencia_brl = float(count.diferencia_brl) if count.diferencia_brl is not None else 0.0
                monto_cierre_declarado = float(count.monto_total) if count.monto_total is not None else (float(s.monto_cierre) if s.monto_cierre is not None else 0.0)
                monto_cierre_esperado = monto_cierre_declarado - diferencia
            else:
                monto_cierre_declarado = float(s.monto_cierre) if s.monto_cierre is not None else 0.0
                monto_cierre_esperado = float(s.monto_apertura) + float(efectivo_acumulado)
                diferencia = 0.0

        out.append({
            "id": str(s.id),
            "register_id": str(s.register_id),
            "user_id": str(s.user_id),
            "cajero_nombre": s.cajero_nombre,
            "fecha_apertura": s.fecha_apertura.isoformat() if s.fecha_apertura else None,
            "fecha_cierre": s.fecha_cierre.isoformat() if s.fecha_cierre else None,
            "monto_apertura": float(s.monto_apertura or 0),
            "monto_apertura_brl": float(s.monto_apertura_brl or 0),
            "monto_apertura_usd": float(s.monto_apertura_usd or 0),
            "monto_cierre": monto_cierre_declarado if s.estado == "cerrada" else (float(s.monto_cierre) if s.monto_cierre is not None else None),
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


async def get_session_sales_detail(db: AsyncSession, session_id: str, company_id: str) -> dict | None:
    """Retorna el detalle completo de las ventas que componen una sesión de caja específica,
    junto con sus medios de pago, clientes, y resumen financiero consistente."""
    s_uuid = uuid.UUID(str(session_id))
    c_uuid = uuid.UUID(str(company_id))

    sess_res = await db.execute(
        select(CashSession, CashRegister)
        .join(CashRegister, CashRegister.id == CashSession.register_id)
        .where(CashSession.id == s_uuid, CashRegister.company_id == c_uuid)
    )
    row = sess_res.first()
    if not row:
        return None
    session_obj, register_obj = row

    # 1. Obtener reconciliación completa y tasas
    recon = await get_session_reconciliation_data(db, session_obj.id)
    tasa_brl = float(recon.get("tasa_brl", 1400.0)) if recon else 1400.0
    tasa_usd = float(recon.get("tasa_usd", 7800.0)) if recon else 7800.0

    # 2. Consultar todas las ventas de la sesión con cliente
    from api.src.customers.models import Customer
    sales_query = (
        select(
            Sale,
            Customer.razon_social.label("cust_razon_social"),
            Customer.nombre_fantasia.label("cust_nombre_fantasia"),
            Customer.ruc.label("cust_ruc"),
            Customer.ci.label("cust_ci"),
        )
        .outerjoin(Customer, Customer.id == Sale.customer_id)
        .where(Sale.session_id == s_uuid)
        .order_by(Sale.fecha.asc())
    )
    sales_res = await db.execute(sales_query)
    sales_rows = sales_res.all()

    sale_ids = [r[0].id for r in sales_rows]

    # 3. Consultar pagos de las ventas
    payments_map: dict[uuid.UUID, list[dict]] = {}
    if sale_ids:
        pay_query = (
            select(SalePayment)
            .where(SalePayment.sale_id.in_(sale_ids))
            .order_by(SalePayment.fecha.asc(), SalePayment.created_at.asc())
        )
        pay_res = await db.execute(pay_query)
        for p in pay_res.scalars().all():
            if p.sale_id not in payments_map:
                payments_map[p.sale_id] = []
            payments_map[p.sale_id].append({
                "forma_pago": p.forma_pago,
                "moneda": p.moneda or "PYG",
                "monto": float(p.monto or 0),
            })

    # 4. Consultar conteo de items por venta
    items_count_map: dict[uuid.UUID, int] = {}
    if sale_ids:
        from api.src.sales.models import SaleItem
        ic_query = (
            select(SaleItem.sale_id, func.count(SaleItem.id))
            .where(SaleItem.sale_id.in_(sale_ids))
            .group_by(SaleItem.sale_id)
        )
        ic_res = await db.execute(ic_query)
        for s_id, count_val in ic_res.all():
            items_count_map[s_id] = count_val

    # 5. Formatear detalle de ventas
    sales_list = []
    total_ventas_gs = Decimal("0")
    total_descuentos_gs = Decimal("0")
    total_donaciones_gs = Decimal("0")
    total_iva_10_gs = Decimal("0")
    total_iva_5_gs = Decimal("0")
    total_exenta_gs = Decimal("0")
    confirmadas_count = 0
    anuladas_count = 0
    anuladas_total_gs = Decimal("0")

    for sale, cust_rs, cust_nom_fantasia, cust_ruc, cust_ci in sales_rows:
        is_confirmed = (sale.estado or "").lower() in ["confirmado", "completada", "completado", "pagado"]
        is_cancelled = (sale.estado or "").lower() in ["cancelado", "anulado", "anulada", "devuelto"]

        tot = Decimal(str(sale.total or 0))
        desc = Decimal(str(sale.descuento_total or 0))
        dona = Decimal(str(sale.monto_donacion or 0))

        if is_confirmed:
            total_ventas_gs += tot
            total_descuentos_gs += desc
            total_donaciones_gs += dona
            total_iva_10_gs += Decimal(str(sale.iva_10 or 0))
            total_iva_5_gs += Decimal(str(sale.iva_5 or 0))
            total_exenta_gs += Decimal(str(sale.base_exenta or 0))
            confirmadas_count += 1
        elif is_cancelled:
            anuladas_count += 1
            anuladas_total_gs += tot

        cliente_nombre = cust_rs or cust_nom_fantasia or "Consumidor Final"
        cliente_doc = cust_ruc or cust_ci or "X"

        p_list = payments_map.get(sale.id, [])
        if not p_list:
            fp_resumen = "Sin detalle"
        elif len(p_list) == 1:
            p0 = p_list[0]
            mon_sym = "₲" if p0["moneda"] == "PYG" else ("R$" if p0["moneda"] == "BRL" else "US$")
            fp_resumen = f"{p0['forma_pago']} {mon_sym} {p0['monto']:,.0f}" if p0["moneda"] == "PYG" else f"{p0['forma_pago']} {mon_sym} {p0['monto']:,.2f}"
        else:
            fp_resumen = "Mixto (" + " + ".join(f"{p['forma_pago']} ({p['moneda']})" for p in p_list) + ")"

        fecha_loc = _to_asuncion_tz(sale.fecha)
        sales_list.append({
            "id": str(sale.id),
            "numero": sale.numero,
            "numero_interno": sale.numero_interno,
            "fecha": sale.fecha.isoformat() if sale.fecha else None,
            "fecha_local": fecha_loc.strftime("%d/%m/%Y %H:%M:%S") if fecha_loc else "-",
            "hora_local": fecha_loc.strftime("%H:%M:%S") if fecha_loc else "-",
            "tipo_comprobante": sale.tipo_comprobante,
            "condicion": sale.condicion,
            "estado": sale.estado,
            "cliente_nombre": cliente_nombre,
            "cliente_ruc": cliente_doc,
            "subtotal": float(sale.subtotal or 0),
            "descuento": float(desc),
            "total": float(tot),
            "monto_donacion": float(dona),
            "iva_10": float(sale.iva_10 or 0),
            "iva_5": float(sale.iva_5 or 0),
            "base_exenta": float(sale.base_exenta or 0),
            "items_count": items_count_map.get(sale.id, 0),
            "pagos": p_list,
            "forma_pago_resumen": fp_resumen,
        })

    ap_loc = _to_asuncion_tz(session_obj.fecha_apertura)
    ci_loc = _to_asuncion_tz(session_obj.fecha_cierre)

    return {
        "session": {
            "id": str(session_obj.id),
            "register_id": str(session_obj.register_id),
            "register_nombre": register_obj.nombre if register_obj else "Caja",
            "register_codigo": register_obj.codigo if register_obj else "-",
            "cajero_nombre": session_obj.cajero_nombre or "—",
            "user_id": str(session_obj.user_id) if session_obj.user_id else None,
            "fecha_apertura": session_obj.fecha_apertura.isoformat() if session_obj.fecha_apertura else None,
            "fecha_cierre": session_obj.fecha_cierre.isoformat() if session_obj.fecha_cierre else None,
            "fecha_apertura_local": ap_loc.strftime("%d/%m/%Y %H:%M:%S") if ap_loc else "-",
            "fecha_cierre_local": ci_loc.strftime("%d/%m/%Y %H:%M:%S") if ci_loc else "EN CURSO",
            "estado": session_obj.estado,
            "observaciones": session_obj.observaciones,
        },
        "totales": {
            "total_ventas_gs": float(total_ventas_gs),
            "cantidad_ventas": confirmadas_count,
            "ticket_promedio_gs": float(total_ventas_gs / confirmadas_count) if confirmadas_count > 0 else 0.0,
            "total_descuentos_gs": float(total_descuentos_gs),
            "total_donaciones_gs": float(total_donaciones_gs),
            "total_iva_10_gs": float(total_iva_10_gs),
            "total_iva_5_gs": float(total_iva_5_gs),
            "total_exenta_gs": float(total_exenta_gs),
            "cantidad_anuladas": anuladas_count,
            "total_anuladas_gs": float(anuladas_total_gs),
            "fondo_apertura_gs": float(recon.get("fondo_pyg", 0.0)) if recon else float(session_obj.monto_apertura or 0),
            "fondo_apertura_brl": float(recon.get("fondo_brl", 0.0)) if recon else float(session_obj.monto_apertura_brl or 0),
            "fondo_apertura_usd": float(recon.get("fondo_usd", 0.0)) if recon else float(session_obj.monto_apertura_usd or 0),
            "ventas_efectivo_gs": float(recon.get("ventas_ef_total_gs", 0.0)) if recon else 0.0,
            "ventas_no_efectivo_gs": float(recon.get("total_no_efectivo_gs", 0.0)) if recon else 0.0,
            "total_drops_gs": float(recon.get("total_drops_gs", 0.0)) if recon else 0.0,
            "esperado_gaveta_gs": float(recon.get("esperado_total_gs", 0.0)) if recon else 0.0,
            "declarado_gaveta_gs": float(recon.get("contado_total_gs", 0.0)) if recon else 0.0,
            "diferencia_gs": float(recon.get("diferencia_consolidada_gs", 0.0)) if recon else 0.0,
            "tasa_brl": tasa_brl,
            "tasa_usd": tasa_usd,
        },
        "desglose_medios": (recon.get("desglose_detallado") or recon.get("medios_pago_detallados") or []) if recon else [],
        "reconciliation": recon,
        "sales": sales_list,
    }


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
    if request.company_id:
        try:
            from api.src.events.manager import manager
            await manager.broadcast(str(request.company_id), {
                "type": "cash_drop_requested",
                "request_id": str(request.id),
                "cajero_nombre": request.solicitado_por_nombre,
                "monto_pyg": float(request.monto_pyg or 0),
            })
        except Exception:
            pass
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

    # Mapear session_id para cada sobre si viene de CashHandoff o CashDrop
    handoff_ids = [it.referencia_id for it in items if it.referencia_id and it.tipo_sobre == "cierre_turno"]
    drop_ids = [it.referencia_id for it in items if it.referencia_id and it.tipo_sobre == "sangria"]
    session_map: dict[uuid.UUID, str] = {}
    if handoff_ids:
        h_res = await db.execute(select(CashHandoff.id, CashHandoff.session_id).where(CashHandoff.id.in_(handoff_ids)))
        for hid, sid in h_res.all():
            session_map[hid] = str(sid)
    if drop_ids:
        d_res = await db.execute(select(CashDropRequest.id, CashDropRequest.session_id).where(CashDropRequest.id.in_(drop_ids)))
        for did, sid in d_res.all():
            session_map[did] = str(sid)

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
                "session_id": session_map.get(it.referencia_id) if it.referencia_id else None,
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

async def get_arqueo_diario(db: AsyncSession, company_id: str, fecha_desde: date | datetime, fecha_hasta: date | datetime) -> list[dict]:
    py_tz = ZoneInfo("America/Asuncion")
    if isinstance(fecha_desde, date) and not isinstance(fecha_desde, datetime):
        fecha_desde = datetime.combine(fecha_desde, time.min, tzinfo=py_tz)
    elif isinstance(fecha_desde, datetime) and fecha_desde.tzinfo is None:
        fecha_desde = fecha_desde.replace(tzinfo=py_tz)

    if isinstance(fecha_hasta, date) and not isinstance(fecha_hasta, datetime):
        fecha_hasta = datetime.combine(fecha_hasta, time.max, tzinfo=py_tz)
    elif isinstance(fecha_hasta, datetime) and fecha_hasta.tzinfo is None:
        fecha_hasta = fecha_hasta.replace(tzinfo=py_tz)

    query = (
        select(CashSession, CashCount, CashRegister.nombre)
        .join(CashRegister, CashRegister.id == CashSession.register_id)
        .join(CashCount, CashCount.session_id == CashSession.id)
        .join(User, User.id == CashSession.user_id)
        .where(
            CashRegister.company_id == uuid.UUID(company_id),
            CashSession.estado == "cerrada",
            CashSession.fecha_cierre >= fecha_desde,
            CashSession.fecha_cierre <= fecha_hasta,
            or_(
                func.coalesce(
                    (
                        select(func.count(Sale.id))
                        .where(Sale.session_id == CashSession.id)
                        .scalar_subquery()
                    ),
                    0,
                ) > 0,
                func.extract("epoch", CashSession.fecha_cierre - CashSession.fecha_apertura) >= 120,
            ),
        )
        .order_by(CashSession.fecha_cierre.desc())
    )
    result = await db.execute(query)
    rows = result.all()
    if not rows:
        return []

    # 1. Obtener pagos reales registrados por el POS para todas las sesiones del período
    session_ids = [session_obj.id for session_obj, _, _ in rows]
    payments_by_session: dict[uuid.UUID, dict] = {}

    if session_ids:
        pay_query = (
            select(
                Sale.session_id,
                SalePayment.forma_pago,
                SalePayment.moneda,
                func.coalesce(func.sum(SalePayment.monto), 0).label("total_monto"),
            )
            .select_from(SalePayment)
            .join(Sale, Sale.id == SalePayment.sale_id)
            .where(
                Sale.session_id.in_(session_ids),
                Sale.estado.in_(["confirmado", "completada", "completado", "pagado"]),
            )
            .group_by(Sale.session_id, SalePayment.forma_pago, SalePayment.moneda)
        )
        pay_res = await db.execute(pay_query)
        for sid, fp_raw, mon, monto in pay_res.all():
            if sid not in payments_by_session:
                payments_by_session[sid] = {
                    "bancard": Decimal("0"),
                    "dinelco": Decimal("0"),
                    "qr": Decimal("0"),
                    "pix": Decimal("0"),
                    "transferencia": Decimal("0"),
                    "extra_club": Decimal("0"),
                    "cheque": Decimal("0"),
                    "otro": Decimal("0"),
                    "efectivo_pyg": Decimal("0"),
                    "efectivo_brl": Decimal("0"),
                    "efectivo_usd": Decimal("0"),
                }
            fp = (fp_raw or "").upper()
            m = Decimal(str(monto or 0))
            if "EFECTIVO" in fp:
                if mon == "BRL":
                    payments_by_session[sid]["efectivo_brl"] += m
                elif mon == "USD":
                    payments_by_session[sid]["efectivo_usd"] += m
                else:
                    payments_by_session[sid]["efectivo_pyg"] += m
            elif "DINELCO" in fp and "QR" not in fp:
                payments_by_session[sid]["dinelco"] += m
            elif any(t in fp for t in ["BANCARD", "TARJETA", "DEBITO", "CREDITO"]) and "QR" not in fp:
                payments_by_session[sid]["bancard"] += m
            elif "PIX" in fp:
                payments_by_session[sid]["pix"] += m
            elif "QR" in fp:
                payments_by_session[sid]["qr"] += m
            elif "TRANSFERENCIA" in fp or "TRANSF" in fp or "SIPAP" in fp:
                payments_by_session[sid]["transferencia"] += m
            elif "EXTRA_CLUB" in fp or "CLUB" in fp or "CREDITO_CLIENTE" in fp:
                payments_by_session[sid]["extra_club"] += m
            elif "CHEQUE" in fp or "VALE" in fp:
                payments_by_session[sid]["cheque"] += m
            else:
                payments_by_session[sid]["otro"] += m

    out = []
    for session_obj, count, register_nombre in rows:
        pays = payments_by_session.get(session_obj.id, {})

        # Desglose por Procesador / Canal Operativo de Tesorería acordado
        m_bancard = float(pays.get("bancard", 0))
        m_dinelco = float(pays.get("dinelco", 0))
        m_qr = float(pays.get("qr", 0))
        m_pix = float(pays.get("pix", 0))
        m_transf = float(pays.get("transferencia", 0))
        m_extra_club = float(pays.get("extra_club", 0))
        m_cheque = float(count.monto_cheque or 0) or float(pays.get("cheque", 0))
        m_otro = float(count.monto_otro or 0) or float(pays.get("otro", 0))

        # Compatibilidad con cierres donde la cajera digitó manualmente count.monto_tarjeta
        legacy_tarjeta = float(count.monto_tarjeta or 0)
        if legacy_tarjeta > 0 and (m_bancard + m_dinelco) == 0:
            m_bancard = legacy_tarjeta

        # Efectivo contado en gaveta
        m_ef_pyg = float(count.monto_efectivo or 0)
        m_ef_brl = float(count.monto_efectivo_brl or 0)
        m_ef_usd = float(count.monto_efectivo_usd or 0)

        # Monto total declarado de la sesión: Efectivo físico contado en gaveta (PYG + divisas) + Medios electrónicos certificados por el POS
        monto_electronico = m_bancard + m_dinelco + m_qr + m_pix + m_transf + m_extra_club + m_cheque + m_otro
        efectivo_total_contado = float(count.monto_total or 0)
        monto_declarado_total = efectivo_total_contado + monto_electronico

        diferencia_gs = float(count.diferencia) if count.diferencia is not None else 0.0
        monto_cierre_esperado = monto_declarado_total - diferencia_gs

        out.append({
            "session_id": str(session_obj.id),
            "cajero_nombre": session_obj.cajero_nombre or "—",
            "register_nombre": register_nombre or "Caja",
            "fecha_apertura": session_obj.fecha_apertura,
            "fecha_cierre": session_obj.fecha_cierre,
            "monto_apertura": float(session_obj.monto_apertura or 0),
            "monto_cierre_esperado": monto_cierre_esperado,
            "monto_cierre": monto_declarado_total,
            "monto_efectivo": m_ef_pyg,
            "monto_efectivo_usd": m_ef_usd,
            "monto_efectivo_brl": m_ef_brl,
            "monto_bancard": m_bancard,
            "monto_dinelco": m_dinelco,
            "monto_qr": m_qr,
            "monto_pix": m_pix,
            "monto_transferencia": m_transf,
            "monto_extra_club": m_extra_club,
            "monto_cheque": m_cheque,
            "monto_otro": m_otro,
            # Campos retrocompatibles
            "monto_tarjeta": m_bancard + m_dinelco,
            "monto_total": monto_declarado_total,
            "diferencia": diferencia_gs,
            "diferencia_usd": float(count.diferencia_usd or 0),
            "diferencia_brl": float(count.diferencia_brl or 0),
            "requiere_revision": bool(count.requiere_revision or diferencia_gs != 0),
            "observaciones": count.observaciones or session_obj.observaciones or "",
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
    recon = await get_session_reconciliation_data(db, session_id)
    if not recon:
        return None

    # Drops detallados para UI
    cd_res = await db.execute(
        select(CashDropRequest).where(CashDropRequest.session_id == uuid.UUID(session_id)).order_by(CashDropRequest.created_at.asc())
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

    # Medios no efectivo
    medios_no_efectivo = [
        {
            "forma_pago": m["label"],
            "moneda": "PYG",
            "cantidad": 0,
            "monto": m["monto_gs"],
            "total": m["monto_gs"],
        }
        for m in recon["medios_pago_detallados"]
        if "EFECTIVO" not in m.get("clave", "")
    ]

    return {
        "session_id": recon["session_id"],
        "cajero_nombre": recon["cajero_nombre"],
        "register_nombre": recon["register_nombre"],
        "fecha_apertura": recon["fecha_apertura_str"],
        "fecha_cierre": recon["fecha_cierre_str"],
        "monto_apertura": recon["fondo_pyg"],
        "monto_apertura_pyg": recon["fondo_pyg"],
        "monto_apertura_usd": recon["fondo_usd"],
        "monto_apertura_brl": recon["fondo_brl"],
        "fondo_total_gs": recon["fondo_total_gs"],
        "tasa_brl": recon["tasa_brl"],
        "tasa_usd": recon["tasa_usd"],
        "ventas_count": recon["total_ventas_count"],
        "total_ventas_count": recon["total_ventas_count"],
        "total_cobrado_pyg": recon["total_cobrado_gs"],
        "total_donaciones_pyg": 0.0,
        "efectivo_pyg_esperado": recon["efectivo_pyg"],
        "efectivo_usd_esperado": recon["efectivo_usd"],
        "efectivo_brl_esperado": recon["efectivo_brl"],
        "ventas_ef_total_gs": recon["ventas_ef_total_gs"],
        "monto_cierre_esperado_pyg": recon["esperado_total_gs"],
        "monto_cierre_esperado_usd": recon["fondo_usd"],
        "monto_cierre_esperado_brl": recon["fondo_brl"],
        "efectivo_en_gaveta_esperado_pyg": recon["esperado_total_gs"],
        "efectivo_en_gaveta_esperado_usd": recon["fondo_usd"],
        "efectivo_en_gaveta_esperado_brl": recon["fondo_brl"],
        "desglose_formas_pago": recon["medios_pago_detallados"],
        "medios_no_efectivo": medios_no_efectivo,
        "cash_drops": drops_list,
        "total_cash_drops_pyg": recon["total_drops_gs"],
        "total_drops_confirmados_pyg": recon["total_drops_gs"],
        "total_drops_confirmados_usd": 0.0,
        "total_drops_confirmados_brl": 0.0,
        "reconciliation": recon,
        "ticket_text": recon["ticket_text"],
        "ticket_escpos_b64": recon["ticket_escpos_b64"],
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
    recon = await get_session_reconciliation_data(db, s.id)

    monto_apertura_pyg = float(recon["fondo_pyg"]) if recon else float(s.monto_apertura or 0)
    monto_apertura_usd = float(recon["fondo_usd"]) if recon else float(s.monto_apertura_usd or 0)
    monto_apertura_brl = float(recon["fondo_brl"]) if recon else float(s.monto_apertura_brl or 0)

    monto_cierre_esperado = float(recon["esperado_total_gs"]) if recon else monto_apertura_pyg
    monto_cierre_esperado_usd = monto_apertura_usd
    monto_cierre_esperado_brl = monto_apertura_brl

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
        "efectivo_cobrado_pyg": float(recon["ventas_ef_total_gs"]) if recon else 0.0,
        "efectivo_usd_esperado": 0.0,
        "efectivo_brl_esperado": 0.0,
        "monto_efectivo_usd": float(count.monto_efectivo_usd or 0) if count else 0,
        "monto_efectivo_brl": float(count.monto_efectivo_brl or 0) if count else 0,
        "diferencia": float(recon["diferencia_consolidada_gs"]) if recon else (float(count.diferencia or 0) if count else 0),
        "diferencia_usd": float(count.diferencia_usd or 0) if count else 0,
        "diferencia_brl": float(count.diferencia_brl or 0) if count else 0,
        "requiere_revision": count.requiere_revision if count else False,
        "observaciones": s.observaciones,
        "estado": s.estado,
        "recon": recon,
    }

    return {
        "session_data": session_data,
        "payments_breakdown": breakdown,
        "cash_drops": drops_list,
    }


async def get_session_punteo_data(db: AsyncSession, session_id: str, company_id: str) -> dict | None:
    """Obtiene los datos completos de arqueo y la lista voucher por voucher para punteo físico."""
    cierre = await get_cierre_individual_report_data(db, session_id, company_id)
    if not cierre:
        return None

    session_data = cierre["session_data"]
    breakdown = cierre["payments_breakdown"]
    medios_dict = breakdown.get("medios_individuales", {})

    cid = uuid.UUID(company_id)
    sid = uuid.UUID(session_id)
    recon = session_data.get("recon") or {}
    tasa_brl = Decimal(str(recon.get("tasa_brl") or breakdown.get("tasa_brl") or 1130))
    tasa_usd = Decimal(str(recon.get("tasa_usd") or breakdown.get("tasa_usd") or 5840))

    # 1. Obtener la sesión para conocer el rango de fechas
    res_sess = await db.execute(select(CashSession).where(CashSession.id == sid))
    session_obj = res_sess.scalar_one_or_none()

    # 2. Obtener todas las transacciones de pago vinculadas con ventas de la sesión
    vouchers_res = await db.execute(
        select(
            SalePayment.id,
            SalePayment.forma_pago,
            SalePayment.moneda,
            SalePayment.monto,
            SalePayment.fecha,
            Sale.id.label("sale_id"),
            Sale.numero.label("numero_venta"),
            Sale.numero_interno,
            Sale.total.label("sale_total"),
            Sale.tipo_comprobante,
            Sale.observaciones.label("sale_obs"),
            PosTerminalTransaction.id.label("pos_txn_id"),
            PosTerminalTransaction.codigo_autorizacion,
            PosTerminalTransaction.nsu,
            PosTerminalTransaction.nombre_tarjeta,
            PosTerminalTransaction.pan,
            PosTerminalTransaction.nombre_cliente,
            PosTerminalTransaction.raw_response,
        )
        .select_from(SalePayment)
        .join(Sale, Sale.id == SalePayment.sale_id)
        .outerjoin(PosTerminalTransaction, PosTerminalTransaction.sale_id == Sale.id)
        .where(
            Sale.session_id == sid,
            Sale.estado.in_(["confirmado", "completada", "completado", "pagado"]),
        )
        .order_by(SalePayment.fecha.asc())
    )
    rows = vouchers_res.all()

    # Agrupar pagos por venta para calcular con exactitud la porción del ticket en Guaraníes
    sale_payments_map: dict[uuid.UUID, list] = {}
    for r in rows:
        if r.sale_id not in sale_payments_map:
            sale_payments_map[r.sale_id] = []
        sale_payments_map[r.sale_id].append(r)

    # 3. Transacciones POS huérfanas de la sesión (ej. Dinelco o caídas temporales de red antes de vincular sale_id)
    unlinked_pos_txns: list[PosTerminalTransaction] = []
    if session_obj and session_obj.fecha_apertura:
        dt_start = session_obj.fecha_apertura - timedelta(minutes=60)
        dt_end = (session_obj.fecha_cierre or datetime.now(timezone.utc)) + timedelta(minutes=60)
        res_unlinked = await db.execute(
            select(PosTerminalTransaction).where(
                PosTerminalTransaction.company_id == cid,
                PosTerminalTransaction.sale_id == None,
                PosTerminalTransaction.created_at >= dt_start,
                PosTerminalTransaction.created_at <= dt_end,
                PosTerminalTransaction.exitosa == True,
            ).order_by(PosTerminalTransaction.created_at.asc())
        )
        unlinked_pos_txns = list(res_unlinked.scalars().all())

    # 4. Transacciones Bancard QR confirmadas de la ventana de la sesión
    qr_txns = []
    try:
        from api.src.bancard_qr.models import BancardQrTransaction
        if session_obj and session_obj.fecha_apertura:
            dt_start = session_obj.fecha_apertura - timedelta(minutes=60)
            dt_end = (session_obj.fecha_cierre or datetime.now(timezone.utc)) + timedelta(minutes=60)
            res_qr = await db.execute(
                select(BancardQrTransaction).where(
                    BancardQrTransaction.company_id == cid,
                    BancardQrTransaction.status == "confirmed",
                    BancardQrTransaction.created_at >= dt_start,
                    BancardQrTransaction.created_at <= dt_end,
                ).order_by(BancardQrTransaction.created_at.asc())
            )
            qr_txns = list(res_qr.scalars().all())
    except Exception:
        qr_txns = []

    vouchers = []
    vouchers_by_channel: dict[str, dict] = {
        "TARJETA_BANCARD": {"canal_key": "TARJETA_BANCARD", "canal_label": "Tarjetas Bancard POS", "icon": "credit-card", "total_esperado_gs": 0.0, "cantidad_esperada": 0, "vouchers": []},
        "TARJETA_DINELCO": {"canal_key": "TARJETA_DINELCO", "canal_label": "Tarjetas Dinelco POS", "icon": "credit-card", "total_esperado_gs": 0.0, "cantidad_esperada": 0, "vouchers": []},
        "BANCARD_QR": {"canal_key": "BANCARD_QR", "canal_label": "Bancard QR", "icon": "qr-code", "total_esperado_gs": 0.0, "cantidad_esperada": 0, "vouchers": []},
        "DINELCO_QR": {"canal_key": "DINELCO_QR", "canal_label": "Dinelco QR", "icon": "qr-code", "total_esperado_gs": 0.0, "cantidad_esperada": 0, "vouchers": []},
        "PIX": {"canal_key": "PIX", "canal_label": "PIX Brasil", "icon": "smartphone", "total_esperado_gs": 0.0, "cantidad_esperada": 0, "vouchers": []},
        "TRANSFERENCIA": {"canal_key": "TRANSFERENCIA", "canal_label": "Transferencias SIPAP", "icon": "landmark", "total_esperado_gs": 0.0, "cantidad_esperada": 0, "vouchers": []},
        "EXTRA_CLUB": {"canal_key": "EXTRA_CLUB", "canal_label": "Crédito Extra Club", "icon": "award", "total_esperado_gs": 0.0, "cantidad_esperada": 0, "vouchers": []},
        "VALES": {"canal_key": "VALES", "canal_label": "Vales & Cheques", "icon": "file-check", "total_esperado_gs": 0.0, "cantidad_esperada": 0, "vouchers": []},
        "OTROS": {"canal_key": "OTROS", "canal_label": "Otros Comprobantes", "icon": "file-text", "total_esperado_gs": 0.0, "cantidad_esperada": 0, "vouchers": []},
    }

    used_pos_ids = set()
    used_qr_ids = set()
    auto_linked_count = 0

    for row in rows:
        fp_raw = (row.forma_pago or "").upper().strip()
        # El efectivo físico se rinde contando billetes en gaveta (Arqueo ciego).
        # El punteo de comprobantes es EXCLUSIVAMENTE para medios no-efectivo (tarjetas, QR, PIX, vales, transferencias).
        if fp_raw in ("EFECTIVO", "CASH") or "EFECTIVO" in fp_raw:
            continue

        mon = (row.moneda or "PYG").upper()
        m_dec = Decimal(str(row.monto or 0))

        if "DINELCO" in fp_raw and "QR" in fp_raw:
            medio_label = "Dinelco QR"
            canal_key = "DINELCO_QR"
        elif "QR" in fp_raw:
            medio_label = "Bancard QR"
            canal_key = "BANCARD_QR"
        elif "DINELCO" in fp_raw:
            medio_label = "Tarjeta Dinelco"
            canal_key = "TARJETA_DINELCO"
        elif "BANCARD" in fp_raw or "TARJETA" in fp_raw or "DEBITO" in fp_raw or "CREDITO" in fp_raw:
            medio_label = "Tarjeta Bancard"
            canal_key = "TARJETA_BANCARD"
        elif "PIX" in fp_raw:
            medio_label = "PIX Brasil"
            canal_key = "PIX"
        elif "EXTRA_CLUB" in fp_raw:
            medio_label = "Extra Club (Crédito)"
            canal_key = "EXTRA_CLUB"
        elif "VALE" in fp_raw or "CHEQUE" in fp_raw:
            medio_label = "Vale / Cheque"
            canal_key = "VALES"
        elif "TRANSFERENCIA" in fp_raw:
            medio_label = "Transferencia Bancaria"
            canal_key = "TRANSFERENCIA"
        else:
            medio_label = row.forma_pago
            canal_key = "OTROS"

        if mon == "PYG":
            m_gs = m_dec
        else:
            sale_total_gs = Decimal(str(row.sale_total or 0))
            sibling_pays = sale_payments_map.get(row.sale_id, [])
            sibling_pyg = sum(Decimal(str(sp.monto or 0)) for sp in sibling_pays if (sp.moneda or "PYG").upper() == "PYG")
            sibling_divisas = [sp for sp in sibling_pays if (sp.moneda or "PYG").upper() != "PYG"]
            if sale_total_gs > 0 and len(sibling_divisas) == 1:
                m_gs = max(Decimal("0"), sale_total_gs - sibling_pyg)
            else:
                m_gs = m_dec * tasa_brl if mon == "BRL" else (m_dec * tasa_usd if mon == "USD" else m_dec)
        m_gs_float = float(m_gs)

        nro_boleta = None
        codigo_autorizacion = row.codigo_autorizacion
        nsu = row.nsu
        tarjeta_marca = row.nombre_tarjeta
        tarjeta_pan = row.pan
        titular = row.nombre_cliente

        # A. Si vino un PosTerminalTransaction directamente enlazado por sale_id:
        if row.raw_response and isinstance(row.raw_response, dict):
            raw = row.raw_response
            nro_boleta = raw.get("nroBoleta") or raw.get("nro_boleta") or raw.get("boleta") or raw.get("ticket_numero")
            if not tarjeta_pan:
                tarjeta_pan = raw.get("ultimos4") or raw.get("pan")
            if not codigo_autorizacion:
                codigo_autorizacion = raw.get("codigoAutorizacion") or raw.get("cod_autorizacion")
            if not nsu:
                nsu = raw.get("nsu") or raw.get("nro_secuencia")

        # B. Si no hay autorización y es tarjeta (Bancard o Dinelco), buscar en unlinked_pos_txns:
        if (not codigo_autorizacion or codigo_autorizacion == "—") and ("TARJETA" in canal_key or "DINELCO" in canal_key or "BANCARD" in canal_key):
            best_match = None
            best_diff = None
            row_fecha = row.fecha
            if row_fecha and row_fecha.tzinfo is None:
                row_fecha = row_fecha.replace(tzinfo=timezone.utc)

            for txn in unlinked_pos_txns:
                if txn.id in used_pos_ids:
                    continue
                txn_monto = Decimal(str(txn.monto or 0))
                if abs(txn_monto - m_dec) < Decimal("1.00"):
                    txn_fecha = txn.created_at
                    if txn_fecha and txn_fecha.tzinfo is None:
                        txn_fecha = txn_fecha.replace(tzinfo=timezone.utc)
                    diff = abs((txn_fecha - row_fecha).total_seconds()) if row_fecha and txn_fecha else 0
                    if best_diff is None or diff < best_diff:
                        best_diff = diff
                        best_match = txn

            if best_match:
                used_pos_ids.add(best_match.id)
                codigo_autorizacion = best_match.codigo_autorizacion
                nsu = best_match.nsu
                tarjeta_marca = best_match.nombre_tarjeta or tarjeta_marca
                tarjeta_pan = best_match.pan or tarjeta_pan
                titular = best_match.nombre_cliente or titular
                if best_match.raw_response and isinstance(best_match.raw_response, dict):
                    raw = best_match.raw_response
                    nro_boleta = raw.get("nroBoleta") or raw.get("nro_boleta") or raw.get("boleta") or raw.get("ticket_numero")
                    if not tarjeta_pan:
                        tarjeta_pan = raw.get("ultimos4") or raw.get("pan")
                # Auto-reparación permanente del sale_id en base de datos:
                try:
                    best_match.sale_id = row.sale_id
                    db.add(best_match)
                    auto_linked_count += 1
                except Exception:
                    pass

        # C. Si es Bancard QR, buscar en qr_txns por monto y fecha cercana:
        if canal_key == "BANCARD_QR" and (not codigo_autorizacion or codigo_autorizacion == "—"):
            best_qr = None
            best_qr_diff = None
            row_fecha = row.fecha
            if row_fecha and row_fecha.tzinfo is None:
                row_fecha = row_fecha.replace(tzinfo=timezone.utc)

            for q in qr_txns:
                if q.id in used_qr_ids:
                    continue
                q_monto = Decimal(str(q.amount or 0))
                if abs(q_monto - m_dec) < Decimal("1.00"):
                    q_fecha = q.created_at
                    if q_fecha and q_fecha.tzinfo is None:
                        q_fecha = q_fecha.replace(tzinfo=timezone.utc)
                    diff = abs((q_fecha - row_fecha).total_seconds()) if row_fecha and q_fecha else 0
                    if best_qr_diff is None or diff < best_qr_diff:
                        best_qr_diff = diff
                        best_qr = q

            if best_qr:
                used_qr_ids.add(best_qr.id)
                codigo_autorizacion = best_qr.authorization_code
                nro_boleta = best_qr.ticket_number
                nsu = (best_qr.hook_alias or "")[-6:] if best_qr.hook_alias else None
                tarjeta_pan = best_qr.card_last_numbers
                tarjeta_marca = f"Bancard QR ({best_qr.account_type or 'APP'})"
                payer = f"{best_qr.payer_name or ''} {best_qr.payer_lastname or ''}".strip()
                if payer:
                    titular = payer

        # D. Fallback de cupón manual o comprobante escrito en observaciones:
        if not nro_boleta and row.sale_obs:
            m_cup = re.search(r'(?:cupon|cupón|voucher|boleta|comp|nro)[:\s#]*([a-zA-Z0-9\-_]+)', row.sale_obs, re.IGNORECASE)
            if m_cup:
                nro_boleta = m_cup.group(1)

        voucher_item = {
            "id": str(row.id),
            "sale_id": str(row.sale_id),
            "fecha": row.fecha.isoformat() if row.fecha else None,
            "numero_ticket": row.numero_interno or row.numero_venta or "—",
            "tipo_comprobante": row.tipo_comprobante,
            "medio_pago": medio_label,
            "canal_key": canal_key,
            "moneda": mon,
            "monto_original": float(m_dec),
            "monto_gs": m_gs_float,
            "nro_boleta": nro_boleta or "—",
            "codigo_autorizacion": codigo_autorizacion or "—",
            "nsu": nsu or "—",
            "tarjeta_marca": tarjeta_marca or ("Dinelco" if "DINELCO" in canal_key else ("Bancard" if "BANCARD" in canal_key else "—")),
            "tarjeta_pan": f"•••• {tarjeta_pan}" if tarjeta_pan else "—",
            "titular": titular or "—",
        }

        vouchers.append(voucher_item)
        if canal_key in vouchers_by_channel:
            vouchers_by_channel[canal_key]["total_esperado_gs"] += m_gs_float
            vouchers_by_channel[canal_key]["cantidad_esperada"] += 1
            vouchers_by_channel[canal_key]["vouchers"].append(voucher_item)

    if auto_linked_count > 0:
        try:
            await db.commit()
        except Exception:
            pass

    summary_por_canal = {
        k: {
            "canal_key": v["canal_key"],
            "label": v["canal_label"],
            "cantidad": v["cantidad_esperada"],
            "monto_gs": v["total_esperado_gs"],
            "icon": v["icon"],
        }
        for k, v in vouchers_by_channel.items()
        if v["cantidad_esperada"] > 0
    }
    summary_final = medios_dict if any(v.get("cantidad", 0) > 0 for v in medios_dict.values()) else summary_por_canal
    if not summary_final:
        summary_final = summary_por_canal

    # Filtrar solo canales que tengan transacciones
    canales_activos = [c for c in vouchers_by_channel.values() if c["cantidad_esperada"] > 0]

    return {
        "session_data": session_data,
        "summary_by_method": summary_final,
        "payments_breakdown": breakdown,
        "vouchers": vouchers,
        "grupos_comprobantes": canales_activos,
        "total_vouchers": len(vouchers),
    }


async def save_session_punteo_audit(
    db: AsyncSession,
    session_id: str,
    company_id: str,
    auditor_nombre: str,
    items: list[dict],
    observaciones_dictamen: str | None,
    diferencia_vouchers_gs: Decimal,
) -> dict:
    """Asienta formalmente el dictamen de auditoría y cotejo físico de comprobantes."""
    cid = uuid.UUID(company_id)
    sid = uuid.UUID(session_id)

    res = await db.execute(
        select(CashSession)
        .join(CashRegister, CashRegister.id == CashSession.register_id)
        .where(CashSession.id == sid, CashRegister.company_id == cid)
    )
    session_obj = res.scalar_one_or_none()
    if not session_obj:
        raise ValueError("Sesión de caja no encontrada")

    now_py = datetime.now(TZ_ASUNCION).strftime("%d/%m/%Y %H:%M")
    conformes = [it for it in items if it.get("estado") == "conforme"]
    faltantes = [it for it in items if it.get("estado") == "faltante"]
    discrepantes = [it for it in items if it.get("estado") == "discrepante"]

    estado_dictamen = "CONFORME" if len(faltantes) == 0 and len(discrepantes) == 0 and abs(diferencia_vouchers_gs) == 0 else "OBSERVADO"
    nota_audit = (
        f"\n[COTEJO FÍSICO DE COMPROBANTES ({now_py}) por {auditor_nombre}]: "
        f"Dictamen: {estado_dictamen} | Conformes: {len(conformes)}, Faltantes: {len(faltantes)}, Con Discrepancia: {len(discrepantes)}. "
        f"Diferencia Comprobantes: ₲ {float(diferencia_vouchers_gs):,.0f}."
    )
    if observaciones_dictamen:
        nota_audit += f" Detalle: {observaciones_dictamen.strip()}"

    session_obj.observaciones = (session_obj.observaciones or "") + nota_audit

    await db.commit()
    await db.refresh(session_obj)

    return {
        "status": "ok",
        "session_id": str(sid),
        "estado_dictamen": estado_dictamen,
        "conformes": len(conformes),
        "faltantes": len(faltantes),
        "discrepantes": len(discrepantes),
        "diferencia_vouchers_gs": float(diferencia_vouchers_gs),
        "observaciones_actualizadas": session_obj.observaciones,
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


# ── Reportes Especializados de Ventas por Cajero y Medios de Pago ─────

def _parse_range_asuncion(fecha_desde: date | datetime | str, fecha_hasta: date | datetime | str) -> tuple[datetime, datetime]:
    py_tz = ZoneInfo("America/Asuncion")
    if isinstance(fecha_desde, str):
        fecha_desde = date.fromisoformat(fecha_desde.strip())
    if isinstance(fecha_hasta, str):
        fecha_hasta = date.fromisoformat(fecha_hasta.strip())

    if isinstance(fecha_desde, date) and not isinstance(fecha_desde, datetime):
        dt_desde = datetime.combine(fecha_desde, time.min, tzinfo=py_tz)
    elif isinstance(fecha_desde, datetime) and fecha_desde.tzinfo is None:
        dt_desde = fecha_desde.replace(tzinfo=py_tz)
    else:
        dt_desde = fecha_desde

    if isinstance(fecha_hasta, date) and not isinstance(fecha_hasta, datetime):
        dt_hasta = datetime.combine(fecha_hasta, time.max, tzinfo=py_tz)
    elif isinstance(fecha_hasta, datetime) and fecha_hasta.tzinfo is None:
        dt_hasta = fecha_hasta.replace(tzinfo=py_tz)
    else:
        dt_hasta = fecha_hasta

    return dt_desde, dt_hasta


async def get_sales_by_cashier_report(
    db: AsyncSession,
    company_id: str,
    fecha_desde: date | datetime | str,
    fecha_hasta: date | datetime | str,
    cajero_nombre: str | None = None,
) -> dict:
    """Reporte de ventas brutas agrupadas por cajero/usuario para arqueo y control de recaudación."""
    dt_desde, dt_hasta = _parse_range_asuncion(fecha_desde, fecha_hasta)
    comp_uuid = uuid.UUID(company_id)

    cajero_expr = func.coalesce(CashSession.cajero_nombre, User.nombre, 'Sin Cajero Asignado')

    query = (
        select(
            cajero_expr.label("cajero_nombre"),
            func.count(Sale.id).label("cantidad_tickets"),
            func.coalesce(func.sum(Sale.total), 0).label("total_ventas"),
            func.coalesce(func.sum(Sale.descuento_total), 0).label("total_descuentos"),
            func.min(Sale.fecha).label("primera_venta"),
            func.max(Sale.fecha).label("ultima_venta"),
            func.count(func.distinct(Sale.session_id)).label("cantidad_turnos"),
        )
        .select_from(Sale)
        .outerjoin(CashSession, CashSession.id == Sale.session_id)
        .outerjoin(User, User.id == Sale.user_id)
        .where(
            Sale.company_id == comp_uuid,
            Sale.fecha >= dt_desde,
            Sale.fecha <= dt_hasta,
            Sale.estado.in_(["confirmado", "completada", "completado", "pagado"]),
        )
    )

    if cajero_nombre and cajero_nombre.strip():
        query = query.where(cajero_expr.ilike(f"%{cajero_nombre.strip()}%"))

    query = query.group_by(cajero_expr)
    query = query.order_by(func.coalesce(func.sum(Sale.total), 0).desc())

    result = await db.execute(query)
    rows = result.all()

    cajeros = []
    gran_total_ventas = Decimal("0")
    gran_total_tickets = 0
    gran_total_descuentos = Decimal("0")

    for r in rows:
        tot = Decimal(str(r.total_ventas or 0))
        tix = int(r.cantidad_tickets or 0)
        desc = Decimal(str(r.total_descuentos or 0))
        prom = tot / tix if tix > 0 else Decimal("0")

        gran_total_ventas += tot
        gran_total_tickets += tix
        gran_total_descuentos += desc

        cajeros.append({
            "cajero_nombre": r.cajero_nombre,
            "cantidad_tickets": tix,
            "total_ventas": float(tot),
            "total_descuentos": float(desc),
            "ticket_promedio": float(prom),
            "cantidad_turnos": int(r.cantidad_turnos or 0),
            "primera_venta": _to_asuncion_tz(r.primera_venta).isoformat() if r.primera_venta else None,
            "ultima_venta": _to_asuncion_tz(r.ultima_venta).isoformat() if r.ultima_venta else None,
        })

    ticket_promedio_general = float(gran_total_ventas / gran_total_tickets) if gran_total_tickets > 0 else 0.0

    return {
        "fecha_desde": dt_desde.strftime("%Y-%m-%d"),
        "fecha_hasta": dt_hasta.strftime("%Y-%m-%d"),
        "cajero_filtro": cajero_nombre,
        "totales": {
            "total_ventas": float(gran_total_ventas),
            "total_tickets": gran_total_tickets,
            "total_descuentos": float(gran_total_descuentos),
            "ticket_promedio_general": ticket_promedio_general,
            "total_cajeros_activos": len(cajeros),
        },
        "cajeros": cajeros,
    }


async def get_sales_by_payment_method_report(
    db: AsyncSession,
    company_id: str,
    fecha_desde: date | datetime | str,
    fecha_hasta: date | datetime | str,
) -> dict:
    """Reporte de recaudación agrupado por medios de pago para arqueo de caja y tesorería."""
    dt_desde, dt_hasta = _parse_range_asuncion(fecha_desde, fecha_hasta)
    comp_uuid = uuid.UUID(company_id)

    query = (
        select(
            SalePayment.forma_pago,
            SalePayment.moneda,
            func.count(SalePayment.id).label("cantidad_operaciones"),
            func.coalesce(func.sum(SalePayment.monto), 0).label("monto_total"),
        )
        .select_from(SalePayment)
        .join(Sale, Sale.id == SalePayment.sale_id)
        .where(
            Sale.company_id == comp_uuid,
            Sale.fecha >= dt_desde,
            Sale.fecha <= dt_hasta,
            Sale.estado.in_(["confirmado", "completada", "completado", "pagado"]),
        )
        .group_by(SalePayment.forma_pago, SalePayment.moneda)
        .order_by(func.coalesce(func.sum(SalePayment.monto), 0).desc())
    )

    result = await db.execute(query)
    rows = result.all()

    methods_dict = {
        "efectivo_pyg": {"label": "Efectivo Guaraníes (₲)", "moneda": "PYG", "monto": Decimal("0"), "operaciones": 0},
        "efectivo_brl": {"label": "Efectivo Reales (R$)", "moneda": "BRL", "monto": Decimal("0"), "operaciones": 0},
        "efectivo_usd": {"label": "Efectivo Dólares (US$)", "moneda": "USD", "monto": Decimal("0"), "operaciones": 0},
        "bancard": {"label": "Tarjetas Bancard (Débito/Crédito)", "moneda": "PYG", "monto": Decimal("0"), "operaciones": 0},
        "dinelco": {"label": "Tarjetas Dinelco", "moneda": "PYG", "monto": Decimal("0"), "operaciones": 0},
        "qr": {"label": "Pagos con Código QR", "moneda": "PYG", "monto": Decimal("0"), "operaciones": 0},
        "pix": {"label": "Transferencia PIX Brasil", "moneda": "PYG", "monto": Decimal("0"), "operaciones": 0},
        "transferencia": {"label": "Transferencia Bancaria / SIPAP", "moneda": "PYG", "monto": Decimal("0"), "operaciones": 0},
        "extra_club": {"label": "Crédito Extra Club / Vales Convenios", "moneda": "PYG", "monto": Decimal("0"), "operaciones": 0},
        "cheque": {"label": "Cheques Recibidos", "moneda": "PYG", "monto": Decimal("0"), "operaciones": 0},
        "otros": {"label": "Otros Medios de Pago", "moneda": "PYG", "monto": Decimal("0"), "operaciones": 0},
    }

    total_recaudado_pyg = Decimal("0")
    total_operaciones = 0

    for r in rows:
        fp = (r.forma_pago or "").upper()
        mon = (r.moneda or "PYG").upper()
        m = Decimal(str(r.monto_total or 0))
        ops = int(r.cantidad_operaciones or 0)
        total_operaciones += ops

        if "EFECTIVO" in fp:
            if mon == "BRL":
                methods_dict["efectivo_brl"]["monto"] += m
                methods_dict["efectivo_brl"]["operaciones"] += ops
            elif mon == "USD":
                methods_dict["efectivo_usd"]["monto"] += m
                methods_dict["efectivo_usd"]["operaciones"] += ops
            else:
                methods_dict["efectivo_pyg"]["monto"] += m
                methods_dict["efectivo_pyg"]["operaciones"] += ops
                total_recaudado_pyg += m
        elif "DINELCO" in fp and "QR" not in fp:
            methods_dict["dinelco"]["monto"] += m
            methods_dict["dinelco"]["operaciones"] += ops
            total_recaudado_pyg += m
        elif any(t in fp for t in ["BANCARD", "TARJETA", "DEBITO", "CREDITO"]) and "QR" not in fp:
            methods_dict["bancard"]["monto"] += m
            methods_dict["bancard"]["operaciones"] += ops
            total_recaudado_pyg += m
        elif "PIX" in fp:
            methods_dict["pix"]["monto"] += m
            methods_dict["pix"]["operaciones"] += ops
            total_recaudado_pyg += m
        elif "QR" in fp:
            methods_dict["qr"]["monto"] += m
            methods_dict["qr"]["operaciones"] += ops
            total_recaudado_pyg += m
        elif any(t in fp for t in ["TRANSFERENCIA", "TRANSF", "SIPAP"]):
            methods_dict["transferencia"]["monto"] += m
            methods_dict["transferencia"]["operaciones"] += ops
            total_recaudado_pyg += m
        elif any(t in fp for t in ["EXTRA_CLUB", "CLUB", "CREDITO", "VALE", "CONVENIO"]):
            methods_dict["extra_club"]["monto"] += m
            methods_dict["extra_club"]["operaciones"] += ops
            total_recaudado_pyg += m
        elif "CHEQUE" in fp:
            methods_dict["cheque"]["monto"] += m
            methods_dict["cheque"]["operaciones"] += ops
            total_recaudado_pyg += m
        else:
            methods_dict["otros"]["monto"] += m
            methods_dict["otros"]["operaciones"] += ops
            total_recaudado_pyg += m

    breakdown = []
    for k, v in methods_dict.items():
        m_val = float(v["monto"])
        pct = float((v["monto"] / total_recaudado_pyg) * 100) if (total_recaudado_pyg > 0 and v["moneda"] == "PYG") else 0.0
        breakdown.append({
            "key": k,
            "label": v["label"],
            "moneda": v["moneda"],
            "monto": m_val,
            "operaciones": v["operaciones"],
            "porcentaje": round(pct, 2),
        })

    return {
        "fecha_desde": dt_desde.strftime("%Y-%m-%d"),
        "fecha_hasta": dt_hasta.strftime("%Y-%m-%d"),
        "total_recaudado_pyg": float(total_recaudado_pyg),
        "total_operaciones": total_operaciones,
        "efectivo_brl_recaudado": float(methods_dict["efectivo_brl"]["monto"]),
        "efectivo_usd_recaudado": float(methods_dict["efectivo_usd"]["monto"]),
        "medios_pago": breakdown,
    }


# ── Mapeo de Medios Electrónicos a Cuentas Bancarias Corrientes ────────

DEFAULT_CANALES = [
    ("TARJETA_BANCARD", "Tarjetas Bancard POS"),
    ("TARJETA_DINELCO", "Tarjetas Dinelco POS"),
    ("BANCARD_QR", "Cobros QR Bancard"),
    ("DINELCO_QR", "Cobros QR Dinelco"),
    ("PIX", "PIX Brasil (Plug Pay)"),
    ("TRANSFERENCIA", "Transferencias SIPAP"),
]


async def list_payment_method_bank_mappings(db: AsyncSession, company_id: str) -> list[dict]:
    """Lista todos los mapeos de medios de pago a cuentas bancarias corrientes.
    Si no existen aún para la empresa, los inicializa con los canales predeterminados."""
    cid = uuid.UUID(company_id)

    query = (
        select(PaymentMethodBankMapping, BankAccount)
        .outerjoin(BankAccount, BankAccount.id == PaymentMethodBankMapping.bank_account_id)
        .where(PaymentMethodBankMapping.company_id == cid)
        .order_by(PaymentMethodBankMapping.canal_key.asc())
    )
    result = await db.execute(query)
    rows = result.all()

    if not rows:
        for k, lbl in DEFAULT_CANALES:
            db.add(PaymentMethodBankMapping(company_id=cid, canal_key=k, canal_label=lbl, activo=True))
        await db.commit()

        result = await db.execute(query)
        rows = result.all()

    out = []
    for mapping, bank in rows:
        out.append({
            "id": str(mapping.id),
            "canal_key": mapping.canal_key,
            "canal_label": mapping.canal_label,
            "bank_account_id": str(mapping.bank_account_id) if mapping.bank_account_id else None,
            "banco_nombre": bank.banco if bank else None,
            "numero_cuenta": bank.numero_cuenta if bank else None,
            "moneda": bank.moneda if bank else None,
            "activo": mapping.activo,
        })
    return out


async def update_payment_method_bank_mapping(
    db: AsyncSession,
    company_id: str,
    canal_key: str,
    bank_account_id: str | None,
    activo: bool = True,
) -> dict:
    """Actualiza o asocia la cuenta bancaria de destino para un medio de pago electrónico."""
    cid = uuid.UUID(company_id)
    bid = uuid.UUID(bank_account_id) if bank_account_id else None

    res = await db.execute(
        select(PaymentMethodBankMapping).where(
            PaymentMethodBankMapping.company_id == cid,
            PaymentMethodBankMapping.canal_key == canal_key,
        )
    )
    mapping = res.scalar_one_or_none()
    if not mapping:
        lbl = dict(DEFAULT_CANALES).get(canal_key, canal_key)
        mapping = PaymentMethodBankMapping(
            company_id=cid,
            canal_key=canal_key,
            canal_label=lbl,
            bank_account_id=bid,
            activo=activo,
        )
        db.add(mapping)
    else:
        mapping.bank_account_id = bid
        mapping.activo = activo
        mapping.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(mapping)

    banco_nombre, num_cuenta, moneda = None, None, None
    if bid:
        b_res = await db.execute(select(BankAccount).where(BankAccount.id == bid))
        b_obj = b_res.scalar_one_or_none()
        if b_obj:
            banco_nombre = b_obj.banco
            num_cuenta = b_obj.numero_cuenta
            moneda = b_obj.moneda

    return {
        "id": str(mapping.id),
        "canal_key": mapping.canal_key,
        "canal_label": mapping.canal_label,
        "bank_account_id": str(bid) if bid else None,
        "banco_nombre": banco_nombre,
        "numero_cuenta": num_cuenta,
        "moneda": moneda,
        "activo": mapping.activo,
    }


# ── Configuración y Tratamiento de Faltantes hacia SueldOK ────────────

async def get_cash_shortage_config(db: AsyncSession, company_id: str) -> dict:
    cid = uuid.UUID(company_id)
    res = await db.execute(select(CashShortageConfig).where(CashShortageConfig.company_id == cid))
    cfg = res.scalar_one_or_none()
    if not cfg:
        cfg = CashShortageConfig(
            company_id=cid,
            umbral_aprobacion_gs=Decimal("10000"),
            requerir_aprobacion_siempre=True,
            permitir_cuotas=True,
            max_cuotas=3,
        )
        db.add(cfg)
        await db.commit()
        await db.refresh(cfg)

    return {
        "umbral_aprobacion_gs": float(cfg.umbral_aprobacion_gs),
        "requerir_aprobacion_siempre": bool(cfg.requerir_aprobacion_siempre),
        "permitir_cuotas": bool(cfg.permitir_cuotas),
        "max_cuotas": int(cfg.max_cuotas),
    }


async def update_cash_shortage_config(db: AsyncSession, company_id: str, data: dict) -> dict:
    cid = uuid.UUID(company_id)
    res = await db.execute(select(CashShortageConfig).where(CashShortageConfig.company_id == cid))
    cfg = res.scalar_one_or_none()
    if not cfg:
        cfg = CashShortageConfig(company_id=cid)
        db.add(cfg)

    if data.get("umbral_aprobacion_gs") is not None:
        cfg.umbral_aprobacion_gs = Decimal(str(data["umbral_aprobacion_gs"]))
    if data.get("requerir_aprobacion_siempre") is not None:
        cfg.requerir_aprobacion_siempre = bool(data["requerir_aprobacion_siempre"])
    if data.get("permitir_cuotas") is not None:
        cfg.permitir_cuotas = bool(data["permitir_cuotas"])
    if data.get("max_cuotas") is not None:
        cfg.max_cuotas = int(data["max_cuotas"])

    cfg.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(cfg)
    return {
        "umbral_aprobacion_gs": float(cfg.umbral_aprobacion_gs),
        "requerir_aprobacion_siempre": bool(cfg.requerir_aprobacion_siempre),
        "permitir_cuotas": bool(cfg.permitir_cuotas),
        "max_cuotas": int(cfg.max_cuotas),
    }


# ── Incorporación Integral de Turno a Bóveda y Bancos ──────────────────

async def incorporate_session_to_vault_and_banks(
    db: AsyncSession,
    session_id: str,
    company_id: str,
    user_id: str,
    user_nombre: str,
    observaciones: str | None = None,
) -> dict:
    """Ejecuta el ciclo de vida contable completo tras el cierre/punteo de caja:
    1. Incorpora el efectivo físico contado (PYG, BRL, USD) y cheques a Bóveda Central (VaultEntry).
    2. Registra las acreditaciones esperadas de medios de pago electrónicos en las cuentas corrientes
       bancarias asignadas (BankTransaction en estado pendiente de conciliación).
    3. Si hay faltante de caja, genera la solicitud de deducción en nómina sujeta a aprobación para SueldOK.
    """
    cid = uuid.UUID(company_id)
    sid = uuid.UUID(session_id)

    res = await db.execute(
        select(CashSession, CashCount, CashRegister)
        .join(CashCount, CashCount.session_id == CashSession.id)
        .join(CashRegister, CashRegister.id == CashSession.register_id)
        .where(CashSession.id == sid, CashRegister.company_id == cid)
    )
    row = res.first()
    if not row:
        raise ValueError("Sesión de caja o arqueo no encontrado")

    session_obj, count_obj, reg = row

    # 1. BÓVEDA CENTRAL: Incorporar efectivo físico contado
    m_ef_pyg = Decimal(str(count_obj.monto_efectivo or 0))
    m_ef_brl = Decimal(str(count_obj.monto_efectivo_brl or 0))
    m_ef_usd = Decimal(str(count_obj.monto_efectivo_usd or 0))
    m_cheque = Decimal(str(count_obj.monto_cheque or 0))

    vault_entries_creados = []
    # Verificar si ya existe VaultEntry directo para esta sesión
    existing_ve = await db.execute(
        select(VaultEntry).where(
            VaultEntry.company_id == cid,
            VaultEntry.session_id == sid if hasattr(VaultEntry, "session_id") else VaultEntry.observaciones.ilike(f"%{str(sid)[:8]}%"),
        )
    )
    if not existing_ve.scalars().first():
        if m_ef_pyg > 0 or m_ef_brl > 0 or m_ef_usd > 0:
            ve_cash = VaultEntry(
                company_id=cid,
                branch_id=reg.branch_id,
                origen="entrega_cajero",
                monto_pyg=m_ef_pyg,
                monto_usd=m_ef_usd,
                monto_brl=m_ef_brl,
                estado="en_boveda",
                registrado_por=uuid.UUID(user_id),
                observaciones=f"Incorporación automática arqueo [{str(sid)[:8]}] de {session_obj.cajero_nombre} ({reg.nombre}). {observaciones or ''}".strip(),
            )
            db.add(ve_cash)
            vault_entries_creados.append({"tipo": "efectivo", "pyg": float(m_ef_pyg), "brl": float(m_ef_brl), "usd": float(m_ef_usd)})

        if m_cheque > 0:
            ve_chq = VaultEntry(
                company_id=cid,
                branch_id=reg.branch_id,
                origen="cheque_caja",
                monto_pyg=m_cheque,
                monto_usd=Decimal("0"),
                monto_brl=Decimal("0"),
                estado="en_boveda",
                registrado_por=uuid.UUID(user_id),
                observaciones=f"Cheques en custodia arqueo [{str(sid)[:8]}] de {session_obj.cajero_nombre} ({reg.nombre})",
            )
            db.add(ve_chq)
            vault_entries_creados.append({"tipo": "cheques", "pyg": float(m_cheque), "brl": 0.0, "usd": 0.0})

    # 2. BANCOS: Pre-registro de cobranzas electrónicas en Cuentas Corrientes
    punteo_data = await get_session_punteo_data(db, session_id, company_id)
    summary_methods = punteo_data.get("summary_by_method", {}) if punteo_data else {}

    mappings = await list_payment_method_bank_mappings(db, company_id)
    mapping_by_key = {m["canal_key"]: m for m in mappings if m["activo"] and m["bank_account_id"]}

    bank_transactions_creadas = []
    fecha_trx = session_obj.fecha_cierre.date() if session_obj.fecha_cierre else date.today()

    for canal_key, map_info in mapping_by_key.items():
        v_info = summary_methods.get(canal_key, {})
        m_gs = Decimal(str(v_info.get("monto_gs") or 0))
        if m_gs > 0:
            ref_code = f"ARQUEO-{str(sid)[:8]}-{canal_key}"
            # Evitar duplicar BankTransaction si ya fue asentado
            chk_bt = await db.execute(
                select(BankTransaction).where(
                    BankTransaction.company_id == cid,
                    BankTransaction.referencia == ref_code,
                )
            )
            if not chk_bt.scalar_one_or_none():
                bt = BankTransaction(
                    company_id=cid,
                    bank_account_id=uuid.UUID(map_info["bank_account_id"]),
                    fecha=fecha_trx,
                    tipo="ingreso",
                    monto=m_gs,
                    moneda=map_info.get("moneda") or "PYG",
                    descripcion=f"Recaudación {map_info['canal_label']} Turno {session_obj.cajero_nombre} ({reg.nombre})",
                    referencia=ref_code,
                    contraparte=map_info["canal_label"],
                    conciliado=False,
                    categoria="ventas_pos",
                )
                db.add(bt)
                bank_transactions_creadas.append({
                    "banco": map_info.get("banco_nombre"),
                    "cuenta": map_info.get("numero_cuenta"),
                    "canal": map_info["canal_label"],
                    "monto_gs": float(m_gs),
                    "referencia": ref_code,
                })

    # 3. FALTANTE DE CAJA: Generar solicitud de descuento para SueldOK
    diferencia_gs = float(count_obj.diferencia or 0)
    solicitud_faltante = None
    if diferencia_gs < 0:
        monto_faltante = abs(diferencia_gs)
        cfg = await get_cash_shortage_config(db, company_id)
        if cfg["requerir_aprobacion_siempre"] or monto_faltante >= cfg["umbral_aprobacion_gs"]:
            # Verificar si ya existe solicitud para esta sesión
            chk_req = await db.execute(
                select(CashShortageDeductionRequest).where(
                    CashShortageDeductionRequest.session_id == sid,
                    CashShortageDeductionRequest.company_id == cid,
                )
            )
            existing_req = chk_req.scalar_one_or_none()
            if not existing_req:
                periodo_str = (session_obj.fecha_cierre or datetime.now()).strftime("%Y-%m")
                shortage_req = CashShortageDeductionRequest(
                    company_id=cid,
                    session_id=sid,
                    caja_nombre=reg.nombre,
                    user_id=session_obj.user_id,
                    cajero_nombre=session_obj.cajero_nombre or "Cajero",
                    monto_faltante_gs=Decimal(str(monto_faltante)),
                    estado="pendiente",
                    cuotas=1,
                    monto_cuota_gs=Decimal(str(monto_faltante)),
                    periodo_nomina=periodo_str,
                    observaciones=f"Faltante detectado en arqueo de caja del {session_obj.fecha_cierre.strftime('%d/%m/%Y') if session_obj.fecha_cierre else 'turno'}.",
                )
                db.add(shortage_req)
                solicitud_faltante = {
                    "cajero": session_obj.cajero_nombre,
                    "monto_faltante_gs": monto_faltante,
                    "estado": "pendiente",
                    "periodo": periodo_str,
                }

    now_py = datetime.now(TZ_ASUNCION).strftime("%d/%m/%Y %H:%M")
    nota = f"\n[ASENTAMIENTO BÓVEDA & BANCOS ({now_py}) por {user_nombre}]: Bóveda ({len(vault_entries_creados)} entradas), Bancos ({len(bank_transactions_creadas)} transacciones)."
    session_obj.observaciones = (session_obj.observaciones or "") + nota

    await db.commit()

    return {
        "status": "ok",
        "session_id": str(sid),
        "cajero_nombre": session_obj.cajero_nombre,
        "register_nombre": reg.nombre,
        "vault_entries": vault_entries_creados,
        "bank_transactions": bank_transactions_creadas,
        "shortage_request": solicitud_faltante,
    }


# ── Gestión de Faltantes y Sincronización con SueldOK ──────────────────

async def list_cash_shortage_requests(db: AsyncSession, company_id: str, estado: str | None = None) -> list[dict]:
    cid = uuid.UUID(company_id)
    query = select(CashShortageDeductionRequest).where(CashShortageDeductionRequest.company_id == cid)
    if estado:
        query = query.where(CashShortageDeductionRequest.estado == estado)
    query = query.order_by(CashShortageDeductionRequest.created_at.desc())

    res = await db.execute(query)
    rows = list(res.scalars().all())
    return [
        {
            "id": str(r.id),
            "session_id": str(r.session_id),
            "caja_nombre": r.caja_nombre or "Caja",
            "user_id": str(r.user_id),
            "cajero_nombre": r.cajero_nombre,
            "monto_faltante_gs": float(r.monto_faltante_gs),
            "estado": r.estado,
            "resolucion": r.resolucion,
            "cuotas": r.cuotas,
            "monto_cuota_gs": float(r.monto_cuota_gs or r.monto_faltante_gs),
            "periodo_nomina": r.periodo_nomina,
            "sueldok_sync_status": r.sueldok_sync_status,
            "sueldok_sync_id": r.sueldok_sync_id,
            "observaciones": r.observaciones,
            "aprobado_por": r.aprobado_por,
            "aprobado_at": r.aprobado_at.isoformat() if r.aprobado_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


async def resolve_cash_shortage_request(
    db: AsyncSession,
    company_id: str,
    request_id: str,
    accion: str,  # aprobar_nomina | condonar | rechazar
    cuotas: int = 1,
    periodo_nomina: str | None = None,
    observaciones: str | None = None,
    aprobado_por: str = "Gerencia",
) -> dict:
    cid = uuid.UUID(company_id)
    rid = uuid.UUID(request_id)

    res = await db.execute(
        select(CashShortageDeductionRequest).where(
            CashShortageDeductionRequest.id == rid,
            CashShortageDeductionRequest.company_id == cid,
        )
    )
    req = res.scalar_one_or_none()
    if not req:
        raise ValueError("Solicitud de faltante no encontrada")

    cuotas_validas = max(1, cuotas or 1)
    monto_tot = req.monto_faltante_gs
    monto_cuota = Decimal(str(round(float(monto_tot) / cuotas_validas)))

    now_tz = datetime.now(timezone.utc)
    req.aprobado_por = aprobado_por
    req.aprobado_at = now_tz
    if observaciones:
        req.observaciones = f"{req.observaciones + ' | ' if req.observaciones else ''}{observaciones.strip()}"

    sueldok_result = None

    if accion == "aprobar_nomina":
        req.estado = "aprobado_nomina"
        req.resolucion = "descuento_cuotas" if cuotas_validas > 1 else "descuento_1_pago"
        req.cuotas = cuotas_validas
        req.monto_cuota_gs = monto_cuota
        if periodo_nomina:
            req.periodo_nomina = periodo_nomina

        # Sincronizar automáticamente con SueldOK
        from api.src.sueldok.service import sync_cash_shortage_deduction
        payload = {
            "user_id": str(req.user_id),
            "cajero_nombre": req.cajero_nombre,
            "monto_faltante_gs": float(req.monto_faltante_gs),
            "cuotas": cuotas_validas,
            "monto_cuota_gs": float(monto_cuota),
            "periodo_nomina": req.periodo_nomina,
            "session_id": str(req.session_id),
            "caja_nombre": req.caja_nombre,
            "observaciones": req.observaciones,
            "aprobado_por": aprobado_por,
        }
        sueldok_result = await sync_cash_shortage_deduction(db, company_id, payload)
        if sueldok_result.get("status") == "success":
            req.sueldok_sync_status = "confirmado"
            req.sueldok_sync_id = f"SUELDOK-{str(rid)[:8]}"
        else:
            req.sueldok_sync_status = "error"

    elif accion == "condonar":
        req.estado = "condonado"
        req.resolucion = "perdida_empresa"
        req.sueldok_sync_status = "no_aplica"

    elif accion == "rechazar":
        req.estado = "rechazado"
        req.resolucion = "rechazado"
        req.sueldok_sync_status = "no_aplica"

    await db.commit()
    await db.refresh(req)

    return {
        "status": "ok",
        "request_id": str(req.id),
        "estado": req.estado,
        "resolucion": req.resolucion,
        "cuotas": req.cuotas,
        "monto_cuota_gs": float(req.monto_cuota_gs or 0),
        "sueldok_status": req.sueldok_sync_status,
        "sueldok_response": sueldok_result,
    }




