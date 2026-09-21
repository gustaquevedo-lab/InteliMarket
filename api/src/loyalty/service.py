from datetime import datetime, timedelta
import uuid

from sqlalchemy import select, func as sa_func, text
from sqlalchemy.ext.asyncio import AsyncSession

from decimal import Decimal
from api.src.loyalty.models import LoyaltyConfig, LoyaltyPoints, LoyaltyReward, LoyaltyRedemption
from api.src.loyalty.schemas import (
    LoyaltyConfigCreate, LoyaltyConfigUpdate, PointsCreate,
    LoyaltyRewardCreate, LoyaltyRewardUpdate, RewardStockEntryCreate, RewardRedeemCreate
)
from api.src.inventory.models import Warehouse, Stock, InventoryMovement
from api.src.purchases.models import Supplier
from api.src.products.models import Product


async def ensure_premios_warehouse(db: AsyncSession, company_id: str) -> Warehouse:
    """Garantiza la existencia del depósito dedicado de premios Extra Club para la empresa."""
    cid = uuid.UUID(company_id) if isinstance(company_id, str) else company_id
    result = await db.execute(
        select(Warehouse).where(
            Warehouse.company_id == cid,
            Warehouse.codigo == "PREMIOS"
        )
    )
    wh = result.scalar_one_or_none()
    if not wh:
        wh = Warehouse(
            company_id=cid,
            codigo="PREMIOS",
            nombre="Depósito Central de Premios Extra Club",
            tipo="premios",
            responsable="Marketing & Fidelidad Extra Club",
            descripcion="Depósito exclusivo para resguardo y control de stock de premios aportados por patrocinadores o adquiridos para canje de socios.",
            activo=True,
        )
        db.add(wh)
        await db.flush()
        await db.refresh(wh)
    return wh


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


async def earn_points(db: AsyncSession, data: PointsCreate, config: LoyaltyConfig | None = None) -> LoyaltyPoints | None:
    from api.src.customers.models import Customer
    cust = await db.get(Customer, data.customer_id)
    if not cust or not cust.extra_club_numero or not cust.extra_club_numero.strip():
        # No socios de Extra Club no pueden acumular puntos
        return None
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
    from api.src.customers.models import Customer
    cust = await db.get(Customer, uuid.UUID(customer_id))
    is_member = bool(cust and cust.extra_club_numero and cust.extra_club_numero.strip())

    if not is_member:
        return {
            "customer_id": uuid.UUID(customer_id),
            "total_puntos": 0,
            "puntos_por_vencer": 0,
            "is_member": False,
            "extra_club_numero": None,
        }

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
        "is_member": True,
        "extra_club_numero": cust.extra_club_numero.strip() if cust.extra_club_numero else None,
    }


async def get_balances_map(db: AsyncSession, company_id: str) -> dict[str, int]:
    """Retorna un mapeo customer_id -> total_puntos para todos los clientes con puntos en la empresa."""
    cid = uuid.UUID(company_id) if isinstance(company_id, str) else company_id
    stmt = (
        select(
            LoyaltyPoints.customer_id,
            sa_func.coalesce(sa_func.sum(LoyaltyPoints.puntos), 0).label("total"),
        )
        .where(LoyaltyPoints.company_id == cid)
        .group_by(LoyaltyPoints.customer_id)
    )
    res = await db.execute(stmt)
    return {str(row[0]): int(row[1]) for row in res.all()}



