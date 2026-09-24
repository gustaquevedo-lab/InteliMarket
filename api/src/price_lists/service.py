"""Price list service"""

from sqlalchemy import select, text, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import uuid

from api.src.price_lists.models import PriceList, PriceListItem
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
    db: AsyncSession, company_id: str, customer_id: str, product_id: str, quantity: int = 1,
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

