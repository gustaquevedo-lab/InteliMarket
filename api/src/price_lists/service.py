"""Price list service"""

from datetime import datetime, time
from zoneinfo import ZoneInfo
from sqlalchemy import select, text, func as sa_func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import uuid

from api.src.price_lists.models import PriceList, PriceListItem, PriceVariationLog
from api.src.price_lists.schemas import PriceListCreate, PriceListUpdate, PriceListItemCreate, PriceListItemUpdate
from api.src.smart_pricing.models import PriceListAssignment
from api.src.smart_pricing.service import get_applicable_tier_price
from api.src.customers.models import Customer



async def create_price_list(db: AsyncSession, data: PriceListCreate) -> PriceList:
    pl = PriceList(**data.model_dump())
    db.add(pl)
    await db.commit()
    await db.refresh(pl)
    return pl


async def list_price_lists(db: AsyncSession, company_id: str) -> list[PriceList]:
    query = select(PriceList).where(PriceList.company_id == company_id).order_by(PriceList.nombre)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_price_list(db: AsyncSession, pl_id: str) -> PriceList | None:
    result = await db.execute(select(PriceList).where(PriceList.id == uuid.UUID(pl_id)))
    return result.scalar_one_or_none()


async def update_price_list(db: AsyncSession, pl_id: str, data: PriceListUpdate) -> PriceList | None:
    pl = await get_price_list(db, pl_id)
    if not pl:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(pl, k, v)
    await db.commit()
    await db.refresh(pl)
    return pl


async def delete_price_list(db: AsyncSession, pl_id: str) -> bool:
    pl = await get_price_list(db, pl_id)
    if not pl:
        return False
    items = await db.execute(select(PriceListItem).where(PriceListItem.price_list_id == pl.id))
    for item in items.scalars().all():
        await db.delete(item)
    assignments = await db.execute(select(PriceListAssignment).where(PriceListAssignment.price_list_id == pl.id))
    for assignment in assignments.scalars().all():
        await db.delete(assignment)
    await db.delete(pl)
    await db.commit()
    return True


