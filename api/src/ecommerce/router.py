"""E-commerce router — auth, catalog, cart, checkout, orders, payments, sync"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features import require_feature
from api.src.ecommerce import service
from api.src.ecommerce.auth import require_ecommerce_customer, get_ecommerce_customer_by_id, get_ecommerce_customer_by_email

router = APIRouter(
    prefix="/api/v1/ecommerce",
    tags=["ecommerce"],
    dependencies=[Depends(require_feature("ecommerce_web"))],
)


# ═══════════════════════════════════════════════════════════════════
#  AUTH
# ═══════════════════════════════════════════════════════════════════

@router.post("/auth/register")
async def register(
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    try:
        data["company_id"] = user["company_id"]
        return await service.register_customer(db, data)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/auth/login")
async def login(
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    try:
        return await service.login_customer(db, data["email"], data["password"], user["company_id"])
    except ValueError as e:
        raise HTTPException(401, str(e))


@router.get("/auth/me")
async def me(
    customer: dict = Depends(require_ecommerce_customer),
    db: AsyncSession = Depends(get_db),
):
    c = await get_ecommerce_customer_by_id(db, customer["id"])
    if not c:
        raise HTTPException(404, "Customer not found")
    return {"id": str(c.id), "email": c.email, "nombre": c.nombre,
            "telefono": c.telefono, "direccion_envio": c.direccion_envio,
            "activo": c.activo, "created_at": c.created_at}


# ═══════════════════════════════════════════════════════════════════
#  CATALOG (public)
# ═══════════════════════════════════════════════════════════════════

@router.get("/catalog")
async def get_catalog(
    search: str = Query(""),
    category_id: str = Query(""),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    return await service.get_catalog(db, user["company_id"], search, category_id or None, page, per_page)


@router.get("/catalog/{product_id}")
async def get_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    try:
        return await service.get_product_detail(db, user["company_id"], product_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.get("/categories")
async def list_categories(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    return await service.get_categories(db, user["company_id"])


# ═══════════════════════════════════════════════════════════════════
#  CART
# ═══════════════════════════════════════════════════════════════════

@router.get("/cart")
async def get_cart(
    customer: dict = Depends(require_ecommerce_customer),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_cart(db, customer["company_id"], customer["id"])


@router.post("/cart/items")
async def add_cart_item(
    data: dict = Body(...),
    customer: dict = Depends(require_ecommerce_customer),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await service.add_to_cart(db, customer["company_id"], customer["id"], data)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.put("/cart/items/{item_id}")
async def update_cart_item(
    item_id: str,
    data: dict = Body(...),
    customer: dict = Depends(require_ecommerce_customer),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await service.update_cart_item(db, customer["company_id"], customer["id"], item_id, data["cantidad"])
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.delete("/cart/items/{item_id}")
async def delete_cart_item(
    item_id: str,
    customer: dict = Depends(require_ecommerce_customer),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await service.remove_cart_item(db, customer["company_id"], customer["id"], item_id)
    except ValueError as e:
        raise HTTPException(400, str(e))


# ═══════════════════════════════════════════════════════════════════
#  CHECKOUT / ORDERS
# ═══════════════════════════════════════════════════════════════════

@router.post("/checkout")
async def create_checkout(
    data: dict = Body(...),
    customer: dict = Depends(require_ecommerce_customer),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await service.checkout(db, customer["company_id"], customer["id"], data)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/orders")
async def list_orders(
    customer: dict = Depends(require_ecommerce_customer),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_orders(db, customer["company_id"], customer["id"])


@router.get("/orders/{order_id}")
async def get_order(
    order_id: str,
    customer: dict = Depends(require_ecommerce_customer),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await service.get_order_detail(db, customer["company_id"], customer["id"], order_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.get("/dashboard")
async def get_dashboard(
    customer: dict = Depends(require_ecommerce_customer),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_dashboard(db, customer["company_id"], customer["id"])


# ═══════════════════════════════════════════════════════════════════
#  PAYMENTS (webhooks / confirmation)
# ═══════════════════════════════════════════════════════════════════

@router.post("/payments/{order_id}/confirm")
async def confirm_payment_webhook(
    order_id: str,
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    try:
        return await service.confirm_payment(db, order_id, data.get("metodo", "transferencia"),
                                              data.get("referencia", ""), data.get("metadata"))
    except ValueError as e:
        raise HTTPException(404, str(e))


# ═══════════════════════════════════════════════════════════════════
#  SYNC (internal)
# ═══════════════════════════════════════════════════════════════════

@router.post("/sync/{tipo}")
async def trigger_sync(
    tipo: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    if tipo not in ("catalogo", "precios", "stock", "pedidos"):
        raise HTTPException(400, f"Tipo invalido: {tipo}")
    sync_map = {"catalogo": service.sync_catalog, "precios": service.sync_prices,
                "stock": service.sync_stock, "pedidos": service.sync_orders}
    log = await sync_map[tipo](db, user["company_id"])
    return {"sync_id": str(log.id), "tipo": log.tipo, "productos_procesados": log.productos_count, "errores": []}


@router.get("/sync-logs")
async def list_sync_logs(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_auth),
):
    return await service.get_sync_logs(db, user["company_id"], limit)
