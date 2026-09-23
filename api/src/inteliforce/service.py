"""Inteliforce service — API movil para la app unificada con SueldOK"""

from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from math import radians, sin, cos, sqrt, atan2
import json
import uuid
import bcrypt

from api.src.inteliforce.models import (
    InteliforceServiceKey, InteliforceDevice,
    InteliforceVisit, InteliforceIncident, InteliforceMedia, InteliforceLotExpiry,
)
from api.src.inteliforce.schemas import SyncRecord
from api.src.sales_targets.models import SalesRep
from api.src.auth.jwt import create_access_token


async def get_service_key(db: AsyncSession, api_key: str) -> InteliforceServiceKey | None:
    result = await db.execute(
        select(InteliforceServiceKey).where(
            InteliforceServiceKey.api_key == api_key,
            InteliforceServiceKey.activo == True,
        )
    )
    return result.scalar_one_or_none()


async def exchange_auth(db: AsyncSession, api_key: str, cedula: str) -> dict | None:
    """SueldOK ya autentico al empleado (o esta en medio del SSO) y canjea su
    cedula por un JWT de Intelimarket para que la app pueda pegarle directo a
    la API de pedidos/metas/cliente 360. Nunca se comparte contrasena real."""
    key = await get_service_key(db, api_key)
    if not key:
        return None

    result = await db.execute(
        select(SalesRep).where(
            SalesRep.company_id == key.company_id,
            SalesRep.cedula == cedula,
            SalesRep.activo == True,
        )
    )
    rep = result.scalar_one_or_none()
    if not rep or not rep.user_id:
        return None

    token = create_access_token(
        {
            "sub": str(rep.user_id),
            "id": str(rep.user_id),
            "company_id": str(rep.company_id),
            "tenant_id": str(rep.company_id),
            "rol": rep.rol,
            "sales_rep_id": str(rep.id),
        },
        expires_delta=timedelta(hours=12),
    )
    return {
        "access_token": token,
        "sales_rep_id": rep.id,
        "nombre": rep.nombre,
        "rol": rep.rol,
    }


async def get_rep_by_token_claim(db: AsyncSession, sales_rep_id: str) -> SalesRep | None:
    result = await db.execute(select(SalesRep).where(SalesRep.id == uuid.UUID(sales_rep_id)))
    return result.scalar_one_or_none()


async def get_routes_today(db: AsyncSession, company_id: str, rep: SalesRep) -> list[dict]:
    if not rep.user_id:
        return []
    # SalesRoute usa 0=Domingo..6=Sabado (comentario en el modelo); date.weekday()
    # de Python es 0=Lunes..6=Domingo, hay que convertir.
    dow = (date.today().weekday() + 1) % 7
    query = text("""
        SELECT rc.customer_id, rc.orden_visita, sr.id as route_id, sr.nombre as route_nombre,
               c.razon_social, c.direccion, c.telefono
        FROM sales_routes sr
        JOIN route_customers rc ON rc.route_id = sr.id
        JOIN customers c ON c.id = rc.customer_id
        WHERE sr.company_id = :company_id
        AND sr.user_id = :user_id
        AND sr.estado = 'activo'
        AND (rc.dia_semana IS NULL OR rc.dia_semana = :dow)
        ORDER BY rc.orden_visita ASC
    """)
    result = await db.execute(query, {"company_id": company_id, "user_id": str(rep.user_id), "dow": dow})
    return [dict(row._mapping) for row in result.fetchall()]


