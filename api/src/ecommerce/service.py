"""E-commerce service — catalog, cart, checkout, orders, payments, sync"""

import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import select, func, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.products.models import Product, ProductCategory
from api.src.variants.models import ProductVariant
from api.src.price_lists.models import PriceList, PriceListItem
from api.src.inventory.models import Stock
from api.src.ecommerce.models import (
    EcommerceSyncLog, EcommerceCustomer, EcommerceCart, EcommerceCartItem,
    EcommerceOrder, EcommerceOrderItem, EcommercePayment,
)
from api.src.ecommerce.auth import hash_password, verify_password, create_token


# ═══════════════════════════════════════════════════════════════
#  AUTH
# ═══════════════════════════════════════════════════════════════

async def register_customer(db: AsyncSession, data: dict) -> dict:
    existing = await db.execute(
        select(EcommerceCustomer).where(EcommerceCustomer.email == data["email"])
    )
    if existing.scalar_one_or_none():
        raise ValueError("Email ya registrado")

    customer = EcommerceCustomer(
        company_id=UUID(data.get("company_id", "")),
        customer_id=UUID(data["customer_id"]),
        email=data["email"],
        password_hash=hash_password(data["password"]),
        nombre=data["nombre"],
        telefono=data.get("telefono"),
        direccion_envio=data.get("direccion_envio"),
    )
    db.add(customer)
    await db.flush()
    await db.refresh(customer)

    token = create_token(str(customer.id), str(customer.company_id), customer.email)
    return {
        "access_token": token,
        "token_type": "bearer_ecommerce",
        "customer": {
            "id": str(customer.id),
            "email": customer.email,
            "nombre": customer.nombre,
            "telefono": customer.telefono,
        },
    }


async def login_customer(db: AsyncSession, email: str, password: str, company_id: str) -> dict:
    customer = await db.execute(
        select(EcommerceCustomer).where(
            EcommerceCustomer.email == email,
            EcommerceCustomer.company_id == UUID(company_id),
            EcommerceCustomer.activo == True,
        )
    )
    customer = customer.scalar_one_or_none()
    if not customer or not verify_password(password, customer.password_hash):
        raise ValueError("Credenciales inválidas")

    customer.last_login_at = datetime.now(timezone.utc)
    await db.flush()

    token = create_token(str(customer.id), str(customer.company_id), customer.email)
    return {
        "access_token": token,
        "token_type": "bearer_ecommerce",
        "customer": {
            "id": str(customer.id),
            "email": customer.email,
            "nombre": customer.nombre,
            "telefono": customer.telefono,
        },
    }


# ═══════════════════════════════════════════════════════════════
#  CATALOG
# ═══════════════════════════════════════════════════════════════

async def get_catalog(
    db: AsyncSession,
    company_id: str,
    search: str = "",
    category_id: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    company_uuid = UUID(company_id)
    query = select(Product).where(Product.company_id == company_uuid, Product.activo == True)

    if search:
        query = query.where(Product.nombre.ilike(f"%{search}%"))
    if category_id:
        query = query.where(Product.category_id == UUID(category_id))

    total_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(total_q)).scalar() or 0

    query = query.order_by(Product.nombre).offset((page - 1) * per_page).limit(per_page)
    products = (await db.execute(query)).scalars().all()

    # Get default price list
    price_list_result = await db.execute(
        select(PriceListItem).join(PriceList).where(
            PriceList.company_id == company_uuid,
            PriceList.activo == True,
            PriceList.es_default == True,
        )
    )
    default_prices = {}
    for pli in price_list_result.scalars().all():
        default_prices[str(pli.product_id)] = float(pli.precio)

    # Get stock
    stock_result = await db.execute(
        select(Stock.product_id, func.sum(Stock.cantidad).label("total"))
        .where(Stock.product_id.in_([p.id for p in products]))
        .group_by(Stock.product_id)
    )
    stock_map = {str(r.product_id): int(r.total) for r in stock_result.all()}

    result = []
    for p in products:
        result.append({
            "id": str(p.id),
            "sku": p.sku,
            "nombre": p.nombre,
            "descripcion": p.descripcion,
            "codigo_barra": p.codigo_barra,
            "unidad_medida": p.unidad_medida,
            "categoria_id": str(p.category_id) if p.category_id else None,
            "precio": default_prices.get(str(p.id), 0),
            "stock": stock_map.get(str(p.id), 0),
            "imagen_url": getattr(p, "imagen_url", None),
        })

    return {"products": result, "total": total, "page": page, "per_page": per_page}


