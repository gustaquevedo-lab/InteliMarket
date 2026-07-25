from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from api.src.db import get_db

router = APIRouter(prefix="/api/public/v1", tags=["public"])


@router.get("/health")
async def public_health():
    return {"status": "ok", "version": "0.2.0", "name": "InteliMarket API"}


@router.get("/companies/{company_id}/products")
async def public_products(
    company_id: str,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import text

    result = await db.execute(
        text(
            "SELECT id, nombre, sku, codigo_barra, iva_tasa FROM products WHERE company_id = :cid ORDER BY nombre LIMIT :lim OFFSET :off"
        ),
        {"cid": company_id, "lim": limit, "off": offset},
    )
    return [dict(r._mapping) for r in result.fetchall()]


@router.get("/companies/{company_id}/products/{product_id}/price")
async def public_product_price(
    company_id: str,
    product_id: str,
    customer_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import text

    base = await db.execute(
        text(
            "SELECT id, nombre, sku, iva_tasa FROM products WHERE id = :pid AND company_id = :cid"
        ),
        {"pid": product_id, "cid": company_id},
    )
    product = base.fetchone()
    if not product:
        raise HTTPException(404, "Producto no encontrado")

    result = {"producto": dict(product._mapping), "precios": []}

    if customer_id:
        price_list = await db.execute(
            text(
                """
                SELECT pli.precio, pl.nombre as lista
                FROM price_list_items pli
                JOIN price_lists pl ON pl.id = pli.price_list_id
                WHERE pli.product_id = :pid
                AND (pl.customer_id = :cid OR pl.customer_group_id IN (
                    SELECT customer_group_id FROM customers WHERE id = :cid
                ))
                ORDER BY pli.precio ASC LIMIT 1
            """
            ),
            {"pid": product_id, "cid": customer_id},
        )
        row = price_list.fetchone()
        if row:
            result["precios"].append(dict(row._mapping))

    return result


@router.get("/companies/{company_id}/stock")
async def public_stock(
    company_id: str,
    product_ids: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import text

    query = "SELECT s.product_id, p.nombre, p.sku, s.cantidad, w.nombre as warehouse FROM stock s JOIN products p ON p.id = s.product_id JOIN warehouses w ON w.id = s.warehouse_id WHERE s.company_id = :cid"
    params = {"cid": company_id}
    if product_ids:
        id_list = [x.strip() for x in product_ids.split(",")]
        placeholders = ", ".join([f":pid_{i}" for i in range(len(id_list))])
        query += f" AND s.product_id IN ({placeholders})"
        params.update({f"pid_{i}": pid for i, pid in enumerate(id_list)})
    result = await db.execute(text(query + " ORDER BY p.nombre"), params)
    return [dict(r._mapping) for r in result.fetchall()]