async def search_products(
    db: AsyncSession, company_id: str, rama: str | None, search: str, limit: int = 30, offset: int = 0,
) -> list[dict]:
    """Cataloto filtrado por la rama del vendedor autenticado (viene del JWT,
    no de un parametro del cliente — no se puede falsear pidiendo la otra
    rama). Lineas sin clasificar (rama NULL) quedan visibles para todos."""
    query = text("""
        SELECT p.id, p.sku, p.nombre, p.precio_venta, p.unidad_medida,
               pl.nombre AS linea_nombre,
               COALESCE(SUM(st.cantidad), 0) AS stock
        FROM products p
        LEFT JOIN product_lines pl ON pl.id = p.linea_id
        LEFT JOIN stock st ON st.product_id = p.id
        WHERE p.company_id = :company_id AND p.activo = true
        AND (pl.rama IS NULL OR pl.rama = :rama OR pl.rama = 'ambas')
        AND (p.nombre ILIKE :search OR p.sku ILIKE :search)
        GROUP BY p.id, p.sku, p.nombre, p.precio_venta, p.unidad_medida, pl.nombre
        ORDER BY p.nombre ASC
        LIMIT :limit OFFSET :offset
    """)
    result = await db.execute(query, {
        "company_id": company_id, "rama": rama, "search": f"%{search}%",
        "limit": limit, "offset": offset,
    })
    return [dict(row._mapping) for row in result.fetchall()]


async def get_targets_breakdown(db: AsyncSession, rep, periodo_inicio: date, periodo_fin: date) -> list[dict]:
    """Una fila por cada componente/linea de meta del periodo — el dueño pidio
    especificamente ver el detalle completo, no solo un total agregado."""
    from api.src.sales_targets.service import get_rep_progress
    from api.src.sales_targets.models import SalesTarget
    from sqlalchemy import select as sa_select

    result = await db.execute(
        sa_select(SalesTarget).where(
            SalesTarget.sales_rep_id == rep.id,
            SalesTarget.periodo_inicio == periodo_inicio,
            SalesTarget.periodo_fin == periodo_fin,
            SalesTarget.product_line_id.isnot(None),
        )
    )
    target_rows = result.scalars().all()

    breakdown = []
    for t in target_rows:
        from api.src.sales_targets.models import ProductLine
        line_result = await db.execute(sa_select(ProductLine).where(ProductLine.id == t.product_line_id))
        line = line_result.scalar_one_or_none()
        progress = await get_rep_progress(db, rep, periodo_inicio, periodo_fin, product_line_id=str(t.product_line_id))
        breakdown.append({
            "product_line_id": t.product_line_id,
            "nombre": line.nombre if line else "—",
            "meta_gs": progress["meta_gs"], "venta_gs": progress["venta_gs"], "pct_gs": progress["pct_gs"],
            "meta_unidades": progress["meta_unidades"], "unidades": progress["unidades"],
            "pct_unidades": progress["pct_unidades"], "cumplido": progress["cumplido"],
        })
    return breakdown


async def get_top_products(db: AsyncSession, company_id: str, customer_id: str, limit: int = 8) -> list[dict]:
    query = text("""
        SELECT si.product_id, p.nombre, SUM(si.cantidad) AS cantidad_total, MAX(s.fecha)::date AS ultima_compra
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        JOIN products p ON p.id = si.product_id
        WHERE s.customer_id = :customer_id AND s.company_id = :company_id AND s.estado != 'cancelado'
        GROUP BY si.product_id, p.nombre
        ORDER BY cantidad_total DESC
        LIMIT :limit
    """)
    result = await db.execute(query, {"customer_id": customer_id, "company_id": company_id, "limit": limit})
    return [dict(row._mapping) for row in result.fetchall()]