async def get_product_detail(db: AsyncSession, company_id: str, product_id: str) -> dict:
    company_uuid = UUID(company_id)
    p = await db.execute(
        select(Product).where(Product.id == UUID(product_id), Product.company_id == company_uuid)
    )
    p = p.scalar_one_or_none()
    if not p:
        raise ValueError("Producto no encontrado")

    # Prices
    price_result = await db.execute(
        select(PriceListItem).join(PriceList).where(
            PriceList.company_id == company_uuid,
            PriceList.activo == True,
            PriceListItem.product_id == UUID(product_id),
        )
    )
    prices = [{"lista": pl.price_list_id, "precio": float(pl.precio), "moneda": pl.moneda}
              for pl in price_result.scalars().all()]

    # Stock
    stock_result = await db.execute(
        select(func.sum(Stock.cantidad)).where(Stock.product_id == UUID(product_id))
    )
    total_stock = stock_result.scalar() or 0

    # Variants
    v_result = await db.execute(
        select(ProductVariant).where(
            ProductVariant.product_id == UUID(product_id), ProductVariant.activo == True
        )
    )
    variants = [{"id": str(v.id), "tipo": v.tipo, "valor": v.valor, "sku": v.sku_variante,
                  "precio_extra": float(v.precio_extra) if v.precio_extra else 0}
                for v in v_result.scalars().all()]

    return {
        "id": str(p.id),
        "sku": p.sku,
        "nombre": p.nombre,
        "descripcion": p.descripcion,
        "codigo_barra": p.codigo_barra,
        "unidad_medida": p.unidad_medida,
        "iva_tasa": float(p.iva_tasa) if p.iva_tasa else None,
        "categoria_id": str(p.category_id) if p.category_id else None,
        "activo": p.activo,
        "prices": prices,
        "stock": int(total_stock),
        "variants": variants,
    }


async def get_categories(db: AsyncSession, company_id: str) -> list[dict]:
    company_uuid = UUID(company_id)
    r = await db.execute(
        select(ProductCategory).where(
            ProductCategory.company_id == company_uuid, ProductCategory.activo == True
        ).order_by(ProductCategory.nombre)
    )
    return [
        {"id": str(c.id), "nombre": c.nombre, "codigo": c.codigo, "parent_id": str(c.parent_id) if c.parent_id else None}
        for c in r.scalars().all()
    ]


# ═══════════════════════════════════════════════════════════════
#  CART
# ═══════════════════════════════════════════════════════════════

async def get_or_create_cart(db: AsyncSession, company_id: str, customer_id: str) -> EcommerceCart:
    company_uuid = UUID(company_id)
    cust_uuid = UUID(customer_id)
    r = await db.execute(
        select(EcommerceCart).where(
            EcommerceCart.company_id == company_uuid,
            EcommerceCart.customer_id == cust_uuid,
        )
    )
    cart = r.scalar_one_or_none()
    if not cart:
        cart = EcommerceCart(company_id=company_uuid, customer_id=cust_uuid)
        db.add(cart)
        await db.flush()
        await db.refresh(cart)
    return cart


