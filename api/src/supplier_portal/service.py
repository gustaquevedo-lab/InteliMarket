"""Business logic for Supplier Portal."""
from datetime import datetime, date, timezone
from decimal import Decimal
from uuid import UUID
from typing import Optional

from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.src.supplier_portal.models import SupplierUser, SupplierDocument
from api.src.supplier_portal.auth import hash_password, verify_password, create_supplier_token
from api.src.purchases.models import PurchaseOrder, PurchaseOrderItem, Supplier
from api.src.products.models import Product
from api.src.financial.models import SupplierInvoice, SupplierInvoicePayment


# ── Auth ────────────────────────────────────────────────────────────

async def register_supplier_user(db: AsyncSession, data: dict) -> SupplierUser:
    existing = await db.execute(
        select(SupplierUser).where(
            SupplierUser.email == data["email"],
            SupplierUser.company_id == UUID(data["company_id"]),
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError("Email ya registrado")
    user = SupplierUser(
        supplier_id=UUID(data["supplier_id"]),
        company_id=UUID(data["company_id"]),
        email=data["email"],
        password_hash=hash_password(data["password"]),
        nombre=data["nombre"],
        telefono=data.get("telefono"),
        cargo=data.get("cargo"),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def login_supplier(db: AsyncSession, email: str, password: str) -> tuple[SupplierUser, str]:
    r = await db.execute(
        select(SupplierUser).where(SupplierUser.email == email, SupplierUser.activo == True)
    )
    user = r.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        raise ValueError("Email o contraseña incorrectos")
    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    token = create_supplier_token(str(user.id), str(user.supplier_id), str(user.company_id), user.email)
    return user, token


async def get_profile(db: AsyncSession, supplier_user_id: str) -> SupplierUser:
    r = await db.execute(select(SupplierUser).where(SupplierUser.id == UUID(supplier_user_id)))
    return r.scalar_one_or_none()


# ── Dashboard ───────────────────────────────────────────────────────

async def get_dashboard(db: AsyncSession, supplier_id: str, company_id: str) -> dict:
    # Count orders by status
    r = await db.execute(
        select(PurchaseOrder.estado, func.count(PurchaseOrder.id))
        .where(
            PurchaseOrder.supplier_id == UUID(supplier_id),
            PurchaseOrder.company_id == UUID(company_id),
        )
        .group_by(PurchaseOrder.estado)
    )
    order_counts = {row[0]: row[1] for row in r.all()}

    # Pending confirmations
    r = await db.execute(
        select(func.count(PurchaseOrder.id))
        .where(
            PurchaseOrder.supplier_id == UUID(supplier_id),
            PurchaseOrder.company_id == UUID(company_id),
            PurchaseOrder.estado == "enviada",
        )
    )
    pending_confirm = r.scalar() or 0

    # Total orders this month
    now = datetime.now(timezone.utc)
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    r = await db.execute(
        select(func.count(PurchaseOrder.id))
        .where(
            PurchaseOrder.supplier_id == UUID(supplier_id),
            PurchaseOrder.company_id == UUID(company_id),
            PurchaseOrder.created_at >= first_of_month,
        )
    )
    monthly_orders = r.scalar() or 0

    # Recent orders
    r = await db.execute(
        select(PurchaseOrder)
        .where(
            PurchaseOrder.supplier_id == UUID(supplier_id),
            PurchaseOrder.company_id == UUID(company_id),
        )
        .order_by(PurchaseOrder.created_at.desc())
        .limit(5)
        .options(selectinload(PurchaseOrder.items))
    )
    recent_orders = list(r.scalars().all())

    # Documents count
    r = await db.execute(
        select(func.count(SupplierDocument.id))
        .where(
            SupplierDocument.supplier_id == UUID(supplier_id),
            SupplierDocument.company_id == UUID(company_id),
        )
    )
    doc_count = r.scalar() or 0

    return {
        "order_counts": order_counts,
        "pending_confirmations": pending_confirm,
        "monthly_orders": monthly_orders,
        "document_count": doc_count,
        "recent_orders": [_order_summary(o) for o in recent_orders],
    }


# ── Purchase Orders ─────────────────────────────────────────────────

async def list_orders(
    db: AsyncSession, supplier_id: str, company_id: str,
    estado: str = "", limit: int = 20, offset: int = 0,
) -> list[PurchaseOrder]:
    q = (
        select(PurchaseOrder)
        .where(
            PurchaseOrder.supplier_id == UUID(supplier_id),
            PurchaseOrder.company_id == UUID(company_id),
        )
        .order_by(PurchaseOrder.created_at.desc())
        .offset(offset).limit(limit)
        .options(selectinload(PurchaseOrder.items))
    )
    if estado:
        q = q.where(PurchaseOrder.estado == estado)
    r = await db.execute(q)
    return list(r.scalars().all())


async def get_order(db: AsyncSession, order_id: str, supplier_id: str) -> Optional[PurchaseOrder]:
    r = await db.execute(
        select(PurchaseOrder)
        .where(PurchaseOrder.id == UUID(order_id), PurchaseOrder.supplier_id == UUID(supplier_id))
        .options(selectinload(PurchaseOrder.items))
    )
    return r.scalar_one_or_none()


async def confirm_order(
    db: AsyncSession, order_id: str, supplier_id: str,
    fecha_despacho: Optional[str] = None, observaciones: Optional[str] = None,
) -> PurchaseOrder:
    r = await db.execute(
        select(PurchaseOrder).where(
            PurchaseOrder.id == UUID(order_id),
            PurchaseOrder.supplier_id == UUID(supplier_id),
            PurchaseOrder.estado == "enviada",
        )
    )
    order = r.scalar_one_or_none()
    if not order:
        raise ValueError("Orden no encontrada o no está pendiente de confirmación")
    order.estado = "confirmada"
    order.fecha_confirmacion_proveedor = datetime.now(timezone.utc)
    if fecha_despacho:
        try:
            order.fecha_entrega_estimada = datetime.strptime(fecha_despacho, "%Y-%m-%d").date()
        except ValueError:
            pass
    if observaciones:
        order.observaciones = (order.observaciones or "") + f"\n[Proveedor] {observaciones}"
    await db.commit()
    await db.refresh(order)
    r = await db.execute(select(PurchaseOrderItem).where(PurchaseOrderItem.purchase_order_id == order.id))
    order.items = list(r.scalars().all())
    return order


def _order_summary(o: PurchaseOrder) -> dict:
    return {
        "id": str(o.id),
        "numero": o.numero,
        "fecha": o.fecha,
        "estado": o.estado,
        "total": float(o.total or 0),
        "moneda": o.moneda or "PYG",
        "item_count": len(o.items) if hasattr(o, "items") and o.items else 0,
        "fecha_entrega_estimada": str(o.fecha_entrega_estimada) if o.fecha_entrega_estimada else None,
        "fecha_confirmacion_proveedor": o.fecha_confirmacion_proveedor,
    }


def order_to_detail(order: PurchaseOrder) -> dict:
    items = []
    for i in (order.items or []):
        items.append({
            "id": str(i.id),
            "product_id": str(i.product_id),
            "descripcion": i.descripcion,
            "cantidad": float(i.cantidad or 0),
            "precio_unitario": float(i.precio_unitario or 0),
            "total": float(i.total or 0),
        })
    return {
        "id": str(order.id),
        "numero": order.numero,
        "fecha": order.fecha,
        "estado": order.estado,
        "moneda": order.moneda or "PYG",
        "subtotal": float(order.subtotal or 0),
        "total": float(order.total or 0),
        "observaciones": order.observaciones,
        "condiciones_pago": order.condiciones_pago,
        "dias_validez": order.dias_validez or 30,
        "fecha_entrega_estimada": str(order.fecha_entrega_estimada) if order.fecha_entrega_estimada else None,
        "items": items,
    }


# ── Product Catalog ─────────────────────────────────────────────────

async def list_supplier_products(
    db: AsyncSession, supplier_id: str, company_id: str,
    search: str = "", limit: int = 50, offset: int = 0,
) -> list[dict]:
    # Products where company_id matches and supplier is the main supplier or has supplied before
    q = (
        select(Product)
        .where(Product.company_id == UUID(company_id), Product.activo == True)
        .order_by(Product.nombre)
        .offset(offset).limit(limit)
    )
    if search:
        q = q.where(
            or_(Product.nombre.ilike(f"%{search}%"), Product.sku.ilike(f"%{search}%"))
        )
    r = await db.execute(q)
    products = r.scalars().all()

    results = []
    for p in products:
        results.append({
            "id": str(p.id),
            "nombre": p.nombre,
            "descripcion": p.descripcion,
            "precio": float(p.precio_venta or 0),
            "stock_disponible": 0,
            "unidad_medida": p.unidad_medida,
            "activo": p.activo,
            "created_at": p.created_at,
        })
    return results


# ── Documents ───────────────────────────────────────────────────────

async def upload_document(db: AsyncSession, supplier_user_id: str, supplier_id: str, company_id: str, data: dict) -> SupplierDocument:
    doc = SupplierDocument(
        supplier_user_id=UUID(supplier_user_id),
        supplier_id=UUID(supplier_id),
        company_id=UUID(company_id),
        tipo=data["tipo"],
        nombre=data["nombre"],
        descripcion=data.get("descripcion"),
        filename=data["filename"],
        file_url=data["file_url"],
        file_size=data.get("file_size"),
        purchase_order_id=UUID(data["purchase_order_id"]) if data.get("purchase_order_id") else None,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc


async def list_documents(
    db: AsyncSession, supplier_id: str, company_id: str,
    tipo: str = "", limit: int = 50, offset: int = 0,
) -> list[SupplierDocument]:
    q = (
        select(SupplierDocument)
        .where(SupplierDocument.supplier_id == UUID(supplier_id), SupplierDocument.company_id == UUID(company_id))
        .order_by(SupplierDocument.created_at.desc())
        .offset(offset).limit(limit)
    )
    if tipo:
        q = q.where(SupplierDocument.tipo == tipo)
    r = await db.execute(q)
    return list(r.scalars().all())


def doc_to_response(d: SupplierDocument) -> dict:
    return {
        "id": str(d.id),
        "tipo": d.tipo,
        "nombre": d.nombre,
        "descripcion": d.descripcion,
        "filename": d.filename,
        "file_url": d.file_url,
        "file_size": d.file_size,
        "purchase_order_id": str(d.purchase_order_id) if d.purchase_order_id else None,
        "estado": d.estado,
        "created_at": d.created_at,
    }


# ── Payments ────────────────────────────────────────────────────────

async def list_payments(db: AsyncSession, supplier_id: str, company_id: str) -> list[dict]:
    r = await db.execute(
        select(SupplierInvoice)
        .where(
            SupplierInvoice.company_id == UUID(company_id),
            # Map supplier_id to razon_social match or use supplier field
        )
        .order_by(SupplierInvoice.created_at.desc())
        .limit(50)
    )
    invoices = r.scalars().all()
    from api.src.purchases.models import Supplier
    sup_r = await db.execute(select(Supplier).where(Supplier.id == UUID(supplier_id)))
    supplier = sup_r.scalar_one_or_none()

    results = []
    for inv in invoices:
        if not supplier or inv.proveedor_nombre != supplier.razon_social:
            continue
        # Get payments
        pr = await db.execute(
            select(SupplierInvoicePayment).where(SupplierInvoicePayment.invoice_id == inv.id)
        )
        payments = pr.scalars().all()
        pagado = float(sum(p.monto or 0) for p in payments) if payments else 0
        results.append({
            "invoice_id": str(inv.id),
            "numero": inv.numero,
            "fecha": inv.fecha,
            "total": float(inv.total or 0),
            "pagado": pagado,
            "saldo": float(inv.total or 0) - pagado,
            "estado": inv.estado,
        })
    return results


# ── Chat ────────────────────────────────────────────────────────────

async def get_supplier_whatsapp_url(db: AsyncSession, supplier_id: str) -> str:
    from api.src.purchases.models import Supplier
    r = await db.execute(select(Supplier).where(Supplier.id == UUID(supplier_id)))
    supplier = r.scalar_one_or_none()
    phone = "595981000000"
    if supplier and supplier.telefono:
        phone = supplier.telefono.replace("+", "").replace(" ", "").replace("-", "")
    message = "Hola! Tengo consultas sobre pedidos"
    return f"https://wa.me/{phone}?text={message.replace(' ', '%20')}"