async def add_item(db: AsyncSession, data: PriceListItemCreate) -> PriceListItem:
    item = PriceListItem(**data.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def list_items(db: AsyncSession, pl_id: str) -> list[PriceListItem]:
    query = select(PriceListItem).where(PriceListItem.price_list_id == uuid.UUID(pl_id), PriceListItem.activo == True)
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_item(db: AsyncSession, item_id: str, data: PriceListItemUpdate) -> PriceListItem | None:
    result = await db.execute(select(PriceListItem).where(PriceListItem.id == uuid.UUID(item_id)))
    item = result.scalar_one_or_none()
    if not item:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(item, k, v)
    await db.commit()
    await db.refresh(item)
    return item


async def delete_item(db: AsyncSession, item_id: str) -> bool:
    result = await db.execute(select(PriceListItem).where(PriceListItem.id == uuid.UUID(item_id)))
    item = result.scalar_one_or_none()
    if not item:
        return False
    await db.delete(item)
    await db.commit()
    return True


async def resolve_customer_price(
    db: AsyncSession, company_id: str, customer_id: str, product_id: str, quantity: float = 1,
) -> Optional[dict]:
    """Precio real a cobrarle a un cliente por un producto, respetando (en orden):
    1) la lista de precios asignada al cliente via PriceListAssignment (tipo=cliente),
    2) si no hay asignacion, el campo legacy Customer.price_list_id (el que ya usa
       el portal de autoservicio client_app, para no romper ese camino);
    con esa lista resuelta (si la hay), prueba en orden: escalon por cantidad scoped a
    esa lista, escalon global, precio plano de la lista. Devuelve None si nada aplica
    -- el caller debe usar el precio de catalogo (comportamiento actual sin cambios)."""
    price_list_id = None

    assignment_result = await db.execute(
        select(PriceListAssignment).where(
            PriceListAssignment.company_id == uuid.UUID(company_id),
            PriceListAssignment.tipo == "cliente",
            PriceListAssignment.ref_id == str(customer_id),
        )
    )
    assignment = assignment_result.scalars().first()
    if assignment:
        price_list_id = str(assignment.price_list_id)
    else:
        customer_result = await db.execute(select(Customer).where(Customer.id == uuid.UUID(customer_id)))
        customer = customer_result.scalar_one_or_none()
        if customer and customer.price_list_id:
            price_list_id = str(customer.price_list_id)

    if price_list_id:
        tier = await get_applicable_tier_price(db, company_id, product_id, quantity, price_list_id)
        if tier:
            return {"precio": tier["precio_unitario"], "price_list_id": price_list_id, "source": "tier_lista"}

    global_tier = await get_applicable_tier_price(db, company_id, product_id, quantity, None)
    if global_tier:
        return {"precio": global_tier["precio_unitario"], "price_list_id": price_list_id, "source": "tier_global"}

    if price_list_id:
        item_result = await db.execute(
            select(PriceListItem).where(
                PriceListItem.price_list_id == uuid.UUID(price_list_id),
                PriceListItem.product_id == uuid.UUID(product_id),
                PriceListItem.activo == True,
            )
        )
        item = item_result.scalar_one_or_none()
        if item:
            return {"precio": float(item.precio), "price_list_id": price_list_id, "source": "lista_plana"}

    return None


async def get_tiers_summary(db: AsyncSession, company_id: str) -> dict:
    cid = uuid.UUID(company_id)
    # List counts
    total_lists = (await db.execute(
        select(sa_func.count(PriceList.id)).where(PriceList.company_id == cid)
    )).scalar() or 0
    active_lists = (await db.execute(
        select(sa_func.count(PriceList.id)).where(PriceList.company_id == cid, PriceList.activo == True)
    )).scalar() or 0
    
    # Tiers stats
    stats_q = text("""
        SELECT 
            COUNT(*) as total_tiers,
            COUNT(DISTINCT product_id) as total_products,
            MIN(precio_unitario) as min_price,
            MAX(precio_unitario) as max_price
        FROM sp_tiered_prices
        WHERE activo = true AND company_id = :cid
    """)
    stats_row = (await db.execute(stats_q, {"cid": cid})).fetchone()
    
    # Breakdown by min_qty
    breakdown_q = text("""
        SELECT min_qty, COUNT(*) as count
        FROM sp_tiered_prices
        WHERE activo = true AND company_id = :cid
        GROUP BY min_qty
        ORDER BY count DESC
        LIMIT 10
    """)
    breakdown_rows = (await db.execute(breakdown_q, {"cid": cid})).fetchall()
    
    return {
        "total_lists": total_lists,
        "active_lists": active_lists,
        "total_tiers": stats_row.total_tiers if stats_row else 0,
        "total_products_with_tiers": stats_row.total_products if stats_row else 0,
        "breakdown": [{"min_qty": r.min_qty, "count": r.count} for r in breakdown_rows],
    }


async def get_products_with_tiers(
    db: AsyncSession,
    company_id: str,
    search: Optional[str] = None,
    min_qty: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    cid = uuid.UUID(company_id)
    
    where_clauses = ["p.company_id = :cid", "tp.activo = true"]
    params = {"cid": cid, "limit": limit, "offset": offset}
    
    if search and search.strip():
        where_clauses.append("(p.nombre ILIKE :search OR p.codigo_barra ILIKE :search OR p.sku ILIKE :search)")
        params["search"] = f"%{search.strip()}%"
        
    if min_qty is not None and min_qty > 0:
        where_clauses.append("tp.min_qty = :min_qty")
        params["min_qty"] = min_qty
        
    where_sql = " AND ".join(where_clauses)
    
    # Count total distinct products
    count_sql = text(f"""
        SELECT COUNT(DISTINCT p.id)
        FROM products p
        JOIN sp_tiered_prices tp ON tp.product_id = p.id
        WHERE {where_sql}
    """)
    total_count = (await db.execute(count_sql, params)).scalar() or 0
    
    # Query paginated products with aggregated tiers
    data_sql = text(f"""
        WITH ranked_products AS (
            SELECT DISTINCT p.id, p.nombre, p.codigo_barra, p.sku, p.precio_venta, p.costo_promedio
            FROM products p
            JOIN sp_tiered_prices tp ON tp.product_id = p.id
            WHERE {where_sql}
            ORDER BY p.nombre ASC
            LIMIT :limit OFFSET :offset
        )
        SELECT 
            rp.id, rp.nombre, rp.codigo_barra, rp.sku, rp.precio_venta, rp.costo_promedio,
            COALESCE(
                json_agg(
                    json_build_object(
                        'id', tp.id,
                        'min_qty', tp.min_qty,
                        'max_qty', tp.max_qty,
                        'precio_unitario', tp.precio_unitario,
                        'activo', tp.activo
                    ) ORDER BY tp.min_qty ASC
                ) FILTER (WHERE tp.id IS NOT NULL), '[]'
            ) as tiers
        FROM ranked_products rp
        JOIN sp_tiered_prices tp ON tp.product_id = rp.id AND tp.activo = true
        GROUP BY rp.id, rp.nombre, rp.codigo_barra, rp.sku, rp.precio_venta, rp.costo_promedio
        ORDER BY rp.nombre ASC
    """)
    rows = (await db.execute(data_sql, params)).fetchall()
    
    items = []
    for r in rows:
        precio_base = float(r.precio_venta or 0)
        tiers_list = []
        raw_tiers = r.tiers if isinstance(r.tiers, list) else []
        for t in raw_tiers:
            p_unit = float(t.get("precio_unitario") or 0)
            ahorro_pct = round(((precio_base - p_unit) / precio_base) * 100, 1) if precio_base > p_unit > 0 else 0.0
            tiers_list.append({
                "id": str(t.get("id")),
                "min_qty": t.get("min_qty"),
                "max_qty": t.get("max_qty"),
                "precio_unitario": p_unit,
                "ahorro_pct": ahorro_pct,
                "activo": t.get("activo", True),
            })
            
        items.append({
            "id": str(r.id),
            "nombre": r.nombre,
            "codigo_barra": r.codigo_barra,
            "sku": r.sku,
            "precio_venta": precio_base,
            "costo_promedio": float(r.costo_promedio or 0),
            "tiers": tiers_list,
        })
        
    return {
        "total": total_count,
        "items": items,
        "limit": limit,
        "offset": offset,
    }


# =========================================================================
# VARIACIONES DE PRECIOS REGULARES (AUDITORÍA & REPORTES)
# =========================================================================

PY_TZ = ZoneInfo("America/Asuncion")


def _build_variations_filters(
    company_id: str,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    tipo: Optional[str] = None,
    search: Optional[str] = None,
) -> list:
    cid = uuid.UUID(company_id)
    conditions = [PriceVariationLog.company_id == cid]

    if fecha_desde and fecha_desde.strip():
        try:
            d_start = datetime.strptime(fecha_desde.strip(), "%Y-%m-%d").date()
            start_dt = datetime.combine(d_start, time.min, tzinfo=PY_TZ)
            conditions.append(PriceVariationLog.created_at >= start_dt)
        except Exception:
            pass

    if fecha_hasta and fecha_hasta.strip():
        try:
            d_end = datetime.strptime(fecha_hasta.strip(), "%Y-%m-%d").date()
            end_dt = datetime.combine(d_end, time.max, tzinfo=PY_TZ)
            conditions.append(PriceVariationLog.created_at <= end_dt)
        except Exception:
            pass

    if tipo and tipo.strip() and tipo.strip().lower() in ("unitario", "escala"):
        conditions.append(PriceVariationLog.tipo == tipo.strip().lower())

    if search and search.strip():
        pattern = f"%{search.strip()}%"
        conditions.append(
            or_(
                PriceVariationLog.product_nombre.ilike(pattern),
                PriceVariationLog.product_sku.ilike(pattern),
                PriceVariationLog.product_barcode.ilike(pattern),
                PriceVariationLog.categoria_nombre.ilike(pattern),
            )
        )

    return conditions


def _build_variations_sql_parts(
    company_id: str,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    tipo: Optional[str] = None,
    search: Optional[str] = None,
    order_by: str = "fecha_desc",
):
    params: dict = {"cid": uuid.UUID(company_id)}
    where_parts = ["company_id = :cid"]

    if fecha_desde and fecha_desde.strip():
        try:
            d_start = datetime.strptime(fecha_desde.strip(), "%Y-%m-%d").date()
            start_dt = datetime.combine(d_start, time.min, tzinfo=PY_TZ)
            where_parts.append("created_at >= :start_dt")
            params["start_dt"] = start_dt
        except Exception:
            pass

    if fecha_hasta and fecha_hasta.strip():
        try:
            d_end = datetime.strptime(fecha_hasta.strip(), "%Y-%m-%d").date()
            end_dt = datetime.combine(d_end, time.max, tzinfo=PY_TZ)
            where_parts.append("created_at <= :end_dt")
            params["end_dt"] = end_dt
        except Exception:
            pass

    if search and search.strip():
        where_parts.append("""(
            product_nombre ILIKE :search
            OR product_sku ILIKE :search
            OR product_barcode ILIKE :search
            OR categoria_nombre ILIKE :search
        )""")
        params["search"] = f"%{search.strip()}%"

    where_clause = " AND ".join(where_parts)

    tipo_filter = ""
    if tipo and tipo.strip() in ("unitario", "escala"):
        t_clean = tipo.strip().lower()
        if t_clean == "unitario":
            tipo_filter = "WHERE cambio_unitario = true"
        elif t_clean == "escala":
            tipo_filter = "WHERE cambio_escala = true"

    if order_by == "fecha_asc":
        order_clause = "ORDER BY created_at ASC"
    elif order_by == "nombre_asc":
        order_clause = "ORDER BY product_nombre ASC NULLS LAST, created_at DESC"
    elif order_by == "nombre_desc":
        order_clause = "ORDER BY product_nombre DESC NULLS LAST, created_at DESC"
    else:
        order_clause = "ORDER BY created_at DESC"

    cte_sql = f"""
        WITH filtered AS (
            SELECT * 
            FROM price_variation_logs
            WHERE {where_clause}
        ),
        agg AS (
            SELECT 
                product_id,
                MAX(product_nombre) as product_nombre,
                MAX(product_sku) as product_sku,
                MAX(product_barcode) as product_barcode,
                MAX(categoria_nombre) as categoria_nombre,
                (ARRAY_AGG(id ORDER BY created_at DESC))[1] as id,
                (ARRAY_AGG(company_id ORDER BY created_at DESC))[1] as company_id,
                (ARRAY_AGG(usuario_id ORDER BY created_at DESC))[1] as usuario_id,
                (ARRAY_AGG(usuario_nombre ORDER BY created_at DESC))[1] as usuario_nombre,
                (ARRAY_AGG(origen ORDER BY created_at DESC))[1] as origen,
                (ARRAY_AGG(motivo ORDER BY created_at DESC))[1] as motivo,
                MAX(created_at) as created_at,
                BOOL_OR(tipo = 'unitario') as cambio_unitario,
                BOOL_OR(tipo = 'escala') as cambio_escala,
                COALESCE(
                    (ARRAY_AGG(precio_minorista_anterior ORDER BY created_at ASC) FILTER (WHERE tipo = 'unitario'))[1],
                    (ARRAY_AGG(precio_minorista_anterior ORDER BY created_at ASC))[1],
                    0
                ) as precio_minorista_anterior,
                COALESCE(
                    (ARRAY_AGG(precio_minorista_nuevo ORDER BY created_at DESC) FILTER (WHERE tipo = 'unitario'))[1],
                    (ARRAY_AGG(precio_minorista_nuevo ORDER BY created_at DESC))[1],
                    0
                ) as precio_minorista_nuevo,
                COALESCE(
                    (ARRAY_AGG(precio_escala_anterior ORDER BY created_at ASC) FILTER (WHERE tipo = 'escala'))[1],
                    (ARRAY_AGG(precio_escala_anterior ORDER BY created_at ASC))[1],
                    0
                ) as precio_escala_anterior,
                COALESCE(
                    (ARRAY_AGG(precio_escala_nuevo ORDER BY created_at DESC) FILTER (WHERE tipo = 'escala'))[1],
                    (ARRAY_AGG(precio_escala_nuevo ORDER BY created_at DESC))[1],
                    0
                ) as precio_escala_nuevo,
                COALESCE(
                    (ARRAY_AGG(escala_min_qty ORDER BY created_at DESC) FILTER (WHERE tipo = 'escala'))[1],
                    (ARRAY_AGG(escala_min_qty ORDER BY created_at DESC))[1]
                ) as escala_min_qty
            FROM filtered
            GROUP BY product_id
        ),
        calculated AS (
            SELECT 
                *,
                CASE 
                    WHEN cambio_unitario AND NOT cambio_escala THEN 'unitario'
                    WHEN cambio_escala AND NOT cambio_unitario THEN 'escala'
                    ELSE 'ambos'
                END as tipo,
                CASE 
                    WHEN cambio_unitario THEN precio_minorista_anterior
                    ELSE precio_escala_anterior
                END as precio_anterior,
                CASE 
                    WHEN cambio_unitario THEN precio_minorista_nuevo
                    ELSE precio_escala_nuevo
                END as precio_nuevo,
                CASE 
                    WHEN cambio_unitario THEN (precio_minorista_nuevo - precio_minorista_anterior)
                    ELSE (precio_escala_nuevo - precio_escala_anterior)
                END as diferencia_monto,
                CASE 
                    WHEN cambio_unitario AND precio_minorista_anterior > 0 
                        THEN ROUND(((precio_minorista_nuevo - precio_minorista_anterior) / precio_minorista_anterior) * 100, 2)
                    WHEN NOT cambio_unitario AND cambio_escala AND precio_escala_anterior > 0 
                        THEN ROUND(((precio_escala_nuevo - precio_escala_anterior) / precio_escala_anterior) * 100, 2)
                    ELSE 0
                END as diferencia_pct
            FROM agg
            {tipo_filter}
        )
    """
    return cte_sql, order_clause, params


async def list_price_variations(
    db: AsyncSession,
    company_id: str,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    tipo: Optional[str] = None,
    search: Optional[str] = None,
    order_by: str = "fecha_desc",
    page: int = 1,
    page_size: int = 25,
) -> dict:
    cte_sql, order_clause, params = _build_variations_sql_parts(
        company_id, fecha_desde, fecha_hasta, tipo, search, order_by
    )

    # 1. Resumen estadístico
    summary_sql = f"""
        {cte_sql}
        SELECT 
            count(*)::int as total,
            count(*) filter (where diferencia_monto > 0)::int as subidas,
            count(*) filter (where diferencia_monto < 0)::int as bajadas,
            coalesce(round(avg(diferencia_pct)::numeric, 2), 0)::float as promedio_pct
        FROM calculated;
    """
    summary_res = (await db.execute(text(summary_sql), params)).mappings().first()
    total = summary_res["total"] if summary_res else 0
    subidas = summary_res["subidas"] if summary_res else 0
    bajadas = summary_res["bajadas"] if summary_res else 0
    promedio_pct = float(summary_res["promedio_pct"] or 0.0) if summary_res else 0.0

    # 2. Registros paginados
    safe_page = max(1, page)
    safe_page_size = max(1, min(page_size, 500))
    offset = (safe_page - 1) * safe_page_size

    data_params = {**params, "limit": safe_page_size, "offset": offset}
    data_sql = f"""
        {cte_sql}
        SELECT * FROM calculated
        {order_clause}
        LIMIT :limit OFFSET :offset;
    """
    result = await db.execute(text(data_sql), data_params)
    rows = result.mappings().all()

    items = []
    for r in rows:
        items.append({
            "id": r["id"],
            "company_id": r["company_id"],
            "product_id": r["product_id"],
            "product_nombre": r["product_nombre"],
            "product_sku": r["product_sku"],
            "product_barcode": r["product_barcode"],
            "categoria_nombre": r["categoria_nombre"],
            "tipo": r["tipo"],
            "cambio_unitario": bool(r["cambio_unitario"]),
            "cambio_escala": bool(r["cambio_escala"]),
            "escala_min_qty": r["escala_min_qty"],
            "precio_minorista_anterior": float(r["precio_minorista_anterior"] or 0),
            "precio_minorista_nuevo": float(r["precio_minorista_nuevo"] or 0),
            "precio_escala_anterior": float(r["precio_escala_anterior"] or 0),
            "precio_escala_nuevo": float(r["precio_escala_nuevo"] or 0),
            "precio_anterior": float(r["precio_anterior"] or 0),
            "precio_nuevo": float(r["precio_nuevo"] or 0),
            "diferencia_monto": float(r["diferencia_monto"] or 0),
            "diferencia_pct": float(r["diferencia_pct"] or 0),
            "origen": r["origen"],
            "usuario_id": r["usuario_id"],
            "usuario_nombre": r["usuario_nombre"],
            "motivo": r["motivo"],
            "created_at": r["created_at"],
        })

    total_pages = max(1, (total + safe_page_size - 1) // safe_page_size) if total > 0 else 1

    return {
        "resumen": {
            "total_modificaciones": total,
            "total_subidas": subidas,
            "total_bajadas": bajadas,
            "promedio_variacion_pct": promedio_pct,
        },
        "paginacion": {
            "total": total,
            "page": safe_page,
            "page_size": safe_page_size,
            "total_pages": total_pages,
        },
        "items": items,
    }


async def get_price_variations_for_export(
    db: AsyncSession,
    company_id: str,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    tipo: Optional[str] = None,
    search: Optional[str] = None,
    order_by: str = "fecha_desc",
    max_records: int = 5000,
) -> list[dict]:
    cte_sql, order_clause, params = _build_variations_sql_parts(
        company_id, fecha_desde, fecha_hasta, tipo, search, order_by
    )

    data_params = {**params, "limit": max_records}
    data_sql = f"""
        {cte_sql}
        SELECT * FROM calculated
        {order_clause}
        LIMIT :limit;
    """
    result = await db.execute(text(data_sql), data_params)
    rows = result.mappings().all()

    items = []
    for r in rows:
        items.append({
            "id": r["id"],
            "company_id": r["company_id"],
            "product_id": r["product_id"],
            "product_nombre": r["product_nombre"],
            "product_sku": r["product_sku"],
            "product_barcode": r["product_barcode"],
            "categoria_nombre": r["categoria_nombre"],
            "tipo": r["tipo"],
            "cambio_unitario": bool(r["cambio_unitario"]),
            "cambio_escala": bool(r["cambio_escala"]),
            "escala_min_qty": r["escala_min_qty"],
            "precio_minorista_anterior": float(r["precio_minorista_anterior"] or 0),
            "precio_minorista_nuevo": float(r["precio_minorista_nuevo"] or 0),
            "precio_escala_anterior": float(r["precio_escala_anterior"] or 0),
            "precio_escala_nuevo": float(r["precio_escala_nuevo"] or 0),
            "precio_anterior": float(r["precio_anterior"] or 0),
            "precio_nuevo": float(r["precio_nuevo"] or 0),
            "diferencia_monto": float(r["diferencia_monto"] or 0),
            "diferencia_pct": float(r["diferencia_pct"] or 0),
            "origen": r["origen"],
            "usuario_id": r["usuario_id"],
            "usuario_nombre": r["usuario_nombre"],
            "motivo": r["motivo"],
            "created_at": r["created_at"],
        })
    return items


async def get_audit_state(db: AsyncSession) -> dict:
    res = await db.execute(text("""
        SELECT product_id, sku, precio_aprobado, margen_modo, margen_aprobado, status, usuario, updated_at
        FROM price_audit_decisions;
    """))
    rows = res.mappings().all()
    decisiones = {}
    for r in rows:
        decisiones[str(r["product_id"])] = {
            "price": int(round(float(r["precio_aprobado"]))),
            "margin_mode": r["margen_modo"] or "eff",
            "margin": float(r["margen_aprobado"]) if r["margen_aprobado"] is not None else None,
            "status": r["status"],
            "usuario": r["usuario"],
            "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
        }
    return {
        "status": "ok",
        "total": len(decisiones),
        "decisiones": decisiones,
    }


async def save_audit_decisions(db: AsyncSession, items: list[dict]) -> dict:
    if not items:
        return {"status": "ok", "saved_count": 0}

    for it in items:
        pid = it.get("product_id")
        if not pid:
            continue
        p_aprobado = int(round(float(it.get("precio_aprobado") or it.get("price") or 0)))
        m_modo = it.get("margen_modo") or it.get("margin_mode") or "eff"
        m_aprobado = it.get("margen_aprobado") or it.get("margin")
        m_aprobado = float(m_aprobado) if m_aprobado is not None else None
        status = it.get("status") or "MODIFIED"
        sku = str(it.get("sku") or "")
        usuario = str(it.get("usuario") or "")

        await db.execute(text("""
            INSERT INTO price_audit_decisions (
                product_id, sku, precio_aprobado, margen_modo, margen_aprobado, status, usuario, updated_at
            ) VALUES (
                :pid, :sku, :p_aprobado, :m_modo, :m_aprobado, :status, :usuario, NOW()
            )
            ON CONFLICT (product_id) DO UPDATE SET
                sku = COALESCE(NULLIF(EXCLUDED.sku, ''), price_audit_decisions.sku),
                precio_aprobado = EXCLUDED.precio_aprobado,
                margen_modo = EXCLUDED.margen_modo,
                margen_aprobado = EXCLUDED.margen_aprobado,
                status = EXCLUDED.status,
                usuario = EXCLUDED.usuario,
                updated_at = NOW();
        """), {
            "pid": pid,
            "sku": sku,
            "p_aprobado": p_aprobado,
            "m_modo": m_modo,
            "m_aprobado": m_aprobado,
            "status": status,
            "usuario": usuario,
        })
    await db.commit()
    return {"status": "ok", "saved_count": len(items)}


async def reset_audit_decisions(db: AsyncSession) -> dict:
    await db.execute(text("TRUNCATE TABLE price_audit_decisions;"))
    await db.commit()
    return {"status": "ok", "message": "Auditoría reiniciada correctamente en el servidor."}


async def apply_audit_decisions(db: AsyncSession, company_id: str, usuario_nombre: str = "Auditoría Estratégica Precios") -> dict:
    from uuid import uuid4
    from datetime import datetime, timezone
    from decimal import Decimal

    q = await db.execute(text("""
        SELECT 
            d.product_id, d.sku, d.precio_aprobado, d.status,
            p.nombre as product_nombre, p.codigo_barra as product_barcode,
            p.precio_venta as precio_actual,
            c.nombre as categoria_nombre
        FROM price_audit_decisions d
        JOIN products p ON p.id = d.product_id
        LEFT JOIN product_categories c ON c.id = p.categoria_id
        WHERE d.status IN ('MODIFIED', 'ACCEPTED')
          AND d.precio_aprobado > 0
          AND d.precio_aprobado != p.precio_venta;
    """))
    rows = q.mappings().all()

    if not rows:
        return {
            "status": "ok",
            "message": "No hay cambios de precios pendientes para aplicar.",
            "updated_products": 0,
            "updated_tiers": 0,
            "logs_created": 0,
        }

    now_utc = datetime.now(timezone.utc)
    updated_products = 0
    updated_tiers = 0
    logs_created = 0

    def redondear_pyg(val):
        if val is None or val <= 0:
            return 0
        val_int = int(round(val))
        resto = val_int % 50
        return val_int + (50 - resto) if resto >= 25 else val_int - resto

    pids = [r["product_id"] for r in rows]
    q_tiers = await db.execute(text("""
        SELECT id, product_id, min_qty, precio_unitario
        FROM sp_tiered_prices
        WHERE product_id = ANY(:pids) AND activo = true;
    """), {"pids": pids})
    tiers_by_pid = {}
    for t in q_tiers.mappings().all():
        pid_str = str(t["product_id"])
        if pid_str not in tiers_by_pid:
            tiers_by_pid[pid_str] = []
        tiers_by_pid[pid_str].append(t)

    for r in rows:
        pid = r["product_id"]
        p_act = float(r["precio_actual"] or 0)
        p_new = float(r["precio_aprobado"])
        factor = p_new / p_act if p_act > 0 else 1.0

        diff_monto = p_new - p_act
        diff_pct = round(((p_new - p_act) / p_act * 100), 2) if p_act > 0 else 0

        # 1. Update product
        await db.execute(text("""
            UPDATE products
            SET precio_venta = :p_new,
                updated_at = :now
            WHERE id = :pid;
        """), {"p_new": p_new, "now": now_utc, "pid": pid})
        updated_products += 1

        # 2. Log minorista
        log_id = str(uuid4())
        await db.execute(text("""
            INSERT INTO price_variation_logs (
                id, company_id, product_id, product_nombre, product_sku, product_barcode,
                categoria_nombre, tipo, precio_anterior, precio_nuevo, diferencia_monto,
                diferencia_pct, origen, usuario_id, usuario_nombre, motivo, created_at,
                precio_minorista_anterior, precio_minorista_nuevo, precio_escala_anterior, precio_escala_nuevo
            ) VALUES (
                :id, :company_id, :product_id, :nom, :sku, :bar,
                :cat, 'unitario', :p_ant, :p_nue, :diff_m,
                :diff_pct, 'auditoria_rentabilidad', NULL, :usr, 'Ajuste de margen aprobado en auditoría interactiva', :created_at,
                :p_ant, :p_nue, 0, 0
            );
        """), {
            "id": log_id,
            "company_id": company_id,
            "product_id": pid,
            "nom": (r["product_nombre"] or "")[:255],
            "sku": (r["product_sku"] or "")[:100],
            "bar": (r["product_barcode"] or "")[:100],
            "cat": (r["categoria_nombre"] or "")[:150] if r["categoria_nombre"] else None,
            "p_ant": Decimal(str(int(round(p_act)))),
            "p_nue": Decimal(str(int(round(p_new)))),
            "diff_m": Decimal(str(int(round(diff_monto)))),
            "diff_pct": Decimal(str(diff_pct)),
            "usr": usuario_nombre[:150],
            "created_at": now_utc,
        })
        logs_created += 1

        # 3. Tiers
        active_tiers = tiers_by_pid.get(str(pid), [])
        for t in active_tiers:
            tid = t["id"]
            min_q = t["min_qty"]
            t_ant = float(t["precio_unitario"] or 0)
            t_nue = redondear_pyg(t_ant * factor)
            if t_nue != t_ant:
                await db.execute(text("""
                    UPDATE sp_tiered_prices
                    SET precio_unitario = :p_tier,
                        updated_at = :now
                    WHERE id = :tid;
                """), {"p_tier": t_nue, "now": now_utc, "tid": tid})
                updated_tiers += 1

                t_diff_m = t_nue - t_ant
                t_diff_pct = round(((t_nue - t_ant) / t_ant * 100), 2) if t_ant > 0 else 0
                tier_log_id = str(uuid4())
                await db.execute(text("""
                    INSERT INTO price_variation_logs (
                        id, company_id, product_id, product_nombre, product_sku, product_barcode,
                        categoria_nombre, tipo, escala_min_qty, precio_anterior, precio_nuevo, diferencia_monto,
                        diferencia_pct, origen, usuario_id, usuario_nombre, motivo, created_at,
                        precio_minorista_anterior, precio_minorista_nuevo, precio_escala_anterior, precio_escala_nuevo
                    ) VALUES (
                        :id, :company_id, :product_id, :nom, :sku, :bar,
                        :cat, 'escala', :min_qty, :p_ant, :p_nue, :diff_m,
                        :diff_pct, 'auditoria_rentabilidad', NULL, :usr,
                        :motivo, :created_at,
                        :p_min_ant, :p_min_nue, :p_ant, :p_nue
                    );
                """), {
                    "id": tier_log_id,
                    "company_id": company_id,
                    "product_id": pid,
                    "nom": (r["product_nombre"] or "")[:255],
                    "sku": (r["product_sku"] or "")[:100],
                    "bar": (r["product_barcode"] or "")[:100],
                    "cat": (r["categoria_nombre"] or "")[:150] if r["categoria_nombre"] else None,
                    "min_qty": min_q,
                    "p_ant": Decimal(str(int(round(t_ant)))),
                    "p_nue": Decimal(str(int(round(t_nue)))),
                    "diff_m": Decimal(str(int(round(t_diff_m)))),
                    "diff_pct": Decimal(str(t_diff_pct)),
                    "usr": usuario_nombre[:150],
                    "motivo": f"Ajuste de margen aprobado en auditoría interactiva (Escala {min_q}u)",
                    "created_at": now_utc,
                    "p_min_ant": Decimal(str(int(round(p_act)))),
                    "p_min_nue": Decimal(str(int(round(p_new)))),
                })
                logs_created += 1

    await db.commit()
    return {
        "status": "ok",
        "message": "Cambios de precios aplicados exitosamente en producción.",
        "updated_products": updated_products,
        "updated_tiers": updated_tiers,
        "logs_created": logs_created,
        "timestamp": now_utc.isoformat(),
    }