async def get_cart(db: AsyncSession, company_id: str, customer_id: str) -> dict:
    cart = await get_or_create_cart(db, company_id, customer_id)
    items = []
    total = Decimal(0)
    for item in cart.items:
        subtotal = Decimal(str(item.cantidad)) * Decimal(str(item.precio_unitario))
        items.append({
            "id": str(item.id),
            "product_id": str(item.product_id),
            "product_nombre": item.product_nombre,
            "cantidad": float(item.cantidad),
            "precio_unitario": float(item.precio_unitario),
            "moneda": item.moneda,
            "subtotal": float(subtotal),
        })
        total += subtotal
    return {
        "id": str(cart.id),
        "customer_id": str(cart.customer_id),
        "moneda": cart.moneda,
        "items": items,
        "total": float(total),
    }


async def add_to_cart(db: AsyncSession, company_id: str, customer_id: str, data: dict) -> dict:
    cart = await get_or_create_cart(db, company_id, customer_id)
    product_id = UUID(data["product_id"])

    # Get product info
    p = await db.execute(select(Product).where(Product.id == product_id))
    p = p.scalar_one_or_none()
    if not p:
        raise ValueError("Producto no encontrado")

    # Get default price
    company_uuid = UUID(company_id)
    pl = await db.execute(
        select(PriceListItem).join(PriceList).where(
            PriceList.company_id == company_uuid,
            PriceList.activo == True,
            PriceList.es_default == True,
            PriceListItem.product_id == product_id,
        )
    )
    pli = pl.scalar_one_or_none()
    precio = float(pli.precio) if pli else 0

    # Check existing item
    existing = [i for i in cart.items if str(i.product_id) == data["product_id"]]
    if existing:
        existing[0].cantidad = Decimal(str(float(existing[0].cantidad) + data["cantidad"]))
        existing[0].precio_unitario = Decimal(str(precio))
    else:
        item = EcommerceCartItem(
            cart_id=cart.id,
            product_id=product_id,
            product_nombre=p.nombre,
            cantidad=Decimal(str(data["cantidad"])),
            precio_unitario=Decimal(str(precio)),
        )
        db.add(item)

    cart.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return await get_cart(db, company_id, customer_id)


async def update_cart_item(db: AsyncSession, company_id: str, customer_id: str, item_id: str, cantidad: float) -> dict:
    cart = await get_or_create_cart(db, company_id, customer_id)
    item = next((i for i in cart.items if str(i.id) == item_id), None)
    if not item:
        raise ValueError("Item no encontrado")
    item.cantidad = Decimal(str(cantidad))
    cart.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return await get_cart(db, company_id, customer_id)


async def remove_cart_item(db: AsyncSession, company_id: str, customer_id: str, item_id: str) -> dict:
    cart = await get_or_create_cart(db, company_id, customer_id)
    await db.execute(
        sa_delete(EcommerceCartItem).where(
            EcommerceCartItem.id == UUID(item_id),
            EcommerceCartItem.cart_id == cart.id,
        )
    )
    cart.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return await get_cart(db, company_id, customer_id)


# ═══════════════════════════════════════════════════════════════
#  CHECKOUT / ORDERS
# ═══════════════════════════════════════════════════════════════