async def get_suggestions(db: AsyncSession, company_id: str, customer_id: str, limit: int = 10) -> list[dict]:
    """Sugerencias accionables: (a) productos de sus lineas habituales que no
    compra hace 60+ dias (win-back), (b) top-sellers de esas mismas lineas
    que nunca compro (cross-sell). Ranking simple por frecuencia real, sin ML
    — explicable y verificable contra los datos."""
    habitual_lineas = await db.execute(
        text("""
            SELECT pl.id AS linea_id, COUNT(*) AS compras
            FROM sale_items si
            JOIN sales s ON s.id = si.sale_id
            JOIN products p ON p.id = si.product_id
            JOIN product_lines pl ON pl.id = p.linea_id
            WHERE s.customer_id = :customer_id AND s.company_id = :company_id AND s.estado != 'cancelado'
            GROUP BY pl.id
            HAVING COUNT(*) >= 2
            ORDER BY compras DESC
            LIMIT 8
        """),
        {"customer_id": customer_id, "company_id": company_id},
    )
    linea_ids = [row.linea_id for row in habitual_lineas.fetchall()]
    if not linea_ids:
        return []

    winback = await db.execute(
        text("""
            SELECT p.id AS product_id, p.nombre, p.sku, p.precio_venta, pl.nombre AS linea_nombre,
                   MAX(s.fecha)::date AS ultima_compra
            FROM sale_items si
            JOIN sales s ON s.id = si.sale_id
            JOIN products p ON p.id = si.product_id
            JOIN product_lines pl ON pl.id = p.linea_id
            WHERE s.customer_id = :customer_id AND s.company_id = :company_id AND s.estado != 'cancelado'
            AND p.linea_id = ANY(:linea_ids) AND p.activo = true
            GROUP BY p.id, p.nombre, p.sku, p.precio_venta, pl.nombre
            HAVING MAX(s.fecha) < now() - interval '60 days'
            ORDER BY MAX(s.fecha) ASC
            LIMIT :limit
        """),
        {"customer_id": customer_id, "company_id": company_id, "linea_ids": linea_ids, "limit": limit},
    )
    sugerencias = [
        {
            "product_id": row.product_id, "nombre": row.nombre, "sku": row.sku,
            "precio_venta": float(row.precio_venta or 0), "linea_nombre": row.linea_nombre,
            "motivo": f"no_compra_desde_{row.ultima_compra}",
        }
        for row in winback.fetchall()
    ]

    restantes = limit - len(sugerencias)
    if restantes > 0:
        crosssell = await db.execute(
            text("""
                SELECT p.id AS product_id, p.nombre, p.sku, p.precio_venta, pl.nombre AS linea_nombre,
                       COUNT(*) AS ventas
                FROM sale_items si
                JOIN sales s ON s.id = si.sale_id
                JOIN products p ON p.id = si.product_id
                JOIN product_lines pl ON pl.id = p.linea_id
                WHERE s.company_id = :company_id AND s.fecha > now() - interval '90 days'
                AND p.linea_id = ANY(:linea_ids) AND p.activo = true
                AND NOT EXISTS (
                    SELECT 1 FROM sale_items si2 JOIN sales s2 ON s2.id = si2.sale_id
                    WHERE s2.customer_id = :customer_id AND si2.product_id = p.id
                )
                GROUP BY p.id, p.nombre, p.sku, p.precio_venta, pl.nombre
                ORDER BY ventas DESC
                LIMIT :limit
            """),
            {"company_id": company_id, "customer_id": customer_id, "linea_ids": linea_ids, "limit": restantes},
        )
        sugerencias += [
            {
                "product_id": row.product_id, "nombre": row.nombre, "sku": row.sku,
                "precio_venta": float(row.precio_venta or 0), "linea_nombre": row.linea_nombre,
                "motivo": "nunca_comprado_top_linea",
            }
            for row in crosssell.fetchall()
        ]

    return sugerencias


