"""Business logic for B2B Client App."""

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID
from typing import Optional

from sqlalchemy import select, func, and_, or_, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.src.client_app.models import (
    ClientUser, ClientDevice, ClientCart, ClientCartItem,
    ClientOrder, ClientOrderItem, ClientFavorite, ClientAddress,
    LoyaltyTransaction,
)
from api.src.client_app.auth import hash_password, verify_password, create_client_token
from api.src.products.models import Product, ProductCategory
from api.src.customers.models import Customer
from api.src.price_lists.models import PriceList, PriceListItem
from api.src.inventory.models import Stock
from api.src.intelientregas.models import Delivery


# ── Auth ────────────────────────────────────────────────────────────

async def register_client(db: AsyncSession, data: dict) -> ClientUser:
    existing = await db.execute(
        select(ClientUser).where(ClientUser.email == data["email"], ClientUser.company_id == UUID(data["company_id"]))
    )
    if existing.scalar_one_or_none():
        raise ValueError("Email ya registrado")
    user = ClientUser(
        customer_id=UUID(data["customer_id"]),
        company_id=UUID(data["company_id"]),
        email=data["email"],
        password_hash=hash_password(data["password"]),
        nombre=data["nombre"],
        telefono=data.get("telefono"),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def login_client(db: AsyncSession, email: str, password: str) -> tuple[ClientUser, str]:
    r = await db.execute(select(ClientUser).where(ClientUser.email == email, ClientUser.activo == True))
    user = r.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        raise ValueError("Email o contraseña incorrectos")
    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    token = create_client_token(str(user.id), str(user.customer_id), str(user.company_id), user.email)
    return user, token


# ── Catalog ─────────────────────────────────────────────────────────

async def list_categories(db: AsyncSession, company_id: str) -> list[dict]:
    r = await db.execute(
        select(ProductCategory.id, ProductCategory.nombre, func.count(Product.id).label("cnt"))
        .outerjoin(Product, Product.category_id == ProductCategory.id)
        .where(ProductCategory.company_id == UUID(company_id))
        .group_by(ProductCategory.id, ProductCategory.nombre)
        .order_by(ProductCategory.nombre)
    )
    return [{"id": str(row[0]), "nombre": row[1], "product_count": row[2]} for row in r.all()]


async def list_products(
    db: AsyncSession, company_id: str, customer_id: str,
    search: str = "", category_id: str = "", limit: int = 50, offset: int = 0,
) -> list[dict]:
    base_q = select(Product).where(Product.company_id == UUID(company_id), Product.activo == True)
    if search:
        base_q = base_q.where(
            or_(Product.nombre.ilike(f"%{search}%"), Product.codigo_barra.ilike(f"%{search}%"), Product.sku.ilike(f"%{search}%"))
        )
    if category_id:
        base_q = base_q.where(Product.category_id == UUID(category_id))
    base_q = base_q.order_by(Product.nombre).offset(offset).limit(limit)
    r = await db.execute(base_q)
    products = r.scalars().all()

    # Get customer's price list
    cust_r = await db.execute(select(Customer).where(Customer.id == UUID(customer_id)))
    customer = cust_r.scalar_one_or_none()
    price_map = {}
    if customer and customer.price_list_id:
        pl_r = await db.execute(
            select(PriceListItem).where(PriceListItem.price_list_id == customer.price_list_id)
        )
        for item in pl_r.scalars().all():
            price_map[str(item.product_id)] = float(item.precio)

    # Get stock
    stock_r = await db.execute(
        select(Stock.product_id, func.coalesce(func.sum(Stock.cantidad), 0))
        .where(Stock.company_id == UUID(company_id))
        .group_by(Stock.product_id)
    )
    stock_map = {str(row[0]): float(row[1]) for row in stock_r.all()}

    results = []
    for p in products:
        pid = str(p.id)
        price = price_map.get(pid, float(p.precio_venta or 0))
        cat_name = ""
        if p.category_id:
            cat_r = await db.execute(select(ProductCategory.nombre).where(ProductCategory.id == p.category_id))
            cat_row = cat_r.one_or_none()
            if cat_row:
                cat_name = cat_row[0]
        results.append({
            "id": pid,
            "sku": p.sku,
            "codigo_barra": p.codigo_barra,
            "nombre": p.nombre,
            "descripcion": p.descripcion,
            "categoria": cat_name,
            "precio": price,
            "iva_tasa": float(p.iva_tasa or 10),
            "stock_disponible": stock_map.get(pid, 0),
            "unidad_medida": p.unidad_medida,
            "activo": p.activo,
        })
    return results


# ── Cart ────────────────────────────────────────────────────────────

async def get_or_create_cart(db: AsyncSession, client_user_id: str, company_id: str) -> ClientCart:
    r = await db.execute(
        select(ClientCart)
        .where(ClientCart.client_user_id == UUID(client_user_id), ClientCart.activo == True)
        .options(selectinload(ClientCart.items))
    )
    cart = r.scalar_one_or_none()
    if not cart:
        cart = ClientCart(client_user_id=UUID(client_user_id), company_id=UUID(company_id))
        db.add(cart)
        await db.commit()
        await db.refresh(cart)
    if not cart.items:
        r = await db.execute(
            select(ClientCartItem).where(ClientCartItem.cart_id == cart.id)
        )
        cart.items = list(r.scalars().all())
    return cart


async def add_cart_item(db: AsyncSession, client_user_id: str, company_id: str, data: dict) -> ClientCart:
    cart = await get_or_create_cart(db, client_user_id, company_id)
    item = ClientCartItem(
        cart_id=cart.id,
        product_id=UUID(data["product_id"]),
        variant_id=UUID(data["variant_id"]) if data.get("variant_id") else None,
        descripcion=data.get("descripcion"),
        cantidad=Decimal(str(data["cantidad"])),
        precio_unitario=Decimal(str(data["precio_unitario"])),
        iva_tasa=Decimal(str(data.get("iva_tasa", 10))),
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    cart.items.append(item)
    return cart


async def update_cart_item(db: AsyncSession, item_id: str, cantidad: Decimal) -> ClientCartItem:
    r = await db.execute(select(ClientCartItem).where(ClientCartItem.id == UUID(item_id)))
    item = r.scalar_one_or_none()
    if not item:
        raise ValueError("Item no encontrado")
    item.cantidad = cantidad
    await db.commit()
    await db.refresh(item)
    return item


async def remove_cart_item(db: AsyncSession, item_id: str):
    r = await db.execute(select(ClientCartItem).where(ClientCartItem.id == UUID(item_id)))
    item = r.scalar_one_or_none()
    if item:
        await db.delete(item)
        await db.commit()


def _calculate_item_subtotal(item: ClientCartItem) -> float:
    return float(item.cantidad or 0) * float(item.precio_unitario or 0)


def cart_to_response(cart: ClientCart) -> dict:
    items = [_cart_item_response(i) for i in (cart.items or [])]
    return {
        "id": str(cart.id),
        "items": items,
        "total": sum(i["subtotal"] for i in items),
        "item_count": len(items),
    }


def _cart_item_response(item: ClientCartItem) -> dict:
    return {
        "id": str(item.id),
        "product_id": str(item.product_id),
        "variant_id": str(item.variant_id) if item.variant_id else None,
        "descripcion": item.descripcion,
        "cantidad": float(item.cantidad or 0),
        "precio_unitario": float(item.precio_unitario or 0),
        "iva_tasa": float(item.iva_tasa or 10),
        "subtotal": _calculate_item_subtotal(item),
    }


# ── Orders ──────────────────────────────────────────────────────────

async def checkout(db: AsyncSession, client_user_id: str, company_id: str, data: dict) -> ClientOrder:
    cart = await get_or_create_cart(db, client_user_id, company_id)
    if not cart.items:
        raise ValueError("Carrito vacío")

    r = await db.execute(select(ClientUser).where(ClientUser.id == UUID(client_user_id)))
    client_user = r.scalar_one_or_none()
    if not client_user:
        raise ValueError("Usuario no encontrado")

    subtotal = sum(Decimal(str(i.cantidad or 0)) * Decimal(str(i.precio_unitario or 0)) for i in cart.items)
    total = subtotal

    # Apply coupon if provided
    codigo_cupon = data.get("codigo_cupon", "").strip()
    descuento_adicional = Decimal("0")
    if codigo_cupon:
        promo = await validate_promo_code(db, company_id, codigo_cupon)
        if promo and promo.get("tipo") in ("porcentaje", "monto_fijo"):
            if promo["tipo"] == "porcentaje":
                descuento_adicional = total * Decimal(str(promo["valor"])) / Decimal("100")
            else:
                descuento_adicional = Decimal(str(promo["valor"]))
            if descuento_adicional > total:
                descuento_adicional = total
            total = total - descuento_adicional

    order = ClientOrder(
        client_user_id=UUID(client_user_id),
        customer_id=client_user.customer_id,
        company_id=UUID(company_id),
        estado="pendiente",
        condicion=data.get("condicion", "contado"),
        subtotal=subtotal,
        descuento_total=descuento_adicional,
        total=total,
        saldo=total,
        direccion_entrega=data.get("direccion_entrega"),
        latitud=Decimal(str(data["latitud"])) if data.get("latitud") else None,
        longitud=Decimal(str(data["longitud"])) if data.get("longitud") else None,
        observaciones=data.get("observaciones"),
    )
    db.add(order)
    await db.flush()

    for ci in cart.items:
        oi = ClientOrderItem(
            order_id=order.id,
            product_id=ci.product_id,
            variant_id=ci.variant_id,
            descripcion=ci.descripcion,
            cantidad=ci.cantidad,
            precio_unitario=ci.precio_unitario,
            iva_tasa=ci.iva_tasa,
            total=Decimal(str(ci.cantidad or 0)) * Decimal(str(ci.precio_unitario or 0)),
        )
        db.add(oi)

    # Clear cart
    for ci in cart.items:
        await db.delete(ci)
    cart.items = []
    cart.activo = False
    await db.flush()

    # Award loyalty points
    points_earned = int(float(total) // 1000)
    if points_earned > 0:
        try:
            txn = LoyaltyTransaction(
                customer_id=client_user.customer_id,
                company_id=UUID(company_id),
                order_id=order.id,
                tipo="acumulacion",
                puntos=points_earned,
                concepto="Compra",
            )
            db.add(txn)
        except Exception:
            pass

    await db.commit()
    await db.refresh(order)

    # Load items
    r = await db.execute(
        select(ClientOrderItem).where(ClientOrderItem.order_id == order.id)
    )
    order.items = list(r.scalars().all())

    # Send push notification asynchronously
    try:
        from api.src.client_app.notifications import notify_order_status
        await notify_order_status(db, client_user.id, str(order.id), order.numero, "pendiente")
    except Exception:
        pass

    return order


async def list_orders(
    db: AsyncSession, client_user_id: str, limit: int = 20, offset: int = 0
) -> list[ClientOrder]:
    r = await db.execute(
        select(ClientOrder)
        .where(ClientOrder.client_user_id == UUID(client_user_id))
        .order_by(ClientOrder.created_at.desc())
        .offset(offset).limit(limit)
        .options(selectinload(ClientOrder.items))
    )
    return list(r.scalars().all())


async def get_order(db: AsyncSession, order_id: str, client_user_id: str) -> ClientOrder | None:
    r = await db.execute(
        select(ClientOrder)
        .where(ClientOrder.id == UUID(order_id), ClientOrder.client_user_id == UUID(client_user_id))
        .options(selectinload(ClientOrder.items))
    )
    return r.scalar_one_or_none()


def order_to_response(order: ClientOrder) -> dict:
    items = []
    for i in (order.items or []):
        items.append({
            "id": str(i.id),
            "product_id": str(i.product_id),
            "descripcion": i.descripcion,
            "cantidad": float(i.cantidad or 0),
            "precio_unitario": float(i.precio_unitario or 0),
            "descuento_pct": float(i.descuento_pct or 0),
            "descuento_monto": float(i.descuento_monto or 0),
            "iva_tasa": float(i.iva_tasa or 10),
            "iva_monto": float(i.iva_monto or 0),
            "total": float(i.total or 0),
        })
    return {
        "id": str(order.id),
        "numero": order.numero,
        "estado": order.estado,
        "subtotal": float(order.subtotal or 0),
        "descuento_total": float(order.descuento_total or 0),
        "total": float(order.total or 0),
        "saldo": float(order.saldo or 0),
        "direccion_entrega": order.direccion_entrega,
        "observaciones": order.observaciones,
        "delivery_id": str(order.delivery_id) if order.delivery_id else None,
        "items": items,
        "created_at": order.created_at,
    }


async def get_order_tracking(db: AsyncSession, order_id: str, client_user_id: str) -> dict | None:
    r = await db.execute(
        select(ClientOrder).where(ClientOrder.id == UUID(order_id), ClientOrder.client_user_id == UUID(client_user_id))
    )
    order = r.scalar_one_or_none()
    if not order or not order.delivery_id:
        return None
    dr = await db.execute(select(Delivery).where(Delivery.id == order.delivery_id))
    delivery = dr.scalar_one_or_none()
    if not delivery:
        return None
    return {
        "delivery_id": str(delivery.id),
        "estado": delivery.estado,
        "driver_nombre": delivery.driver_nombre if hasattr(delivery, "driver_nombre") else None,
        "latitud": float(delivery.latitud) if delivery.latitud else None,
        "longitud": float(delivery.longitud) if delivery.longitud else None,
        "direccion": delivery.direccion,
    }


async def repeat_order(db: AsyncSession, order_id: str, client_user_id: str, company_id: str) -> ClientCart:
    original = await get_order(db, order_id, client_user_id)
    if not original:
        raise ValueError("Orden no encontrada")
    cart = await get_or_create_cart(db, client_user_id, company_id)
    # Remove existing inactive cart items
    for item in (original.items or []):
        ci = ClientCartItem(
            cart_id=cart.id,
            product_id=item.product_id,
            variant_id=item.variant_id,
            descripcion=item.descripcion,
            cantidad=item.cantidad,
            precio_unitario=item.precio_unitario,
            iva_tasa=item.iva_tasa,
        )
        db.add(ci)
    await db.commit()
    r = await db.execute(select(ClientCartItem).where(ClientCartItem.cart_id == cart.id))
    cart.items = list(r.scalars().all())
    return cart


# ── Favorites ───────────────────────────────────────────────────────

async def list_favorites(db: AsyncSession, client_user_id: str) -> list[dict]:
    r = await db.execute(
        select(ClientFavorite.product_id, ClientFavorite.created_at)
        .where(ClientFavorite.client_user_id == UUID(client_user_id))
        .order_by(ClientFavorite.created_at.desc())
    )
    return [{"product_id": str(row[0]), "created_at": row[1]} for row in r.all()]


async def add_favorite(db: AsyncSession, client_user_id: str, product_id: str):
    existing = await db.execute(
        select(ClientFavorite).where(
            ClientFavorite.client_user_id == UUID(client_user_id),
            ClientFavorite.product_id == UUID(product_id),
        )
    )
    if existing.scalar_one_or_none():
        return
    fav = ClientFavorite(client_user_id=UUID(client_user_id), product_id=UUID(product_id))
    db.add(fav)
    await db.commit()


async def remove_favorite(db: AsyncSession, client_user_id: str, product_id: str):
    r = await db.execute(
        select(ClientFavorite).where(
            ClientFavorite.client_user_id == UUID(client_user_id),
            ClientFavorite.product_id == UUID(product_id),
        )
    )
    fav = r.scalar_one_or_none()
    if fav:
        await db.delete(fav)
        await db.commit()


# ── Addresses ───────────────────────────────────────────────────────

async def list_addresses(db: AsyncSession, client_user_id: str) -> list[ClientAddress]:
    r = await db.execute(
        select(ClientAddress)
        .where(ClientAddress.client_user_id == UUID(client_user_id))
        .order_by(ClientAddress.created_at.desc())
    )
    return list(r.scalars().all())


async def create_address(db: AsyncSession, client_user_id: str, data: dict) -> ClientAddress:
    if data.get("es_default"):
        await db.execute(
            text("UPDATE client_addresses SET es_default = FALSE WHERE client_user_id = :uid"),
            {"uid": client_user_id},
        )
    addr = ClientAddress(client_user_id=UUID(client_user_id), **data)
    db.add(addr)
    await db.commit()
    await db.refresh(addr)
    return addr


async def update_address(db: AsyncSession, addr_id: str, client_user_id: str, data: dict) -> ClientAddress:
    r = await db.execute(
        select(ClientAddress).where(ClientAddress.id == UUID(addr_id), ClientAddress.client_user_id == UUID(client_user_id))
    )
    addr = r.scalar_one_or_none()
    if not addr:
        raise ValueError("Dirección no encontrada")
    if data.get("es_default"):
        await db.execute(
            text("UPDATE client_addresses SET es_default = FALSE WHERE client_user_id = :uid"),
            {"uid": client_user_id},
        )
    for k, v in data.items():
        setattr(addr, k, v)
    await db.commit()
    await db.refresh(addr)
    return addr


async def delete_address(db: AsyncSession, addr_id: str, client_user_id: str):
    r = await db.execute(
        select(ClientAddress).where(ClientAddress.id == UUID(addr_id), ClientAddress.client_user_id == UUID(client_user_id))
    )
    addr = r.scalar_one_or_none()
    if addr:
        await db.delete(addr)
        await db.commit()


# ── Account ─────────────────────────────────────────────────────────

async def get_account(db: AsyncSession, client_user_id: str, customer_id: str) -> dict:
    r = await db.execute(
        select(ClientUser).where(ClientUser.id == UUID(client_user_id))
    )
    user = r.scalar_one_or_none()
    r = await db.execute(select(Customer).where(Customer.id == UUID(customer_id)))
    customer = r.scalar_one_or_none()

    # Loyalty from loyalty_transactions
    loyalty_points = 0
    try:
        r = await db.execute(
            select(LoyaltyTransaction.puntos, LoyaltyTransaction.tipo)
            .where(LoyaltyTransaction.customer_id == UUID(customer_id))
        )
        for row in r.all():
            if row.tipo == "acumulacion":
                loyalty_points += row.puntos
            else:
                loyalty_points -= row.puntos
    except Exception:
        pass

    credito_limite = float(customer.credito_limite or 0) if customer else 0
    credito_usado = float(customer.credito_usado or 0) if customer else 0
    return {
        "id": str(user.id) if user else "",
        "nombre": user.nombre if user else "",
        "email": user.email if user else "",
        "telefono": user.telefono if user else None,
        "credito_limite": credito_limite,
        "credito_disponible": credito_limite - credito_usado,
        "saldo_actual": credito_usado,
        "loyalty_points": max(0, loyalty_points),
    }


# ── Promotions ──────────────────────────────────────────────────────

async def list_promotions(db: AsyncSession, company_id: str) -> list[dict]:
    from api.src.promotions.service import list_promotions as get_promos
    from api.src.promotions.schemas import PromotionResponse
    promos = await get_promos(db, company_id, activo=True)
    return [
        {
            "id": str(p.id),
            "nombre": p.nombre,
            "descripcion": p.descripcion,
            "tipo": p.tipo,
            "valor": float(p.valor or 0),
            "codigo_cupon": p.codigo_cupon,
            "requiere_cupon": p.requiere_cupon or False,
            "valido_hasta": p.valido_hasta,
        }
        for p in promos
    ]


async def validate_promo_code(
    db: AsyncSession, company_id: str, codigo_cupon: str,
) -> dict | None:
    from api.src.promotions.models import Promotion
    r = await db.execute(
        select(Promotion).where(
            Promotion.company_id == UUID(company_id),
            Promotion.activo == True,
            Promotion.codigo_cupon.ilike(codigo_cupon),
        )
    )
    promo = r.scalar_one_or_none()
    if not promo:
        return None
    return {
        "id": str(promo.id),
        "nombre": promo.nombre,
        "descripcion": promo.descripcion,
        "tipo": promo.tipo,
        "valor": float(promo.valor or 0),
    }


# ── Chat ─────────────────────────────────────────────────────────────

async def get_whatsapp_url(db: AsyncSession, customer_id: str, tenant_slug: str | None = None) -> str:
    """Get WhatsApp deep link for customer's assigned seller."""
    from api.src.customers.models import Customer
    from api.src.users.models import User
    r = await db.execute(
        select(Customer).where(Customer.id == UUID(customer_id))
    )
    customer = r.scalar_one_or_none()
    phone = "595981000000"  # fallback
    message = "Hola! Quiero hacer un pedido"
    if customer and customer.vendedor_id:
        vr = await db.execute(select(User).where(User.id == customer.vendedor_id))
        seller = vr.scalar_one_or_none()
        if seller and seller.telefono:
            phone = seller.telefono.replace("+", "").replace(" ", "").replace("-", "")
    return f"https://wa.me/{phone}?text={message.replace(' ', '%20')}"


# ── Payments ─────────────────────────────────────────────────────────

async def init_pagopay(db: AsyncSession, order_id: str, client_user_id: str, company_id: str) -> dict:
    from api.src.pagopar.service import create_checkout_session
    order = await get_order(db, order_id, client_user_id)
    if not order:
        raise ValueError("Orden no encontrada")
    r = await db.execute(select(ClientUser).where(ClientUser.id == UUID(client_user_id)))
    user = r.scalar_one_or_none()
    result = await create_checkout_session(
        db, UUID(company_id), float(order["total"]),
        order["id"], user.email, user.nombre, "PYG",
    )
    if result.get("checkout_url"):
        order_obj = await db.execute(select(ClientOrder).where(ClientOrder.id == UUID(order_id)))
        order_obj = order_obj.scalar_one_or_none()
        if order_obj:
            order_obj.estado = "en_pago"
            await db.commit()
    return {"checkout_url": result.get("checkout_url"), "transaction_id": str(result.get("transaction_id", ""))}


async def init_kuapay(db: AsyncSession, order_id: str, client_user_id: str, company_id: str) -> dict:
    from api.src.kuapay.service import create_kuapay_checkout
    order = await get_order(db, order_id, client_user_id)
    if not order:
        raise ValueError("Orden no encontrada")
    r = await db.execute(select(ClientUser).where(ClientUser.id == UUID(client_user_id)))
    user = r.scalar_one_or_none()
    result = await create_kuapay_checkout(
        db, UUID(company_id), float(order["total"]),
        order["id"], user.email, user.nombre,
    )
    return {"checkout_url": result.get("checkout_url"), "qr_image": result.get("qr_image")}


async def init_spi(db: AsyncSession, order_id: str, client_user_id: str, company_id: str) -> dict:
    from api.src.spi.service import create_spi_qr
    order = await get_order(db, order_id, client_user_id)
    if not order:
        raise ValueError("Orden no encontrada")
    result = await create_spi_qr(UUID(company_id), float(order["total"]), order["id"])
    return {"qr_data": result.get("qr_data"), "qr_image": result.get("qr_image_base64")}


async def confirm_payment(db: AsyncSession, order_id: str, new_status: str = "pagado"):
    """Update order status on payment confirmation and send push notification."""
    r = await db.execute(select(ClientOrder).where(ClientOrder.id == UUID(order_id)))
    order = r.scalar_one_or_none()
    if not order:
        raise ValueError("Orden no encontrada")
    order.estado = new_status
    await db.commit()
    try:
        from api.src.client_app.notifications import notify_order_status
        await notify_order_status(db, order.client_user_id, order_id, order.numero, new_status)
    except Exception:
        pass