async def checkout(db: AsyncSession, company_id: str, customer_id: str, data: dict) -> dict:
    company_uuid = UUID(company_id)
    cust_uuid = UUID(customer_id)

    cart = await get_or_create_cart(db, company_id, customer_id)
    if not cart.items:
        raise ValueError("Carrito vacío")

    # Build order
    subtotal = Decimal(0)
    order_items = []
    for item in cart.items:
        st = Decimal(str(item.cantidad)) * Decimal(str(item.precio_unitario))
        subtotal += st
        order_items.append({
            "product_id": item.product_id,
            "product_nombre": item.product_nombre,
            "cantidad": item.cantidad,
            "precio_unitario": item.precio_unitario,
            "subtotal": st,
            "moneda": item.moneda,
        })

    # Create order
    order_num = f"ECO-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    order = EcommerceOrder(
        company_id=company_uuid,
        customer_id=cust_uuid,
        numero=order_num,
        estado="pendiente",
        moneda=cart.moneda,
        subtotal=subtotal,
        total=subtotal,
        metodo_pago=data["metodo_pago"],
        direccion_envio=data.get("direccion_envio"),
        notas=data.get("notas"),
    )
    db.add(order)
    await db.flush()

    for oi in order_items:
        oi_model = EcommerceOrderItem(
            order_id=order.id,
            product_id=oi["product_id"],
            product_nombre=oi["product_nombre"],
            cantidad=oi["cantidad"],
            precio_unitario=oi["precio_unitario"],
            subtotal=oi["subtotal"],
            moneda=oi["moneda"],
        )
        db.add(oi_model)

    # Clear cart
    await db.execute(sa_delete(EcommerceCartItem).where(EcommerceCartItem.cart_id == cart.id))

    # Create payment record
    payment = EcommercePayment(
        company_id=company_uuid,
        order_id=order.id,
        metodo=data["metodo_pago"],
        monto=subtotal,
        moneda=cart.moneda,
    )
    db.add(payment)
    await db.flush()
    await db.refresh(order)

    pago_url = None
    if data["metodo_pago"] in ("pagopar", "kuapay"):
        pago_url = f"/tienda/pago/{order.id}?metodo={data['metodo_pago']}"

    return {
        "order_id": str(order.id),
        "numero": order.numero,
        "total": float(order.total),
        "metodo_pago": order.metodo_pago,
        "pago_url": pago_url,
    }


async def list_orders(db: AsyncSession, company_id: str, customer_id: str) -> list[dict]:
    r = await db.execute(
        select(EcommerceOrder)
        .where(
            EcommerceOrder.company_id == UUID(company_id),
            EcommerceOrder.customer_id == UUID(customer_id),
        )
        .order_by(EcommerceOrder.created_at.desc())
    )
    orders = r.scalars().all()
    result = []
    for o in orders:
        result.append({
            "id": str(o.id),
            "numero": o.numero,
            "estado": o.estado,
            "total": float(o.total),
            "moneda": o.moneda,
            "metodo_pago": o.metodo_pago,
            "pago_estado": o.pago_estado,
            "items_count": len(list(o.items)) if o.items else 0,
            "created_at": o.created_at,
        })
    return result


async def get_order_detail(db: AsyncSession, company_id: str, customer_id: str, order_id: str) -> dict:
    r = await db.execute(
        select(EcommerceOrder).where(
            EcommerceOrder.id == UUID(order_id),
            EcommerceOrder.company_id == UUID(company_id),
            EcommerceOrder.customer_id == UUID(customer_id),
        )
    )
    o = r.scalar_one_or_none()
    if not o:
        raise ValueError("Orden no encontrada")

    # Payments
    pr = await db.execute(
        select(EcommercePayment).where(EcommercePayment.order_id == o.id)
    )
    payments = [
        {"id": str(p.id), "metodo": p.metodo, "monto": float(p.monto),
         "estado": p.estado, "referencia_externa": p.referencia_externa,
         "created_at": p.created_at}
        for p in pr.scalars().all()
    ]

    return {
        "id": str(o.id),
        "numero": o.numero,
        "estado": o.estado,
        "moneda": o.moneda,
        "subtotal": float(o.subtotal),
        "descuento": float(o.descuento or 0),
        "total": float(o.total),
        "metodo_pago": o.metodo_pago,
        "pago_estado": o.pago_estado,
        "direccion_envio": o.direccion_envio,
        "notas": o.notas,
        "items": [
            {"id": str(i.id), "product_id": str(i.product_id),
             "product_nombre": i.product_nombre,
             "cantidad": float(i.cantidad), "precio_unitario": float(i.precio_unitario),
             "subtotal": float(i.subtotal)}
            for i in (o.items or [])
        ],
        "payments": payments,
        "created_at": o.created_at,
    }