async def audit_loyalty_points(db: AsyncSession, company_id: str, dry_run: bool = True) -> dict:
    """Auditoría de puntos ExtraClub:
    Verifica si existen puntos acreditados a clientes que no cuenten con membresía
    activa (extra_club_numero). Si dry_run=False, aplica movimientos de ajuste correctivo.
    """
    from sqlalchemy import or_
    from api.src.customers.models import Customer

    cid = uuid.UUID(company_id) if isinstance(company_id, str) else company_id
    stmt = (
        select(
            LoyaltyPoints.customer_id,
            Customer.razon_social,
            Customer.ruc,
            sa_func.sum(LoyaltyPoints.puntos).label("puntos_acumulados"),
            sa_func.count(LoyaltyPoints.id).label("total_movimientos"),
        )
        .join(Customer, Customer.id == LoyaltyPoints.customer_id)
        .where(
            LoyaltyPoints.company_id == cid,
            or_(
                Customer.extra_club_numero.is_(None),
                Customer.extra_club_numero == "",
            ),
        )
        .group_by(LoyaltyPoints.customer_id, Customer.razon_social, Customer.ruc)
        .having(sa_func.sum(LoyaltyPoints.puntos) > 0)
    )
    res = await db.execute(stmt)
    rows = res.all()
    ineligible_customers = []
    total_ineligible_points = 0

    for r in rows:
        pts = int(r.puntos_acumulados or 0)
        total_ineligible_points += pts
        ineligible_customers.append({
            "customer_id": str(r.customer_id),
            "razon_social": r.razon_social,
            "ruc": r.ruc,
            "puntos_acumulados": pts,
            "total_movimientos": r.total_movimientos,
        })

    corrected = False
    if not dry_run and ineligible_customers:
        for ic in ineligible_customers:
            if ic["puntos_acumulados"] > 0:
                corr = LoyaltyPoints(
                    company_id=cid,
                    customer_id=uuid.UUID(ic["customer_id"]),
                    tipo="ajuste",
                    puntos=-ic["puntos_acumulados"],
                    descripcion="Ajuste auditoría ExtraClub: Cliente sin tarjeta de membresía registrada",
                )
                db.add(corr)
        await db.commit()
        corrected = True

    return {
        "company_id": str(company_id),
        "dry_run": dry_run,
        "clientes_no_socios_con_puntos": len(ineligible_customers),
        "total_puntos_inconsistentes": total_ineligible_points,
        "detalles": ineligible_customers,
        "corregido": corrected,
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
    cid = data.company_id
    # Garantizar depósito exclusivo de premios si no vino asignado
    warehouse_id = data.warehouse_id
    if not warehouse_id:
        wh = await ensure_premios_warehouse(db, str(cid))
        warehouse_id = wh.id

    patrocinador_nombre = data.patrocinador_nombre
    if data.supplier_id and not patrocinador_nombre:
        sup_res = await db.execute(select(Supplier).where(Supplier.id == data.supplier_id))
        sup = sup_res.scalar_one_or_none()
        if sup:
            patrocinador_nombre = sup.razon_social

    dump = data.model_dump()
    dump["warehouse_id"] = warehouse_id
    dump["patrocinador_nombre"] = patrocinador_nombre
    reward = LoyaltyReward(**dump)
    db.add(reward)
    await db.flush()
    await db.refresh(reward)

    # Si se especificó stock inicial > 0 y tiene product_id, registrar en Stock del depósito
    if reward.stock and reward.stock > 0 and reward.product_id and reward.warehouse_id:
        st_res = await db.execute(
            select(Stock).where(
                Stock.warehouse_id == reward.warehouse_id,
                Stock.product_id == reward.product_id
            )
        )
        st = st_res.scalar_one_or_none()
        if st:
            st.cantidad += reward.stock
        else:
            st = Stock(
                warehouse_id=reward.warehouse_id,
                product_id=reward.product_id,
                cantidad=reward.stock,
                costo_unitario=reward.costo_referencial or 0
            )
            db.add(st)
        mov = InventoryMovement(
            company_id=cid,
            warehouse_id=reward.warehouse_id,
            product_id=reward.product_id,
            tipo="entrada",
            cantidad=reward.stock,
            costo_unitario=reward.costo_referencial or 0,
            referencia_type="loyalty_reward_init",
            referencia_id=reward.id,
            motivo=f"Alta inicial premio Extra Club {reward.nombre}"
        )
        db.add(mov)
        await db.flush()

    return reward


async def get_reward(db: AsyncSession, reward_id: str) -> LoyaltyReward | None:
    result = await db.execute(select(LoyaltyReward).where(LoyaltyReward.id == uuid.UUID(reward_id)))
    return result.scalar_one_or_none()


async def list_rewards(db: AsyncSession, company_id: str, activo: bool | None = None) -> list[dict]:
    cid = uuid.UUID(company_id)
    query = select(LoyaltyReward).where(LoyaltyReward.company_id == cid)
    if activo is not None:
        query = query.where(LoyaltyReward.activo == activo)
    query = query.order_by(LoyaltyReward.puntos_requeridos)
    result = await db.execute(query)
    rewards = list(result.scalars().all())

    wh_res = await db.execute(select(Warehouse.id, Warehouse.nombre).where(Warehouse.company_id == cid))
    wh_map = {w[0]: w[1] for w in wh_res.all()}

    prod_ids = [r.product_id for r in rewards if r.product_id]
    prod_map = {}
    if prod_ids:
        p_res = await db.execute(select(Product.id, Product.sku).where(Product.id.in_(prod_ids)))
        prod_map = {p[0]: p[1] for p in p_res.all()}

    out = []
    for r in rewards:
        d = {
            "id": r.id,
            "company_id": r.company_id,
            "nombre": r.nombre,
            "descripcion": r.descripcion,
            "puntos_requeridos": r.puntos_requeridos,
            "tipo_recompensa": r.tipo_recompensa,
            "valor_recompensa": r.valor_recompensa,
            "stock": r.stock or 0,
            "imagen_url": r.imagen_url,
            "activo": r.activo,
            "supplier_id": r.supplier_id,
            "product_id": r.product_id,
            "warehouse_id": r.warehouse_id,
            "patrocinador_nombre": r.patrocinador_nombre,
            "aporte_tipo": r.aporte_tipo,
            "unidades_pactadas": r.unidades_pactadas or 0,
            "costo_referencial": r.costo_referencial or 0,
            "notas": r.notas,
            "warehouse_nombre": wh_map.get(r.warehouse_id, "Depósito Central de Premios") if r.warehouse_id else "Depósito Central de Premios",
            "product_sku": prod_map.get(r.product_id),
            "created_at": r.created_at,
            "updated_at": r.updated_at,
        }
        out.append(d)
    return out


async def update_reward(db: AsyncSession, reward_id: str, data: LoyaltyRewardUpdate) -> LoyaltyReward | None:
    reward = await get_reward(db, reward_id)
    if not reward:
        return None

    update_dict = data.model_dump(exclude_unset=True)
    if "supplier_id" in update_dict and update_dict["supplier_id"]:
        sup_res = await db.execute(select(Supplier).where(Supplier.id == update_dict["supplier_id"]))
        sup = sup_res.scalar_one_or_none()
        if sup and not update_dict.get("patrocinador_nombre"):
            update_dict["patrocinador_nombre"] = sup.razon_social

    for field, value in update_dict.items():
        setattr(reward, field, value)
    await db.flush()
    await db.refresh(reward)
    return reward


async def delete_reward(db: AsyncSession, reward_id: str) -> bool:
    reward = await get_reward(db, reward_id)
    if not reward:
        return False
    reward.activo = False
    await db.flush()
    return True


async def add_reward_stock(
    db: AsyncSession,
    reward_id: str,
    cantidad: int,
    remision_proveedor: str | None = None,
    costo_unitario: Decimal | None = None,
    notas: str | None = None,
    user_id: uuid.UUID | None = None,
) -> LoyaltyReward:
    reward = await get_reward(db, reward_id)
    if not reward:
        raise ValueError("Premio no encontrado")
    if cantidad <= 0:
        raise ValueError("La cantidad debe ser mayor a 0")

    if not reward.warehouse_id:
        wh = await ensure_premios_warehouse(db, str(reward.company_id))
        reward.warehouse_id = wh.id

    reward.stock = (reward.stock or 0) + cantidad
    if costo_unitario is not None:
        reward.costo_referencial = costo_unitario

    if reward.product_id and reward.warehouse_id:
        st_res = await db.execute(
            select(Stock).where(
                Stock.warehouse_id == reward.warehouse_id,
                Stock.product_id == reward.product_id
            )
        )
        st = st_res.scalar_one_or_none()
        if st:
            st.cantidad += cantidad
            if costo_unitario:
                st.costo_unitario = costo_unitario
        else:
            st = Stock(
                warehouse_id=reward.warehouse_id,
                product_id=reward.product_id,
                cantidad=cantidad,
                costo_unitario=costo_unitario or reward.costo_referencial or 0
            )
            db.add(st)

        mov = InventoryMovement(
            company_id=reward.company_id,
            warehouse_id=reward.warehouse_id,
            product_id=reward.product_id,
            tipo="entrada",
            cantidad=cantidad,
            costo_unitario=costo_unitario or reward.costo_referencial or 0,
            referencia_type="loyalty_stock_in",
            referencia_id=reward.id,
            motivo=f"Ingreso stock premio {reward.nombre}. Remisión: {remision_proveedor or 'S/N'}. Notas: {notas or 'Patrocinio'}",
            user_id=user_id
        )
        db.add(mov)

    await db.flush()
    await db.refresh(reward)
    return reward


async def redeem_reward(
    db: AsyncSession,
    reward_id: str,
    customer_id: str,
    company_id: str,
    cantidad: int = 1,
    notas: str | None = None,
    user_name: str | None = None,
    user_id: uuid.UUID | None = None,
) -> LoyaltyRedemption:
    reward = await get_reward(db, reward_id)
    if not reward:
        raise ValueError("Premio no encontrado")
    if not reward.activo:
        raise ValueError("El premio se encuentra inactivo")

    current_stock = reward.stock or 0
    if current_stock < cantidad:
        raise ValueError(f"Stock insuficiente en el Depósito de Premios. Disponible: {current_stock}, Solicitado: {cantidad}")

    bal = await get_balance(db, customer_id, company_id)
    puntos_necesarios = reward.puntos_requeridos * cantidad
    if bal["total_puntos"] < puntos_necesarios:
        raise ValueError(
            f"Puntos insuficientes. El socio tiene {bal['total_puntos']:,} pts y se requieren {puntos_necesarios:,} pts."
        )

    # 1. Debitar puntos
    pts = LoyaltyPoints(
        company_id=uuid.UUID(company_id),
        customer_id=uuid.UUID(customer_id),
        tipo="canje",
        puntos=-puntos_necesarios,
        referencia_tipo="loyalty_redemption",
        referencia_id=str(reward.id),
        descripcion=f"Canje de Premio: {reward.nombre} (x{cantidad}) - Patrocinado por {reward.patrocinador_nombre or 'Extra Supermercado'}",
    )
    db.add(pts)

    # 2. Descontar stock del premio
    reward.stock = current_stock - cantidad

    # 3. Descontar stock de inventario si tiene producto vinculado
    if reward.product_id and reward.warehouse_id:
        st_res = await db.execute(
            select(Stock).where(
                Stock.warehouse_id == reward.warehouse_id,
                Stock.product_id == reward.product_id
            )
        )
        st = st_res.scalar_one_or_none()
        if st:
            st.cantidad = max(0, st.cantidad - cantidad)

        mov = InventoryMovement(
            company_id=uuid.UUID(company_id),
            warehouse_id=reward.warehouse_id,
            product_id=reward.product_id,
            tipo="salida",
            cantidad=cantidad,
            costo_unitario=reward.costo_referencial or 0,
            referencia_type="loyalty_redemption",
            referencia_id=reward.id,
            motivo=f"Salida por Canje Extra Club a socio {customer_id}",
            user_id=user_id
        )
        db.add(mov)

    # 4. Crear registro de redención
    comprobante_num = f"CANJE-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    redemption = LoyaltyRedemption(
        company_id=uuid.UUID(company_id),
        customer_id=uuid.UUID(customer_id),
        reward_id=reward.id,
        warehouse_id=reward.warehouse_id,
        supplier_id=reward.supplier_id,
        puntos_canjeados=puntos_necesarios,
        cantidad=cantidad,
        comprobante_numero=comprobante_num,
        entregado_por=user_name or "Atención al Cliente",
        notas=notas,
    )
    db.add(redemption)
    await db.flush()
    await db.refresh(redemption)
    return redemption


async def list_redemptions(db: AsyncSession, company_id: str, limit: int = 50) -> list[LoyaltyRedemption]:
    cid = uuid.UUID(company_id)
    res = await db.execute(
        select(LoyaltyRedemption)
        .where(LoyaltyRedemption.company_id == cid)
        .order_by(LoyaltyRedemption.created_at.desc())
        .limit(limit)
    )
    return list(res.scalars().all())



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
