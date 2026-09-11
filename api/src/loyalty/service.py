from datetime import datetime, timedelta
import uuid

from sqlalchemy import select, func as sa_func, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.loyalty.models import LoyaltyConfig, LoyaltyPoints, LoyaltyReward
from api.src.loyalty.schemas import LoyaltyConfigCreate, LoyaltyConfigUpdate, PointsCreate, LoyaltyRewardCreate, LoyaltyRewardUpdate


async def get_or_create_config(db: AsyncSession, company_id: str) -> LoyaltyConfig:
    result = await db.execute(
        select(LoyaltyConfig).where(LoyaltyConfig.company_id == uuid.UUID(company_id))
    )
    config = result.scalar_one_or_none()
    if not config:
        config = LoyaltyConfig(company_id=uuid.UUID(company_id))
        db.add(config)
        await db.flush()
        await db.refresh(config)
    return config


async def update_config(db: AsyncSession, company_id: str, data: LoyaltyConfigUpdate) -> LoyaltyConfig | None:
    config = await get_or_create_config(db, company_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(config, field, value)
    await db.flush()
    await db.refresh(config)
    return config


async def earn_points(db: AsyncSession, data: PointsCreate, config: LoyaltyConfig | None = None) -> LoyaltyPoints:
    if not config:
        config = await get_or_create_config(db, str(data.company_id))
    vence_en = None
    if config.vencimiento_dias > 0:
        vence_en = datetime.utcnow() + timedelta(days=config.vencimiento_dias)
    pts = LoyaltyPoints(
        company_id=data.company_id,
        customer_id=data.customer_id,
        tipo=data.tipo,
        puntos=data.puntos,
        referencia_tipo=data.referencia_tipo,
        referencia_id=data.referencia_id,
        descripcion=data.descripcion,
        vence_en=vence_en,
    )
    db.add(pts)
    await db.flush()
    await db.refresh(pts)
    return pts


async def get_balance(db: AsyncSession, customer_id: str, company_id: str) -> dict:
    now = datetime.utcnow()
    total = await db.execute(
        select(sa_func.coalesce(sa_func.sum(LoyaltyPoints.puntos), 0)).where(
            LoyaltyPoints.customer_id == uuid.UUID(customer_id),
            LoyaltyPoints.company_id == uuid.UUID(company_id),
        )
    )
    puntos_por_vencer = await db.execute(
        select(sa_func.coalesce(sa_func.sum(LoyaltyPoints.puntos), 0)).where(
            LoyaltyPoints.customer_id == uuid.UUID(customer_id),
            LoyaltyPoints.company_id == uuid.UUID(company_id),
            LoyaltyPoints.vence_en.isnot(None),
            LoyaltyPoints.vence_en <= now,
        )
    )
    return {
        "customer_id": uuid.UUID(customer_id),
        "total_puntos": int(total.scalar() or 0),
        "puntos_por_vencer": int(puntos_por_vencer.scalar() or 0),
    }


async def get_history(db: AsyncSession, customer_id: str, company_id: str, limit: int = 50) -> list[LoyaltyPoints]:
    result = await db.execute(
        select(LoyaltyPoints).where(
            LoyaltyPoints.customer_id == uuid.UUID(customer_id),
            LoyaltyPoints.company_id == uuid.UUID(company_id),
        ).order_by(LoyaltyPoints.created_at.desc()).limit(limit)
    )
    return list(result.scalars().all())


async def create_reward(db: AsyncSession, data: LoyaltyRewardCreate) -> LoyaltyReward:
    reward = LoyaltyReward(**data.model_dump())
    db.add(reward)
    await db.flush()
    await db.refresh(reward)
    return reward


async def get_reward(db: AsyncSession, reward_id: str) -> LoyaltyReward | None:
    result = await db.execute(select(LoyaltyReward).where(LoyaltyReward.id == uuid.UUID(reward_id)))
    return result.scalar_one_or_none()


async def list_rewards(db: AsyncSession, company_id: str, activo: bool | None = None) -> list[LoyaltyReward]:
    query = select(LoyaltyReward).where(LoyaltyReward.company_id == uuid.UUID(company_id))
    if activo is not None:
        query = query.where(LoyaltyReward.activo == activo)
    query = query.order_by(LoyaltyReward.puntos_requeridos)
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_reward(db: AsyncSession, reward_id: str, data: LoyaltyRewardUpdate) -> LoyaltyReward | None:
    reward = await get_reward(db, reward_id)
    if not reward:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(reward, field, value)
    await db.flush()
    await db.refresh(reward)
    return reward


async def delete_reward(db: AsyncSession, reward_id: str) -> bool:
    reward = await get_reward(db, reward_id)
    if not reward:
        return False
    await db.delete(reward)
    await db.flush()
    return True



# ── Tarjetas Extra Club (Zebra ZC300) ─────────────────────────────────────
#
# El numero de socio es un UUID (asi lo generaba el legacy, y asi lo reconoce la
# caja: POSPage.tsx busca un UUID completo al escanear y abre el saldo del
# socio). Por eso el QR de la tarjeta lleva EL UUID PELADO, sin URL ni JSON: si
# se le agrega cualquier cosa, la caja deja de reconocerlo.

import asyncio as _asyncio
import json as _json
import ssl as _ssl
import urllib.request as _urlreq

from sqlalchemy import or_ as _or

from api.src.customers.models import Customer
from api.src.credit_accounts.models import CreditAccount

ZC300_HOST_DEFAULT = "192.168.0.51"


async def listar_socios_tarjeta(
    db: AsyncSession, company_id: str, q: str | None, solo_con_numero: bool, limit: int
) -> list[dict]:
    """Clientes activos con los datos que pueden ir en la tarjeta y su linea de
    credito real (credit_accounts, no las columnas duplicadas de customers)."""
    cid = uuid.UUID(company_id)
    stmt = (
        select(Customer, CreditAccount)
        .outerjoin(
            CreditAccount,
            (CreditAccount.customer_id == Customer.id) & (CreditAccount.activo.is_(True)),
        )
        .where(Customer.company_id == cid, Customer.activo.is_(True))
    )
    if solo_con_numero:
        stmt = stmt.where(Customer.extra_club_numero.isnot(None), Customer.extra_club_numero != "")
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            _or(
                Customer.razon_social.ilike(like),
                Customer.nombre_fantasia.ilike(like),
                Customer.ci.ilike(like),
                Customer.ruc.ilike(like),
                Customer.extra_club_numero.ilike(like),
            )
        )
    # Primero los que ya son socios (tienen numero), despues por nombre.
    stmt = stmt.order_by(Customer.extra_club_numero.is_(None), Customer.razon_social).limit(limit)
    res = await db.execute(stmt)

    out = []
    for c, ca in res.all():
        out.append({
            "customer_id": str(c.id),
            "nombre": (c.razon_social or c.nombre_fantasia or "").strip(),
            "documento": c.ci or c.ruc,
            "ci": c.ci,
            "ruc": c.ruc,
            "telefono": c.telefono,
            "ciudad": c.ciudad,
            "extra_club_numero": (c.extra_club_numero or "").strip() or None,
            "empresa_vinculada": c.empresa_vinculada_nombre,
            "tiene_credito": ca is not None,
            "limite_credito": float(ca.limite_credito) if ca is not None else None,
            "saldo_disponible": float(ca.saldo_disponible) if ca is not None else None,
        })
    return out