async def get_dashboard(db: AsyncSession, company_id: str, customer_id: str) -> dict:
    company_uuid = UUID(company_id)
    cust_uuid = UUID(customer_id)

    total_r = await db.execute(
        select(func.count()).select_from(EcommerceOrder).where(
            EcommerceOrder.company_id == company_uuid,
            EcommerceOrder.customer_id == cust_uuid,
        )
    )
    total_orders = total_r.scalar() or 0

    pending_r = await db.execute(
        select(func.count()).select_from(EcommerceOrder).where(
            EcommerceOrder.company_id == company_uuid,
            EcommerceOrder.customer_id == cust_uuid,
            EcommerceOrder.estado.in_(["pendiente", "confirmado"]),
        )
    )
    pending_orders = pending_r.scalar() or 0

    recent = await list_orders(db, company_id, customer_id)
    recent = recent[:5]

    return {"total_orders": total_orders, "pending_orders": pending_orders, "recent_orders": recent}


# ═══════════════════════════════════════════════════════════════
#  PAYMENTS
# ═══════════════════════════════════════════════════════════════

async def confirm_payment(db: AsyncSession, order_id: str, metodo: str, referencia: str, metadata: dict = None) -> dict:
    r = await db.execute(
        select(EcommerceOrder).where(EcommerceOrder.id == UUID(order_id))
    )
    order = r.scalar_one_or_none()
    if not order:
        raise ValueError("Orden no encontrada")

    payment = EcommercePayment(
        company_id=order.company_id,
        order_id=order.id,
        metodo=metodo,
        monto=order.total,
        moneda=order.moneda,
        estado="confirmado",
        referencia_externa=referencia,
        payment_metadata=metadata,
    )
    db.add(payment)
    order.estado = "confirmado"
    order.pago_estado = "pagado"
    await db.flush()
    return {"ok": True, "order_id": str(order.id), "estado": order.estado}


# ═══════════════════════════════════════════════════════════════
#  SYNC (existing, extended with pedidos)
# ═══════════════════════════════════════════════════════════════

async def _build_catalog_payload(db: AsyncSession, company_id: str) -> dict:
    company_uuid = UUID(company_id)
    result = await db.execute(
        select(ProductCategory).where(
            ProductCategory.company_id == company_uuid, ProductCategory.activo == True,
        ).order_by(ProductCategory.nombre)
    )
    categories = result.scalars().all()
    result = await db.execute(
        select(Product).where(Product.company_id == company_uuid, Product.activo == True).order_by(Product.nombre)
    )
    products = result.scalars().all()
    product_ids = [p.id for p in products]
    variants_dict = {}
    if product_ids:
        result = await db.execute(
            select(ProductVariant).where(ProductVariant.product_id.in_(product_ids), ProductVariant.activo == True)
        )
        for v in result.scalars().all():
            variants_dict.setdefault(str(v.product_id), []).append({
                "id": str(v.id), "tipo": v.tipo, "valor": v.valor,
                "sku": v.sku_variante, "codigo_barra": v.codigo_barra,
                "precio_extra": float(v.precio_extra) if v.precio_extra else 0,
            })
    catalog = []
    for p in products:
        catalog.append({
            "id": str(p.id), "sku": p.sku, "nombre": p.nombre,
            "descripcion": p.descripcion, "codigo_barra": p.codigo_barra,
            "tipo": p.tipo, "unidad_medida": p.unidad_medida,
            "iva_tasa": float(p.iva_tasa) if p.iva_tasa else None,
            "categoria_id": str(p.category_id) if p.category_id else None,
            "activo": p.activo,
            "variants": variants_dict.get(str(p.id), []),
        })
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "company_id": company_id,
        "categories": [{"id": str(c.id), "nombre": c.nombre, "codigo": c.codigo,
                        "parent_id": str(c.parent_id) if c.parent_id else None} for c in categories],
        "products": catalog,
    }


async def sync_catalog(db: AsyncSession, company_id: str) -> EcommerceSyncLog:
    company_uuid = UUID(company_id)
    try:
        payload = await _build_catalog_payload(db, company_id)
        json_payload = json.dumps(payload, default=str, ensure_ascii=False)
        log = EcommerceSyncLog(company_id=company_uuid, tipo="catalogo", estado="procesado",
                               productos_count=len(payload["products"]), resultado=json_payload[:5000])
        db.add(log); await db.flush(); await db.refresh(log)
        return log
    except Exception as e:
        log = EcommerceSyncLog(company_id=company_uuid, tipo="catalogo", estado="error",
                               errores_count=1, resultado=str(e))
        db.add(log); await db.flush(); await db.refresh(log)
        return log


