"""Inteliforce service — API movil para la app unificada con SueldOK"""

from sqlalchemy import select, text, update, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from math import radians, sin, cos, sqrt, atan2
import os
import logging
import json
import re
import uuid
import bcrypt
import httpx

logger = logging.getLogger(__name__)

SUELDOK_BASE_URL = os.environ.get("SUELDOK_URL", "https://sueldok.intellihouse.lat")
SUELDOK_API_KEY = os.environ.get("SUELDOK_API_KEY", "ifk_m953H3eJeBUZj3ITBHtNlLQPbGg-AO8FLberndVxEdE")
_SUELDOK_CACHE: dict = {"data": None, "timestamp": 0}

from api.src.inteliforce.models import (
    InteliforceServiceKey, InteliforceDevice, InteliforceSyncRecord,
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

    clean_c = re.sub(r'[\.\-\s]', '', cedula.strip())
    result = await db.execute(
        select(SalesRep).where(
            SalesRep.company_id == key.company_id,
            SalesRep.activo == True,
            or_(
                SalesRep.cedula == cedula.strip(),
                func.replace(func.replace(SalesRep.cedula, '.', ''), '-', '') == clean_c,
            ),
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
        SELECT rc.customer_id,
               CASE 
                   WHEN rc.orden_visita > 0 THEN rc.orden_visita 
                   ELSE ROW_NUMBER() OVER (PARTITION BY sr.id ORDER BY rc.orden_visita, c.razon_social)
               END as orden_visita,
               sr.id as route_id, sr.nombre as route_nombre,
               c.razon_social, c.nombre_fantasia, c.ruc, c.ci,
               COALESCE(c.extra_club_numero, c.ci, c.ruc) as codigo_interno,
               c.direccion, c.telefono,
               c.latitud::float as latitud, c.longitud::float as longitud,
               COALESCE(ca.limite_credito, c.credito_limite, 0)::float as credito_limite,
               COALESCE(ca.saldo_utilizado, c.credito_usado, 0)::float as credito_usado,
               COALESCE(ca.saldo_disponible, 0)::float as saldo_disponible,
               COALESCE(ca.dias_plazo, 30) as dias_plazo,
               COALESCE((
                   SELECT COUNT(*) 
                   FROM accounts_receivable ar 
                   WHERE ar.customer_id = c.id 
                     AND ar.estado IN ('pendiente', 'parcial') 
                     AND ar.fecha_vencimiento < CURRENT_DATE
               ), 0) as documentos_vencidos,
               COALESCE((
                   SELECT SUM(ar.saldo_pendiente)::float 
                   FROM accounts_receivable ar 
                   WHERE ar.customer_id = c.id 
                     AND ar.estado IN ('pendiente', 'parcial')
               ), 0.0) as deuda_pendiente
        FROM sales_routes sr
        JOIN route_customers rc ON rc.route_id = sr.id
        JOIN customers c ON c.id = rc.customer_id
        LEFT JOIN credit_accounts ca ON ca.customer_id = c.id
        WHERE sr.company_id = :company_id
        AND sr.user_id = :user_id
        AND sr.estado = 'activo'
        AND (rc.dia_semana IS NULL OR rc.dia_semana = :dow)
        ORDER BY rc.orden_visita ASC
    """)
    result = await db.execute(query, {"company_id": company_id, "user_id": str(rep.user_id), "dow": dow})
    return [dict(row._mapping) for row in result.fetchall()]


async def update_customer_location(
    db: AsyncSession,
    company_id: str,
    customer_id: str,
    rep: SalesRep,
    lat: float,
    lng: float,
    motivo: str,
    notas: str | None = None,
    accuracy: float | None = None,
) -> dict:
    """Actualiza las coordenadas GPS del cliente en la base de datos con registro
    de auditoría y justificación requerida por el vendedor en campo."""
    await db.execute(
        text("""
            UPDATE customers
            SET latitud = :lat, longitud = :lng, updated_at = now()
            WHERE id = :id AND company_id = :company_id
        """),
        {"lat": lat, "lng": lng, "id": customer_id, "company_id": company_id},
    )

    audit_id = str(uuid.uuid4())
    record = InteliforceSyncRecord(
        company_id=rep.company_id,
        record_type="location_update",
        convex_id=f"loc_{audit_id[:16]}",
        employee_convex_id=str(rep.id),
        recorded_at=datetime.now(timezone.utc),
        payload={
            "customer_id": customer_id,
            "sales_rep_id": str(rep.id),
            "sales_rep_nombre": rep.nombre,
            "coords": {"lat": lat, "lng": lng, "accuracy": accuracy},
            "motivo": motivo,
            "notas": notas,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    db.add(record)
    await db.commit()

    return {
        "ok": True,
        "customer_id": customer_id,
        "lat": lat,
        "lng": lng,
        "mensaje": "Coordenadas GPS actualizadas y auditadas correctamente.",
    }



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
    # Optimizado: acotar a los últimos 180 días con fallback a histórico si no hay compras recientes
    query = text("""
        SELECT si.product_id, p.nombre, p.sku, SUM(si.cantidad) AS cantidad_total, MAX(s.fecha)::date AS ultima_compra
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        JOIN products p ON p.id = si.product_id
        WHERE s.customer_id = :customer_id AND s.company_id = :company_id AND s.estado != 'cancelado'
          AND s.fecha > now() - interval '180 days'
        GROUP BY si.product_id, p.nombre, p.sku
        ORDER BY cantidad_total DESC
        LIMIT :limit
    """)
    result = await db.execute(query, {"customer_id": customer_id, "company_id": company_id, "limit": limit})
    rows = result.fetchall()
    if not rows:
        query_all = text("""
            SELECT si.product_id, p.nombre, p.sku, SUM(si.cantidad) AS cantidad_total, MAX(s.fecha)::date AS ultima_compra
            FROM sale_items si
            JOIN sales s ON s.id = si.sale_id
            JOIN products p ON p.id = si.product_id
            WHERE s.customer_id = :customer_id AND s.company_id = :company_id AND s.estado != 'cancelado'
            GROUP BY si.product_id, p.nombre, p.sku
            ORDER BY cantidad_total DESC
            LIMIT :limit
        """)
        result = await db.execute(query_all, {"customer_id": customer_id, "company_id": company_id, "limit": limit})
        rows = result.fetchall()
    return [dict(row._mapping) for row in rows]


async def get_suggestions(db: AsyncSession, company_id: str, customer_id: str, limit: int = 10) -> list[dict]:
    """Sugerencias accionables optimizadas en tiempo de respuesta"""
    habitual_lineas = await db.execute(
        text("""
            SELECT pl.id AS linea_id, COUNT(*) AS compras
            FROM sale_items si
            JOIN sales s ON s.id = si.sale_id
            JOIN products p ON p.id = si.product_id
            JOIN product_lines pl ON pl.id = p.linea_id
            WHERE s.customer_id = :customer_id AND s.company_id = :company_id AND s.estado != 'cancelado'
              AND s.fecha > now() - interval '180 days'
            GROUP BY pl.id
            HAVING COUNT(*) >= 1
            ORDER BY compras DESC
            LIMIT 5
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
            HAVING MAX(s.fecha) < now() - interval '45 days'
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
    # 1. Datos consolidados de cliente, crédito, cuentas por cobrar y cheques en una sola pasada
    cust_query = text("""
        SELECT c.*,
               ca.limite_credito, ca.saldo_utilizado, ca.saldo_disponible, ca.dias_plazo,
               COALESCE(ar.pendiente, 0) as ar_pendiente,
               COALESCE(ar.vencidos, 0) as ar_vencidos,
               COALESCE(ch.cartera, 0) as checks_cartera,
               COALESCE(ch.rechazados, 0) as checks_rechazados,
               COALESCE(ch.pagares, 0) as pagares
        FROM customers c
        LEFT JOIN credit_accounts ca ON ca.customer_id = c.id
        LEFT JOIN (
            SELECT customer_id,
                   SUM(saldo_pendiente) as pendiente,
                   COUNT(CASE WHEN fecha_vencimiento < CURRENT_DATE THEN 1 END) as vencidos
            FROM accounts_receivable
            WHERE customer_id = :id AND estado IN ('pendiente', 'parcial')
            GROUP BY customer_id
        ) ar ON ar.customer_id = c.id
        LEFT JOIN (
            SELECT customer_id,
                   SUM(CASE WHEN tipo = 'cheque' AND estado IN ('cartera', 'depositado') THEN monto ELSE 0 END) as cartera,
                   SUM(CASE WHEN tipo = 'cheque' AND estado = 'rechazado' THEN monto ELSE 0 END) as rechazados,
                   SUM(CASE WHEN tipo = 'pagare' THEN monto ELSE 0 END) as pagares
            FROM checks
            WHERE customer_id = :id
            GROUP BY customer_id
        ) ch ON ch.customer_id = c.id
        WHERE c.id = :id AND c.company_id = :company_id
    """)
    cust_result = await db.execute(cust_query, {"id": customer_id, "company_id": company_id})
    row = cust_result.fetchone()
    if not row:
        return None
    c_data = dict(row._mapping)

    # 2. Facturas pendientes detalladas (máximo 15 más urgentes para no demorar la red)
    invoices_result = await db.execute(
        text("""
            SELECT id, numero_documento, fecha_emision::text as fecha_emision,
                   fecha_vencimiento::text as fecha_vencimiento,
                   monto_original, saldo_pendiente,
                   GREATEST(0, (CURRENT_DATE - fecha_vencimiento)::int) as dias_mora,
                   (fecha_vencimiento < CURRENT_DATE) as vencido
            FROM accounts_receivable
            WHERE customer_id = :id AND estado IN ('pendiente', 'parcial')
            ORDER BY fecha_vencimiento ASC
            LIMIT 15
        """),
        {"id": customer_id},
    )
    facturas_pendientes = [
        {
            "id": str(r.id),
            "numero": r.numero_documento or "S/N",
            "fecha_emision": str(r.fecha_emision) if r.fecha_emision else None,
            "fecha_vencimiento": str(r.fecha_vencimiento) if r.fecha_vencimiento else None,
            "monto_total": float(r.monto_original or 0),
            "saldo_pendiente": float(r.saldo_pendiente or 0),
            "dias_atraso": int(r.dias_mora or 0),
            "vencido": bool(r.vencido),
        }
        for r in invoices_result.fetchall()
    ]

    # 3. Ventas recientes
    sales_result = await db.execute(
        text("""
            SELECT numero, fecha, total, estado FROM sales
            WHERE customer_id = :id AND company_id = :company_id
            ORDER BY fecha DESC LIMIT 5
        """),
        {"id": customer_id, "company_id": company_id},
    )
    ultimas = [dict(r._mapping) for r in sales_result.fetchall()]

    # 4. Top productos y sugerencias de venta
    top_productos = await get_top_products(db, company_id, customer_id)
    sugerencias = await get_suggestions(db, company_id, customer_id)

    vencidos_count = int(c_data.get("ar_vencidos") or 0)
    saldo_disp = float(c_data.get("saldo_disponible") or 0)
    cred_lim = float(c_data.get("limite_credito") or c_data.get("credito_limite") or 0)

    estado_credito = "normal"
    if vencidos_count > 0:
        estado_credito = "moroso"
    elif saldo_disp <= 0 and cred_lim > 0:
        estado_credito = "bloqueado"

    ch_cartera = float(c_data.get("checks_cartera") or 0)
    ch_rechazados = float(c_data.get("checks_rechazados") or 0)
    pagares_monto = float(c_data.get("pagares") or 0)
    ar_pend = float(c_data.get("ar_pendiente") or 0)
    deuda_total_consolidada = ar_pend + ch_cartera + ch_rechazados + pagares_monto

    # 5. Diagnóstico de IA Comercial generado por Marco
    dias_sin_compra = None
    if ultimas and ultimas[0].get("fecha"):
        ultima_fecha = ultimas[0]["fecha"]
        if isinstance(ultima_fecha, datetime):
            dias_sin_compra = (datetime.now(timezone.utc) - ultima_fecha).days
        elif isinstance(ultima_fecha, date):
            dias_sin_compra = (date.today() - ultima_fecha).days

    marco_puntos = []
    if vencidos_count > 0:
        marco_puntos.append(f"Cobro prioritario: registra {vencidos_count} documento(s) vencido(s). Gestioná el cobro para liberar su crédito.")
    elif ch_rechazados > 0:
        marco_puntos.append(f"Alerta financiera: tiene cheques rechazados en gestión de canje.")
    elif saldo_disp > 0:
        marco_puntos.append(f"Crédito disponible para venta: Gs. {int(saldo_disp):,}.")

    if sugerencias:
        nombres_sug = [s["nombre"] for s in sugerencias[:3]]
        marco_puntos.append(f"Productos sugeridos para el pedido de hoy: {', '.join(nombres_sug)}.")
    elif top_productos:
        nombres_top = [t["nombre"] for t in top_productos[:3]]
        marco_puntos.append(f"Líneas habituales de alta rotación: {', '.join(nombres_top)}.")

    if dias_sin_compra is not None:
        if dias_sin_compra > 25:
            marco_puntos.append(f"Atención: pasaron {dias_sin_compra} días desde su último pedido. Recomiendo asegurar reposición para evitar quiebre en su punto de venta.")
        else:
            marco_puntos.append(f"Cadencia activa: última compra hace {dias_sin_compra} días.")

    marco_sugerencia_texto = " | ".join(marco_puntos) if marco_puntos else "Cliente sin historial suficiente de compras. Sugiero ofrecer los combos líderes de PARESA (Coca-Cola / Fanta) y líneas core de alta rotación."

    return {
        "customer_id": c_data["id"],
        "razon_social": c_data["razon_social"],
        "nombre_fantasia": c_data.get("nombre_fantasia"),
        "ruc": c_data.get("ruc"),
        "ci": c_data.get("ci"),
        "codigo_interno": c_data.get("extra_club_numero") or None,
        "direccion": c_data.get("direccion"),
        "telefono": c_data.get("telefono"),
        "email": c_data.get("email"),
        "latitud": float(c_data["latitud"]) if c_data.get("latitud") is not None else None,
        "longitud": float(c_data["longitud"]) if c_data.get("longitud") is not None else None,
        "credito_limite": cred_lim,
        "credito_usado": float(c_data.get("saldo_utilizado") or c_data.get("credito_usado") or 0),
        "saldo_disponible": saldo_disp,
        "dias_plazo": c_data.get("dias_plazo"),
        "cuentas_por_cobrar_pendiente": ar_pend,
        "documentos_vencidos": vencidos_count,
        "cheques_en_cartera": ch_cartera,
        "cheques_rechazados": ch_rechazados,
        "pagares": pagares_monto,
        "deuda_total_consolidada": deuda_total_consolidada,
        "estado_credito": estado_credito,
        "facturas_pendientes": facturas_pendientes,
        "ultimas_compras": ultimas,
        "top_productos": top_productos,
        "sugerencias": sugerencias,
        "marco_sugerencia": f"💡 Sugerencia de Marco: {marco_sugerencia_texto}",
        "marco_analisis": {
            "dias_sin_compra": dias_sin_compra,
            "nivel_riesgo": "alto" if vencidos_count > 0 or ch_rechazados > 0 else ("medio" if saldo_disp <= 0 and cred_lim > 0 else "bajo"),
            "oportunidad_reposicion": len(sugerencias) > 0,
            "top_linea": sugerencias[0]["linea_nombre"] if sugerencias else (top_productos[0]["sku"] if top_productos else "Línea Core"),
        },
    }


# ── Asistencia y Jornada (SueldOK Integration) ──────────────────────────────

async def fetch_sueldok_team_overview() -> dict:
    """Consulta la API de SueldOK con caché ligero en memoria para no saturar la red."""
    global _SUELDOK_CACHE
    import time
    now = time.time()
    if _SUELDOK_CACHE.get("data") and (now - _SUELDOK_CACHE.get("timestamp", 0)) < 15:
        return _SUELDOK_CACHE["data"]

    url = f"{SUELDOK_BASE_URL.rstrip('/')}/http/api/intelimarket/overview?apiKey={SUELDOK_API_KEY}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(url, headers={"User-Agent": "Inteliforce/1.0", "Accept": "application/json"})
            if res.status_code == 200:
                data = res.json()
                _SUELDOK_CACHE = {"data": data, "timestamp": now}
                return data
            else:
                logger.warning(f"SueldOK overview returned status {res.status_code}")
    except Exception as e:
        logger.warning(f"Error connecting to SueldOK overview: {e}")
        if _SUELDOK_CACHE.get("data"):
            return _SUELDOK_CACHE["data"]
    return _SUELDOK_CACHE.get("data") or {}


async def record_attendance_punch(
    db: AsyncSession,
    rep: SalesRep,
    tipo: str,
    lat: float | None = None,
    lng: float | None = None,
    accuracy: float | None = None,
    foto_url: str | None = None,
    notas: str | None = None,
    battery_level: float | None = None,
) -> dict:
    punch_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    estado_map = {
        "entrada": "en_jornada",
        "salida": "jornada_cerrada",
        "almuerzo_inicio": "en_pausa",
        "almuerzo_fin": "en_jornada",
    }
    estado_jornada = estado_map.get(tipo, "en_jornada")

    payload = {
        "punch_id": punch_id,
        "tipo": tipo,
        "recorded_at": now.isoformat(),
        "sales_rep_id": str(rep.id),
        "sales_rep_nombre": rep.nombre,
        "cedula": rep.cedula,
        "coords": {"lat": lat, "lng": lng, "accuracy": accuracy} if lat is not None else None,
        "foto_url": foto_url,
        "notas": notas,
        "batteryLevel": battery_level,
        "estado_jornada": estado_jornada,
    }

    record = InteliforceSyncRecord(
        company_id=rep.company_id,
        record_type="attendance",
        convex_id=f"att_{punch_id[:16]}",
        employee_convex_id=str(rep.id),
        recorded_at=now,
        payload=payload,
    )
    db.add(record)
    await db.commit()

    # Formato hora local Paraguay (UTC-3)
    hora_str = (now - timedelta(hours=3)).strftime("%H:%M")
    mensajes = {
        "entrada": f"¡Entrada registrada a las {hora_str} hs! Buen inicio de jornada.",
        "salida": f"Salida registrada a las {hora_str} hs. ¡Excelente labor hoy!",
        "almuerzo_inicio": "Pausa de almuerzo iniciada.",
        "almuerzo_fin": "Pausa finalizada. Reanudando jornada de ventas.",
    }

    return {
        "ok": True,
        "punch_id": punch_id,
        "tipo": tipo,
        "recorded_at": now.isoformat(),
        "estado_jornada": estado_jornada,
        "mensaje": mensajes.get(tipo, "Marcación registrada correctamente"),
    }


async def get_attendance_today(db: AsyncSession, rep: SalesRep) -> dict:
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    result = await db.execute(
        text("""
            SELECT id, recorded_at, payload
            FROM inteliforce_sync_records
            WHERE company_id = :cid
              AND record_type = 'attendance'
              AND employee_convex_id = :rep_id
              AND recorded_at >= :today_start
            ORDER BY recorded_at ASC
        """),
        {"cid": rep.company_id, "rep_id": str(rep.id), "today_start": today_start},
    )
    rows = result.fetchall()
    marcaciones = []
    hora_entrada = None
    hora_salida = None
    entrada_dt = None
    estado_jornada = "sin_marcar"

    for r in rows:
        p = r.payload or {}
        tipo = p.get("tipo")
        # UTC-3
        hora_py = (r.recorded_at - timedelta(hours=3)).strftime("%H:%M") if r.recorded_at else ""
        marcaciones.append({
            "id": str(r.id),
            "tipo": tipo,
            "hora": hora_py,
            "recorded_at": r.recorded_at.isoformat() if r.recorded_at else "",
            "coords": p.get("coords"),
            "foto_url": p.get("foto_url"),
            "notas": p.get("notas"),
        })
        if tipo == "entrada" and not hora_entrada:
            hora_entrada = hora_py
            entrada_dt = r.recorded_at
            estado_jornada = "en_jornada"
        elif tipo == "almuerzo_inicio":
            estado_jornada = "en_pausa"
        elif tipo == "almuerzo_fin":
            estado_jornada = "en_jornada"
        elif tipo == "salida":
            hora_salida = hora_py
            estado_jornada = "jornada_cerrada"

    sueldok_data = await fetch_sueldok_team_overview()
    employees = sueldok_data.get("employees", [])

    colaborador_sueldok = None
    for emp in employees:
        ci_str = str(emp.get("ci") or "").strip().replace(".", "").replace("-", "")
        rep_ci = str(rep.cedula or "").strip().replace(".", "").replace("-", "")
        if ci_str and ci_str == rep_ci:
            colaborador_sueldok = emp
            break

    if colaborador_sueldok and not hora_entrada:
        if colaborador_sueldok.get("entrada") and colaborador_sueldok.get("entrada") != "—":
            hora_entrada = colaborador_sueldok.get("entrada")
            estado_jornada = "en_jornada"

    minutos_trabajados = 0
    if entrada_dt:
        fin_dt = datetime.now(timezone.utc)
        minutos_trabajados = max(0, int((fin_dt - entrada_dt).total_seconds() / 60))

    colaborador_info = {
        "nombre": rep.nombre,
        "cedula": rep.cedula,
        "cargo": colaborador_sueldok.get("cargo") if colaborador_sueldok else (rep.rol.upper() if rep.rol else "VENDEDOR"),
        "departamento": colaborador_sueldok.get("depto") if colaborador_sueldok else (rep.rama.upper() if rep.rama else "AMAMBAY"),
        "empresa": "Casa Gonzalito S.R.L.",
        "salario": colaborador_sueldok.get("salario") if colaborador_sueldok else 0,
        "sueldok_sync": True,
        "horario": "08:00 - 17:00 hs",
    }

    return {
        "estado_jornada": estado_jornada,
        "hora_entrada": hora_entrada,
        "hora_salida": hora_salida,
        "minutos_trabajados": minutos_trabajados,
        "marcaciones": marcaciones,
        "colaborador": colaborador_info,
        "metricas_empresa": sueldok_data.get("metrics") or {},
    }


async def get_team_attendance(db: AsyncSession, rep: SalesRep) -> dict:
    sueldok_data = await fetch_sueldok_team_overview()
    employees = sueldok_data.get("employees", [])
    today_attendance = sueldok_data.get("todayAttendance", [])
    metrics = sueldok_data.get("metrics", {})
    company = sueldok_data.get("company", {})

    att_map = {att.get("employeeId"): att for att in today_attendance if isinstance(att, dict)}

    team_list = []
    for emp in employees:
        emp_id = emp.get("id")
        att = att_map.get(emp_id)
        team_list.append({
            "id": emp_id,
            "nombre": emp.get("nombre"),
            "ci": emp.get("ci"),
            "cargo": emp.get("cargo"),
            "depto": emp.get("depto"),
            "estado": emp.get("estado"),
            "hoy": emp.get("hoy"),
            "entrada": att.get("horaEntrada") if att else emp.get("entrada"),
            "salida": att.get("horaSalida") if att else None,
            "status": att.get("status") if att else ("Present" if emp.get("hoy") == "presente" else "Absent"),
            "checkInPhotoUrl": att.get("checkInPhotoUrl") if att else None,
            "checkOutPhotoUrl": att.get("checkOutPhotoUrl") if att else None,
        })

    return {
        "colaboradores": team_list,
        "metricas": metrics,
        "empresa": company,
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
    clean_c = re.sub(r'[\.\-\s]', '', cedula.strip())
    result = await db.execute(
        select(SalesRep).where(
            SalesRep.company_id == key.company_id,
            SalesRep.activo == True,
            or_(
                SalesRep.cedula == cedula.strip(),
                func.replace(func.replace(SalesRep.cedula, '.', ''), '-', '') == clean_c,
            ),
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
    clean_c = re.sub(r'[\.\-\s]', '', cedula.strip())
    result = await db.execute(
        select(SalesRep).where(
            SalesRep.company_id == uuid.UUID(company_id),
            SalesRep.activo == True,
            or_(
                SalesRep.cedula == cedula.strip(),
                func.replace(func.replace(SalesRep.cedula, '.', ''), '-', '') == clean_c,
            ),
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
        text("SELECT latitud, longitud FROM customers WHERE id = :id"),
        {"id": customer_id},
    )
    row = r.fetchone()
    if row and row.latitud is not None and row.longitud is not None:
        return float(row.latitud), float(row.longitud)
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