async def get_customer_360(db: AsyncSession, company_id: str, customer_id: str) -> dict | None:
    cust_result = await db.execute(
        text("SELECT * FROM customers WHERE id = :id AND company_id = :company_id"),
        {"id": customer_id, "company_id": company_id},
    )
    customer = cust_result.fetchone()
    if not customer:
        return None
    customer = dict(customer._mapping)

    credit_result = await db.execute(
        text("SELECT limite_credito, saldo_utilizado, saldo_disponible, dias_plazo FROM credit_accounts WHERE customer_id = :id"),
        {"id": customer_id},
    )
    credit = credit_result.fetchone()

    ar_result = await db.execute(
        text("""
            SELECT COALESCE(SUM(saldo_pendiente), 0) as pendiente,
                   COALESCE(SUM(CASE WHEN fecha_vencimiento < CURRENT_DATE THEN 1 ELSE 0 END), 0) as vencidos
            FROM accounts_receivable WHERE customer_id = :id AND estado = 'pendiente'
        """),
        {"id": customer_id},
    )
    ar = ar_result.fetchone()

    checks_result = await db.execute(
        text("""
            SELECT 
                COALESCE(SUM(CASE WHEN tipo = 'cheque' AND estado IN ('cartera', 'depositado') THEN monto ELSE 0 END), 0) as cartera,
                COALESCE(SUM(CASE WHEN tipo = 'cheque' AND estado = 'rechazado' THEN monto ELSE 0 END), 0) as rechazados,
                COALESCE(SUM(CASE WHEN tipo = 'pagare' THEN monto ELSE 0 END), 0) as pagares
            FROM checks WHERE customer_id = :id
        """),
        {"id": customer_id},
    )
    ch_row = checks_result.fetchone()
    checks_cartera = float(ch_row.cartera) if ch_row else 0.0
    checks_rechazados = float(ch_row.rechazados) if ch_row else 0.0
    pagares = float(ch_row.pagares) if ch_row else 0.0
    deuda_total_consolidada = float(ar.pendiente) + checks_cartera + checks_rechazados + pagares

    sales_result = await db.execute(
        text("""
            SELECT numero, fecha, total, estado FROM sales
            WHERE customer_id = :id AND company_id = :company_id
            ORDER BY fecha DESC LIMIT 5
        """),
        {"id": customer_id, "company_id": company_id},
    )
    ultimas = [dict(row._mapping) for row in sales_result.fetchall()]
    top_productos = await get_top_products(db, company_id, customer_id)
    sugerencias = await get_suggestions(db, company_id, customer_id)

    return {
        "customer_id": customer["id"],
        "razon_social": customer["razon_social"],
        "ruc": customer.get("ruc"),
        "direccion": customer.get("direccion"),
        "telefono": customer.get("telefono"),
        "credito_limite": float(credit.limite_credito) if credit else float(customer.get("credito_limite") or 0),
        "credito_usado": float(credit.saldo_utilizado) if credit else float(customer.get("credito_usado") or 0),
        "saldo_disponible": float(credit.saldo_disponible) if credit else 0,
        "dias_plazo": credit.dias_plazo if credit else None,
        "cuentas_por_cobrar_pendiente": float(ar.pendiente),
        "documentos_vencidos": int(ar.vencidos),
        "cheques_en_cartera": float(checks_cartera),
        "ultimas_compras": ultimas,
        "top_productos": top_productos,
        "sugerencias": sugerencias,
    }


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distancia en metros entre dos coordenadas (fórmula haversine)."""
    R = 6_371_000
    φ1, φ2 = radians(lat1), radians(lat2)
    dφ = radians(lat2 - lat1)
    dλ = radians(lng2 - lng1)
    a = sin(dφ / 2) ** 2 + cos(φ1) * cos(φ2) * sin(dλ / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


# ── Auth directa (PIN) ────────────────────────────────────────────────────────

async def set_pin(db: AsyncSession, api_key: str, cedula: str, pin: str) -> bool:
    """Bootstrap: usa la service key para autorizar el seteo inicial del PIN.
    La app llama esto una sola vez cuando el supervisor le entrega el dispositivo."""
    key = await get_service_key(db, api_key)
    if not key:
        return False
    result = await db.execute(
        select(SalesRep).where(
            SalesRep.company_id == key.company_id,
            SalesRep.cedula == cedula,
            SalesRep.activo == True,
        )
    )
    rep = result.scalar_one_or_none()
    if not rep:
        return False
    pin_hash = bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()
    await db.execute(
        text("UPDATE sales_reps SET pin_hash = :h WHERE id = :id"),
        {"h": pin_hash, "id": str(rep.id)},
    )
    await db.commit()
    return True


async def direct_login(db: AsyncSession, company_id: str, cedula: str, pin: str) -> dict | None:
    """Login directo desde la app Inteliforce sin intermediario SueldOK."""
    result = await db.execute(
        select(SalesRep).where(
            SalesRep.company_id == uuid.UUID(company_id),
            SalesRep.cedula == cedula,
            SalesRep.activo == True,
        )
    )
    rep = result.scalar_one_or_none()
    if not rep:
        return None
    pin_hash_row = await db.execute(
        text("SELECT pin_hash FROM sales_reps WHERE id = :id"), {"id": str(rep.id)}
    )
    row = pin_hash_row.fetchone()
    if not row or not row.pin_hash:
        return None
    if not bcrypt.checkpw(pin.encode(), row.pin_hash.encode()):
        return None
    token = create_access_token(
        {
            "sub": str(rep.user_id or rep.id),
            "id": str(rep.user_id or rep.id),
            "company_id": str(rep.company_id),
            "tenant_id": str(rep.company_id),
            "rol": rep.rol,
            "sales_rep_id": str(rep.id),
        },
        expires_delta=timedelta(hours=12),
    )
    return {"access_token": token, "sales_rep_id": rep.id, "nombre": rep.nombre, "rol": rep.rol}


# ── Dispositivos FCM ──────────────────────────────────────────────────────────

async def register_device(db: AsyncSession, rep: SalesRep, fcm_token: str, platform: str, app_version: str | None) -> None:
    existing = await db.execute(
        select(InteliforceDevice).where(
            InteliforceDevice.sales_rep_id == rep.id,
            InteliforceDevice.fcm_token == fcm_token,
        )
    )
    device = existing.scalar_one_or_none()
    if device:
        device.activo = True
        device.last_seen = datetime.now(timezone.utc)
        if app_version:
            device.app_version = app_version
    else:
        db.add(InteliforceDevice(
            sales_rep_id=rep.id,
            company_id=rep.company_id,
            fcm_token=fcm_token,
            platform=platform,
            app_version=app_version,
        ))
    await db.commit()


# ── Visitas ───────────────────────────────────────────────────────────────────

async def _get_poi_range(db: AsyncSession, customer_id: str) -> float:
    """Rango en metros configurado para el POI. Default 150m si no hay config."""
    r = await db.execute(
        text("SELECT inteliforce_rango_m FROM customers WHERE id = :id"),
        {"id": customer_id},
    )
    row = r.fetchone()
    if row and row.inteliforce_rango_m:
        return float(row.inteliforce_rango_m)
    return 150.0


async def _get_customer_coords(db: AsyncSession, customer_id: str) -> tuple[float, float] | None:
    r = await db.execute(
        text("SELECT gps_lat, gps_lng FROM customers WHERE id = :id"),
        {"id": customer_id},
    )
    row = r.fetchone()
    if row and row.gps_lat and row.gps_lng:
        return float(row.gps_lat), float(row.gps_lng)
    return None


async def checkin(
    db: AsyncSession, company_id: str, rep: SalesRep,
    customer_id: str, lat: float, lng: float, accuracy: float,
    offline_at: datetime | None = None,
) -> dict:
    coords = await _get_customer_coords(db, customer_id)
    if coords:
        rango = await _get_poi_range(db, customer_id)
        distancia = _haversine_m(lat, lng, coords[0], coords[1])
        umbral = rango + max(accuracy, 0)
        if distancia > umbral:
            return {
                "ok": False,
                "error": "fuera_de_rango",
                "distancia_m": round(distancia, 1),
                "umbral_m": round(umbral, 1),
                "rango_poi_m": rango,
                "accuracy_m": accuracy,
            }

    visit = InteliforceVisit(
        company_id=uuid.UUID(company_id),
        sales_rep_id=rep.id,
        customer_id=uuid.UUID(customer_id),
        rol=rep.rol,
        checkin_lat=lat,
        checkin_lng=lng,
        checkin_accuracy=accuracy,
        checkin_at=offline_at or datetime.now(timezone.utc),
    )
    db.add(visit)
    await db.commit()
    await db.refresh(visit)
    return {"ok": True, "visit_id": str(visit.id)}


async def checkout(
    db: AsyncSession, visit_id: str, rep: SalesRep,
    lat: float | None, lng: float | None, notas: str | None, estado: str,
    sale_id: str | None = None,
) -> bool:
    r = await db.execute(
        select(InteliforceVisit).where(
            InteliforceVisit.id == uuid.UUID(visit_id),
            InteliforceVisit.sales_rep_id == rep.id,
        )
    )
    visit = r.scalar_one_or_none()
    if not visit or visit.estado != "abierta":
        return False
    visit.checkout_at = datetime.now(timezone.utc)
    visit.checkout_lat = lat
    visit.checkout_lng = lng
    visit.notas = notas
    visit.estado = estado
    if sale_id:
        visit.sale_id = uuid.UUID(sale_id)
    await db.commit()
    return True


async def get_visits_today(db: AsyncSession, company_id: str, rep: SalesRep) -> list[dict]:
    today = date.today()
    r = await db.execute(
        text("""
            SELECT v.id, v.customer_id, c.razon_social, v.estado,
                   v.checkin_at, v.checkout_at, v.notas, v.sale_id
            FROM inteliforce_visits v
            JOIN customers c ON c.id = v.customer_id
            WHERE v.company_id = :cid AND v.sales_rep_id = :rid
            AND v.checkin_at::date = :today
            ORDER BY v.checkin_at DESC
        """),
        {"cid": company_id, "rid": str(rep.id), "today": today},
    )
    return [dict(row._mapping) for row in r.fetchall()]


# ── Incidencias ───────────────────────────────────────────────────────────────

async def create_incident(
    db: AsyncSession, visit_id: str, rep: SalesRep,
    tipo: str, descripcion: str, urgencia: str, producto_id: str | None,
) -> InteliforceIncident:
    r = await db.execute(
        select(InteliforceVisit).where(InteliforceVisit.id == uuid.UUID(visit_id))
    )
    visit = r.scalar_one_or_none()
    if not visit:
        raise ValueError("Visita no encontrada")

    incident = InteliforceIncident(
        visit_id=visit.id,
        company_id=visit.company_id,
        sales_rep_id=rep.id,
        customer_id=visit.customer_id,
        tipo=tipo,
        descripcion=descripcion,
        urgencia=urgencia,
        producto_id=uuid.UUID(producto_id) if producto_id else None,
    )
    db.add(incident)
    await db.commit()
    await db.refresh(incident)
    return incident


# ── Lotes y vencimientos ──────────────────────────────────────────────────────

async def upsert_lot_expiry(
    db: AsyncSession, company_id: str, customer_id: str, visit_id: str,
    rep: SalesRep, product_id: str, lote: str | None,
    fecha_vencimiento: date, cantidad_unidades: int | None,
) -> InteliforceLotExpiry:
    r = await db.execute(
        select(InteliforceLotExpiry).where(
            InteliforceLotExpiry.customer_id == uuid.UUID(customer_id),
            InteliforceLotExpiry.product_id == uuid.UUID(product_id),
            InteliforceLotExpiry.lote == (lote or ""),
        )
    )
    existing = r.scalar_one_or_none()
    if existing:
        existing.fecha_vencimiento = fecha_vencimiento
        existing.cantidad_unidades = cantidad_unidades
        existing.visit_id = uuid.UUID(visit_id)
        existing.sales_rep_id = rep.id
        existing.alerta_enviada = False
        existing.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(existing)
        return existing

    entry = InteliforceLotExpiry(
        company_id=uuid.UUID(company_id),
        customer_id=uuid.UUID(customer_id),
        product_id=uuid.UUID(product_id),
        visit_id=uuid.UUID(visit_id),
        sales_rep_id=rep.id,
        lote=lote or "",
        fecha_vencimiento=fecha_vencimiento,
        cantidad_unidades=cantidad_unidades,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


async def get_lot_expiry_for_customer(db: AsyncSession, company_id: str, customer_id: str) -> list[dict]:
    r = await db.execute(
        text("""
            SELECT le.id, le.product_id, p.nombre as product_nombre,
                   le.lote, le.fecha_vencimiento, le.cantidad_unidades,
                   le.updated_at,
                   (le.fecha_vencimiento - CURRENT_DATE) as dias_para_vencer
            FROM inteliforce_lot_expiry le
            JOIN products p ON p.id = le.product_id
            WHERE le.company_id = :cid AND le.customer_id = :kid AND le.activo = true
            ORDER BY le.fecha_vencimiento ASC
        """),
        {"cid": company_id, "kid": customer_id},
    )
    return [dict(row._mapping) for row in r.fetchall()]


async def check_expiry_alerts(db: AsyncSession, dias_alerta: int = 30) -> list[dict]:
    """Devuelve registros próximos a vencer que no han sido notificados aún.
    El cron llama esto diariamente y dispara las notificaciones FCM."""
    r = await db.execute(
        text("""
            SELECT le.id, le.company_id, le.customer_id, le.product_id,
                   le.lote, le.fecha_vencimiento,
                   (le.fecha_vencimiento - CURRENT_DATE) as dias_para_vencer,
                   c.razon_social as customer_nombre,
                   p.nombre as producto_nombre,
                   sr.supervisor_id
            FROM inteliforce_lot_expiry le
            JOIN customers c ON c.id = le.customer_id
            JOIN products p ON p.id = le.product_id
            JOIN sales_reps sr ON sr.id = le.sales_rep_id
            WHERE le.activo = true AND le.alerta_enviada = false
            AND (le.fecha_vencimiento - CURRENT_DATE) <= :dias
            AND (le.fecha_vencimiento - CURRENT_DATE) >= 0
        """),
        {"dias": dias_alerta},
    )
    return [dict(row._mapping) for row in r.fetchall()]


async def mark_alert_sent(db: AsyncSession, lot_expiry_id: str) -> None:
    await db.execute(
        text("UPDATE inteliforce_lot_expiry SET alerta_enviada = true WHERE id = :id"),
        {"id": lot_expiry_id},
    )
    await db.commit()


async def sync_records(db: AsyncSession, company_id: str, records: list[SyncRecord]) -> dict:
    """Upsert idempotente por (record_type, convex_id) — SueldOK puede
    reenviar el mismo evento sin duplicar (ej. si un sync nocturno se corta
    a la mitad y se reintenta). Ver convex/intelimarketSync.js del lado
    SueldOK, que es quien llama esto via el cron nuevo."""
    upserted = 0
    for r in records:
        result = await db.execute(
            text("""
                INSERT INTO inteliforce_sync_records
                    (company_id, record_type, convex_id, employee_convex_id, recorded_at, payload)
                VALUES (:company_id, :record_type, :convex_id, :employee_convex_id, :recorded_at, :payload)
                ON CONFLICT (record_type, convex_id)
                DO UPDATE SET payload = EXCLUDED.payload, synced_at = now()
            """),
            {
                "company_id": company_id,
                "record_type": r.record_type,
                "convex_id": r.convex_id,
                "employee_convex_id": r.employee_convex_id,
                "recorded_at": r.recorded_at,
                "payload": json.dumps(r.payload),
            },
        )
        upserted += 1
    await db.commit()
    return {"received": len(records), "upserted": upserted}