async def sync_prices(db: AsyncSession, company_id: str) -> EcommerceSyncLog:
    company_uuid = UUID(company_id)
    try:
        price_data = []
        result = await db.execute(
            select(PriceList).where(PriceList.company_id == company_uuid, PriceList.activo == True)
        )
        for pl in result.scalars().all():
            r2 = await db.execute(
                select(PriceListItem).where(PriceListItem.price_list_id == pl.id, PriceListItem.activo == True)
            )
            for item in r2.scalars().all():
                price_data.append({"lista_id": str(pl.id), "lista_nombre": pl.nombre,
                                   "product_id": str(item.product_id),
                                   "precio": float(item.precio) if item.precio else 0,
                                   "moneda": item.moneda})
        log = EcommerceSyncLog(company_id=company_uuid, tipo="precios", estado="procesado",
                               productos_count=len(price_data),
                               resultado=json.dumps(price_data, default=str, ensure_ascii=False)[:5000])
        db.add(log); await db.flush(); await db.refresh(log)
        return log
    except Exception as e:
        log = EcommerceSyncLog(company_id=company_uuid, tipo="precios", estado="error",
                               errores_count=1, resultado=str(e))
        db.add(log); await db.flush(); await db.refresh(log)
        return log


async def sync_stock(db: AsyncSession, company_id: str) -> EcommerceSyncLog:
    company_uuid = UUID(company_id)
    try:
        result = await db.execute(
            select(Stock.product_id, func.sum(Stock.cantidad).label("total")).group_by(Stock.product_id)
        )
        stock_data = [{"product_id": str(r.product_id), "stock_total": int(r.total) if r.total else 0} for r in result.all()]
        log = EcommerceSyncLog(company_id=company_uuid, tipo="stock", estado="procesado",
                               productos_count=len(stock_data),
                               resultado=json.dumps(stock_data, default=str, ensure_ascii=False)[:5000])
        db.add(log); await db.flush(); await db.refresh(log)
        return log
    except Exception as e:
        log = EcommerceSyncLog(company_id=company_uuid, tipo="stock", estado="error",
                               errores_count=1, resultado=str(e))
        db.add(log); await db.flush(); await db.refresh(log)
        return log


async def sync_orders(db: AsyncSession, company_id: str) -> EcommerceSyncLog:
    company_uuid = UUID(company_id)
    try:
        r = await db.execute(
            select(EcommerceOrder).where(EcommerceOrder.company_id == company_uuid)
        )
        orders = [
            {"id": str(o.id), "numero": o.numero, "estado": o.estado,
             "total": float(o.total), "moneda": o.moneda,
             "created_at": o.created_at.isoformat()}
            for o in r.scalars().all()
        ]
        log = EcommerceSyncLog(company_id=company_uuid, tipo="pedidos", estado="procesado",
                               productos_count=len(orders),
                               resultado=json.dumps(orders, default=str, ensure_ascii=False)[:5000])
        db.add(log); await db.flush(); await db.refresh(log)
        return log
    except Exception as e:
        log = EcommerceSyncLog(company_id=company_uuid, tipo="pedidos", estado="error",
                               errores_count=1, resultado=str(e))
        db.add(log); await db.flush(); await db.refresh(log)
        return log


async def get_sync_logs(db: AsyncSession, company_id: str, limit: int = 20) -> list[EcommerceSyncLog]:
    company_uuid = UUID(company_id)
    r = await db.execute(
        select(EcommerceSyncLog).where(EcommerceSyncLog.company_id == company_uuid)
        .order_by(EcommerceSyncLog.created_at.desc()).limit(limit)
    )
    return list(r.scalars().all())