async def asignar_numero_socio(db: AsyncSession, company_id: str, customer_id: str) -> dict | None:
    """Le da numero de socio a quien no lo tiene. NUNCA pisa uno existente:
    cambiarlo invalidaria cualquier tarjeta ya impresa con el numero viejo.

    FOR UPDATE: si dos personas emiten la tarjeta del mismo cliente a la vez,
    la segunda espera y encuentra el numero que genero la primera, en vez de
    generar otro distinto."""
    res = await db.execute(
        select(Customer)
        .where(Customer.id == uuid.UUID(customer_id), Customer.company_id == uuid.UUID(company_id))
        .with_for_update()
    )
    c = res.scalar_one_or_none()
    if c is None:
        return None
    actual = (c.extra_club_numero or "").strip()
    if actual:
        return {"extra_club_numero": actual, "asignado_ahora": False}
    c.extra_club_numero = str(uuid.uuid4())
    await db.commit()
    return {"extra_club_numero": c.extra_club_numero, "asignado_ahora": True}


def _leer_json_zc300(host: str, recurso: str) -> dict:
    # La ZC300 trae un certificado autofirmado. Es la red interna del local, y
    # solo se LEE su estado: no se le manda nada por aca.
    ctx = _ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = _ssl.CERT_NONE
    with _urlreq.urlopen(f"https://{host}/{recurso}", timeout=5, context=ctx) as r:
        return _json.loads(r.read().decode("utf-8", "replace"))


