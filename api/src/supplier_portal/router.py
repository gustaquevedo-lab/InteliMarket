"""Supplier Portal — REST API for supplier self-service."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.features import require_feature
from api.src.supplier_portal.auth import require_supplier
from api.src.supplier_portal import service

router = APIRouter(
    prefix="/api/v1/supplier-portal",
    tags=["supplier-portal"],
    dependencies=[Depends(require_feature("supplier_portal"))],
)


# ── Auth ────────────────────────────────────────────────────────────

@router.post("/auth/register")
async def register(data: dict, db: AsyncSession = Depends(get_db)):
    try:
        user = await service.register_supplier_user(db, data)
        _, token = await service.login_supplier(db, user.email, data["password"])
        return {"access_token": token, "token_type": "bearer_supplier"}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/auth/login")
async def login(data: dict, db: AsyncSession = Depends(get_db)):
    try:
        _, token = await service.login_supplier(db, data["email"], data["password"])
        return {"access_token": token, "token_type": "bearer_supplier"}
    except ValueError as e:
        raise HTTPException(401, str(e))


# ── Profile ─────────────────────────────────────────────────────────

@router.get("/me")
async def get_profile(
    db: AsyncSession = Depends(get_db),
    supplier: dict = Depends(require_supplier),
):
    user = await service.get_profile(db, supplier["supplier_user_id"])
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    return {
        "id": str(user.id),
        "supplier_id": str(user.supplier_id),
        "email": user.email,
        "nombre": user.nombre,
        "telefono": user.telefono,
        "cargo": user.cargo,
        "activo": user.activo,
    }


# ── Dashboard ───────────────────────────────────────────────────────

@router.get("/dashboard")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    supplier: dict = Depends(require_supplier),
):
    return await service.get_dashboard(db, supplier["supplier_id"], supplier["company_id"])


# ── Purchase Orders ─────────────────────────────────────────────────

@router.get("/orders")
async def list_orders(
    estado: str = Query(""),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    supplier: dict = Depends(require_supplier),
):
    orders = await service.list_orders(db, supplier["supplier_id"], supplier["company_id"], estado, limit, offset)
    return [service._order_summary(o) for o in orders]


@router.get("/orders/{order_id}")
async def get_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    supplier: dict = Depends(require_supplier),
):
    order = await service.get_order(db, order_id, supplier["supplier_id"])
    if not order:
        raise HTTPException(404, "Orden de compra no encontrada")
    return service.order_to_detail(order)


@router.post("/orders/{order_id}/confirm")
async def confirm_order(
    order_id: str,
    data: dict = {},
    db: AsyncSession = Depends(get_db),
    supplier: dict = Depends(require_supplier),
):
    try:
        order = await service.confirm_order(
            db, order_id, supplier["supplier_id"],
            data.get("fecha_despacho"), data.get("observaciones"),
        )
        return service.order_to_detail(order)
    except ValueError as e:
        raise HTTPException(400, str(e))


# ── Product Catalog ─────────────────────────────────────────────────

@router.get("/products")
async def list_products(
    search: str = Query(""),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    supplier: dict = Depends(require_supplier),
):
    return await service.list_supplier_products(db, supplier["supplier_id"], supplier["company_id"], search, limit, offset)


# ── Documents ───────────────────────────────────────────────────────

@router.post("/documents", status_code=201)
async def upload_document(
    data: dict,
    db: AsyncSession = Depends(get_db),
    supplier: dict = Depends(require_supplier),
):
    doc = await service.upload_document(db, supplier["supplier_user_id"], supplier["supplier_id"], supplier["company_id"], data)
    return service.doc_to_response(doc)


@router.get("/documents")
async def list_documents(
    tipo: str = Query(""),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    supplier: dict = Depends(require_supplier),
):
    docs = await service.list_documents(db, supplier["supplier_id"], supplier["company_id"], tipo, limit, offset)
    return [service.doc_to_response(d) for d in docs]


# ── Payments ────────────────────────────────────────────────────────

@router.get("/payments")
async def list_payments(
    db: AsyncSession = Depends(get_db),
    supplier: dict = Depends(require_supplier),
):
    return await service.list_payments(db, supplier["supplier_id"], supplier["company_id"])


# ── Chat ────────────────────────────────────────────────────────────

@router.get("/chat/whatsapp-url")
async def get_whatsapp_url(
    db: AsyncSession = Depends(get_db),
    supplier: dict = Depends(require_supplier),
):
    url = await service.get_supplier_whatsapp_url(db, supplier["supplier_id"])
    return {"url": url}
