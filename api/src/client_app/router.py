"""B2B Client App — Marketplace endpoints for mobile app."""

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.features import require_feature
from api.src.client_app.auth import require_client
from api.src.client_app import service
from api.src.client_app import loyalty

router = APIRouter(
    prefix="/api/v1/client-app",
    tags=["client-app"],
    dependencies=[Depends(require_feature("client_app"))],
)


# ── Auth ────────────────────────────────────────────────────────────

@router.post("/auth/register")
async def register(data: dict, db: AsyncSession = Depends(get_db)):
    try:
        user = await service.register_client(db, data)
        _, token = await service.login_client(db, user.email, data["password"])
        return {"access_token": token, "token_type": "bearer_client"}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/auth/login")
async def login(data: dict, db: AsyncSession = Depends(get_db)):
    try:
        _, token = await service.login_client(db, data["email"], data["password"])
        return {"access_token": token, "token_type": "bearer_client"}
    except ValueError as e:
        raise HTTPException(401, str(e))


@router.post("/auth/device")
async def register_device(
    data: dict,
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    from api.src.client_app.models import ClientDevice
    dv = ClientDevice(
        client_user_id=UUID(client["client_user_id"]),
        push_token=data.get("push_token"),
        platform=data.get("platform"),
    )
    db.add(dv)
    await db.commit()
    return {"ok": True}


# ── Catalog ─────────────────────────────────────────────────────────

@router.get("/categories")
async def list_categories(
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    return await service.list_categories(db, client["company_id"])


@router.get("/products")
async def list_products(
    search: str = Query(""),
    category_id: str = Query(""),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    return await service.list_products(db, client["company_id"], client["customer_id"], search, category_id, limit, offset)


# ── Cart ────────────────────────────────────────────────────────────

@router.get("/cart")
async def get_cart(
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    cart = await service.get_or_create_cart(db, client["client_user_id"], client["company_id"])
    return service.cart_to_response(cart)


@router.post("/cart/items")
async def add_cart_item(
    data: dict,
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    cart = await service.add_cart_item(db, client["client_user_id"], client["company_id"], data)
    return service.cart_to_response(cart)


@router.patch("/cart/items/{item_id}")
async def update_cart_item(
    item_id: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    item = await service.update_cart_item(db, item_id, Decimal(str(data["cantidad"])))
    return {"id": str(item.id), "cantidad": float(item.cantidad), "subtotal": float(item.cantidad) * float(item.precio_unitario)}


@router.delete("/cart/items/{item_id}", status_code=204)
async def remove_cart_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    await service.remove_cart_item(db, item_id)


# ── Orders ──────────────────────────────────────────────────────────

@router.post("/checkout")
async def checkout(
    data: dict,
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    try:
        order = await service.checkout(db, client["client_user_id"], client["company_id"], data)
        return service.order_to_response(order)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/orders")
async def list_orders(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    orders = await service.list_orders(db, client["client_user_id"], limit, offset)
    return [service.order_to_response(o) for o in orders]


@router.get("/orders/{order_id}")
async def get_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    order = await service.get_order(db, order_id, client["client_user_id"])
    if not order:
        raise HTTPException(404, "Orden no encontrada")
    return service.order_to_response(order)


@router.get("/orders/{order_id}/tracking")
async def get_tracking(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    tracking = await service.get_order_tracking(db, order_id, client["client_user_id"])
    if not tracking:
        raise HTTPException(404, "Sin información de tracking")
    return tracking


@router.post("/orders/{order_id}/repeat")
async def repeat_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    try:
        cart = await service.repeat_order(db, order_id, client["client_user_id"], client["company_id"])
        return service.cart_to_response(cart)
    except ValueError as e:
        raise HTTPException(400, str(e))


# ── Favorites ───────────────────────────────────────────────────────

@router.get("/favorites")
async def list_favorites(
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    return await service.list_favorites(db, client["client_user_id"])


@router.post("/favorites/{product_id}", status_code=201)
async def add_favorite(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    await service.add_favorite(db, client["client_user_id"], product_id)
    return {"ok": True}


@router.delete("/favorites/{product_id}", status_code=204)
async def remove_favorite(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    await service.remove_favorite(db, client["client_user_id"], product_id)


# ── Addresses ───────────────────────────────────────────────────────

@router.get("/addresses")
async def list_addresses(
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    addrs = await service.list_addresses(db, client["client_user_id"])
    return [
        {
            "id": str(a.id), "nombre": a.nombre, "direccion": a.direccion,
            "ciudad": a.ciudad, "latitud": float(a.latitud) if a.latitud else None,
            "longitud": float(a.longitud) if a.longitud else None,
            "es_default": a.es_default, "created_at": a.created_at,
        }
        for a in addrs
    ]


@router.post("/addresses", status_code=201)
async def create_address(
    data: dict,
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    addr = await service.create_address(db, client["client_user_id"], data)
    return {
        "id": str(addr.id), "nombre": addr.nombre, "direccion": addr.direccion,
        "ciudad": addr.ciudad, "latitud": float(addr.latitud) if addr.latitud else None,
        "longitud": float(addr.longitud) if addr.longitud else None,
        "es_default": addr.es_default, "created_at": addr.created_at,
    }


@router.patch("/addresses/{addr_id}")
async def update_address(
    addr_id: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    try:
        addr = await service.update_address(db, addr_id, client["client_user_id"], data)
        return {
            "id": str(addr.id), "nombre": addr.nombre, "direccion": addr.direccion,
            "ciudad": addr.ciudad, "latitud": float(addr.latitud) if addr.latitud else None,
            "longitud": float(addr.longitud) if addr.longitud else None,
            "es_default": addr.es_default, "created_at": addr.created_at,
        }
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.delete("/addresses/{addr_id}", status_code=204)
async def delete_address(
    addr_id: str,
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    await service.delete_address(db, addr_id, client["client_user_id"])


# ── Account ─────────────────────────────────────────────────────────

@router.get("/me")
async def get_account(
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    return await service.get_account(db, client["client_user_id"], client["customer_id"])


# ── Promotions ──────────────────────────────────────────────────────

@router.get("/promotions")
async def list_promotions(
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    return await service.list_promotions(db, client["company_id"])


@router.post("/promotions/validate")
async def validate_promo(
    data: dict,
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    promo = await service.validate_promo_code(db, client["company_id"], data.get("codigo_cupon", ""))
    if not promo:
        raise HTTPException(404, "Cupón inválido o expirado")
    return promo


# ── Loyalty / Gamification ──────────────────────────────────────────

@router.get("/loyalty")
async def get_loyalty(
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    return await loyalty.get_loyalty_summary(db, client["customer_id"])


@router.get("/loyalty/rewards")
async def get_rewards():
    return loyalty.get_rewards_catalog()


@router.post("/loyalty/redeem")
async def redeem_points(
    data: dict,
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    result = await loyalty.redeem_points(
        db, client["customer_id"], client["company_id"],
        data["points"], data.get("concepto", "Canje"),
    )
    if not result["success"]:
        raise HTTPException(400, result.get("error", "Error al canjear"))
    return result


# ── Chat ────────────────────────────────────────────────────────────

@router.get("/chat/whatsapp-url")
async def get_whatsapp_url(
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    url = await service.get_whatsapp_url(db, client["customer_id"])
    return {"url": url}


# ── Payments ────────────────────────────────────────────────────────

@router.post("/payments/pagopar")
async def init_pagopar(
    data: dict,
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    try:
        return await service.init_pagopay(db, data["order_id"], client["client_user_id"], client["company_id"])
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/payments/kuapay")
async def init_kuapay(
    data: dict,
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    try:
        return await service.init_kuapay(db, data["order_id"], client["client_user_id"], client["company_id"])
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/payments/spi")
async def init_spi(
    data: dict,
    db: AsyncSession = Depends(get_db),
    client: dict = Depends(require_client),
):
    try:
        return await service.init_spi(db, data["order_id"], client["client_user_id"], client["company_id"])
    except ValueError as e:
        raise HTTPException(400, str(e))


# ── Payment Webhooks ────────────────────────────────────────────────

@router.post("/payments/pagopar/webhook")
async def pagopar_webhook(
    data: dict,
    db: AsyncSession = Depends(get_db),
):
    """Pagopar IPN callback — updates order status on payment confirmation."""
    order_id = data.get("order_id") or data.get("pedido_id")
    status = data.get("status") or data.get("estado")
    if order_id and status == "confirmed":
        await service.confirm_payment(db, order_id, "pagado")
    return {"ok": True}


@router.post("/payments/kuapay/webhook")
async def kuapay_webhook(
    data: dict,
    db: AsyncSession = Depends(get_db),
):
    order_id = data.get("order_id")
    status = data.get("status")
    if order_id and status == "confirmed":
        await service.confirm_payment(db, order_id, "pagado")
    return {"ok": True}


@router.post("/payments/spi/webhook")
async def spi_webhook(
    data: dict,
    db: AsyncSession = Depends(get_db),
):
    order_id = data.get("order_id")
    status = data.get("status")
    if order_id and status == "confirmed":
        await service.confirm_payment(db, order_id, "pagado")
    return {"ok": True}