def _campo(d: dict, ruta: str):
    """La interfaz de la ZC300 usa claves con puntos ("ribbon.description").
    Se acepta tanto la clave plana como la anidada, por si cambia el firmware."""
    if not isinstance(d, dict):
        return None
    if ruta in d:
        return d[ruta]
    cur = d
    for parte in ruta.split("."):
        if not isinstance(cur, dict) or parte not in cur:
            return None
        cur = cur[parte]
    return cur


def _entero(v):
    try:
        return int(str(v).strip())
    except (TypeError, ValueError):
        return None


async def estado_impresora_tarjetas(db: AsyncSession, company_id: str) -> dict:
    """Estado real de la ZC300, leido de su propia interfaz: errores, tarjetas,
    cinta. Sirve para avisar ANTES de imprimir, no despues."""
    host = ZC300_HOST_DEFAULT
    try:
        from api.src.label_printing.models import LabelPrinterConfig

        res = await db.execute(
            select(LabelPrinterConfig).where(
                LabelPrinterConfig.company_id == uuid.UUID(company_id),
                LabelPrinterConfig.tipo == "zc300_tarjeta",
            )
        )
        cfg = res.scalar_one_or_none()
        if cfg is not None and cfg.host:
            host = cfg.host
    except Exception:
        pass

    try:
        st, idx = await _asyncio.gather(
            _asyncio.to_thread(_leer_json_zc300, host, "StatusValues.json"),
            _asyncio.to_thread(_leer_json_zc300, host, "IndexValues.json"),
        )
    except Exception as e:
        return {"alcanzable": False, "host": host, "mensaje": f"No se pudo leer la impresora: {e}"}

    s = st.get("status_values", st)
    i = idx.get("index_values", idx)
    err = str(_campo(s, "device.printer_error") or _campo(i, "device.printer_error") or "0").strip()
    msg = " ".join(str(_campo(s, "device.printer_status_msg") or _campo(i, "device.printer_status_msg") or "").split())
    return {
        "alcanzable": True,
        "host": host,
        "estado": _campo(s, "device.printer_state"),
        "error_code": err,
        "con_error": err not in ("0", ""),
        "mensaje": msg,
        "sin_tarjetas": err == "4001" or "out of cards" in msg.lower(),
        "doble_faz": str(_campo(i, "hwconfig.printer_is_dualsided")).lower() in ("true", "yes", "1"),
        "cinta": _campo(i, "ribbon.description"),
        "cinta_codigo": _campo(i, "ribbon.part_number"),
        "paneles_restantes": _entero(_campo(i, "ribbon.panels_remaining")),
        "paneles_iniciales": _entero(_campo(i, "ribbon.initial_panel_count")),
        "total_impresas": _entero(_campo(i, "card.total_printed")),
    }
