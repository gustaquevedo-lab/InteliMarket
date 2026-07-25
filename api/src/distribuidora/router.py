"""Distribuidora — API router for import, agreements (supplier/customer), routes, credit, approvals, margins."""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.distribuidora import schemas as sc
from api.src.distribuidora import service

router = APIRouter(prefix="/api/v1/distribuidora", tags=["distribuidora"])


# ═══════════════════════════════════════════════════════════════
# DASHBOARD
# ═══════════════════════════════════════════════════════════════

@router.get("/dashboard/{company_id}")
async def dashboard(
    company_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.get_dashboard(db, company_id)


# ═══════════════════════════════════════════════════════════════
# ACUERDOS CON PROVEEDORES
# ═══════════════════════════════════════════════════════════════

@router.get("/supplier-agreements/{company_id}")
async def list_supplier_agreements(
    company_id: str,
    supplier_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.list_supplier_agreements(db, company_id, supplier_id)


@router.post("/supplier-agreements/{company_id}", status_code=201)
async def create_supplier_agreement(
    company_id: str,
    body: sc.SupplierAgreementCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.create_supplier_agreement(db, company_id, body.model_dump())


@router.get("/supplier-agreements/detail/{agreement_id}")
async def get_supplier_agreement(
    agreement_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    obj = await service.get_supplier_agreement(db, agreement_id)
    if not obj:
        raise HTTPException(404, "Acuerdo no encontrado")
    return obj


@router.put("/supplier-agreements/{agreement_id}")
async def update_supplier_agreement(
    agreement_id: str,
    body: sc.SupplierAgreementUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.update_supplier_agreement(db, agreement_id, body.model_dump(exclude_none=True))


@router.get("/supplier-agreements/{agreement_id}/items")
async def list_supplier_agreement_items(
    agreement_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.list_agreement_items(db, agreement_id)


@router.post("/supplier-agreements/{agreement_id}/items", status_code=201)
async def add_supplier_agreement_item(
    agreement_id: str,
    body: sc.SupplierAgreementItemCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.add_supplier_agreement_item(db, agreement_id, body.model_dump())


# ═══════════════════════════════════════════════════════════════
# APROBACIÓN DE ÓRDENES DE COMPRA
# ═══════════════════════════════════════════════════════════════

@router.get("/po-approval-config/{company_id}")
async def get_po_approval_config(
    company_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    obj = await service.get_po_approval_config(db, company_id)
    if not obj:
        return {"requiere_aprobacion": True, "niveles_aprobacion": 1}
    return obj


@router.put("/po-approval-config/{company_id}")
async def upsert_po_approval_config(
    company_id: str,
    body: sc.POApprovalConfigCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.upsert_po_approval_config(db, company_id, body.model_dump())


@router.get("/po-approvals/{purchase_order_id}")
async def get_po_approvals(
    purchase_order_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.get_po_approvals(db, purchase_order_id)


@router.post("/po-approvals/{purchase_order_id}/approve")
async def approve_po(
    purchase_order_id: str,
    body: sc.POApproveReject,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.approve_purchase_order(db, purchase_order_id, {
        "aprobador_id": str(body.aprobador_id),
        "action": "approve",
        "comentarios": body.comentarios,
    })


@router.post("/po-approvals/{purchase_order_id}/reject")
async def reject_po(
    purchase_order_id: str,
    body: sc.POApproveReject,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.approve_purchase_order(db, purchase_order_id, {
        "aprobador_id": str(body.aprobador_id),
        "action": "reject",
        "motivo_rechazo": body.motivo_rechazo,
        "comentarios": body.comentarios,
    })


# ═══════════════════════════════════════════════════════════════
# IMPORTACIÓN
# ═══════════════════════════════════════════════════════════════

@router.get("/containers/{company_id}")
async def list_containers(
    company_id: str,
    estado: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.list_containers(db, company_id, estado)


@router.post("/containers/{company_id}", status_code=201)
async def create_container(
    company_id: str,
    body: sc.ImportContainerCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.create_container(db, company_id, body.model_dump())


@router.get("/containers/detail/{container_id}")
async def get_container(
    container_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    obj = await service.get_container(db, container_id)
    if not obj:
        raise HTTPException(404, "Contenedor no encontrado")
    return obj


@router.put("/containers/{container_id}")
async def update_container(
    container_id: str,
    body: sc.ImportContainerUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.update_container(db, container_id, body.model_dump(exclude_none=True))


@router.post("/containers/{container_id}/calculate-landed")
async def calculate_landed(
    container_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.calculate_landed_costs(db, container_id)


@router.post("/containers/{container_id}/reconcile")
async def reconcile_container(
    container_id: str,
    body: sc.ReconcileInput,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.reconcile_container_po(db, container_id, str(body.purchase_order_id))


@router.post("/containers/{container_id}/items", status_code=201)
async def add_item(
    container_id: str,
    body: sc.ImportItemCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.add_item_to_container(db, container_id, body.model_dump())


@router.delete("/containers/items/{item_id}")
async def remove_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    await service.delete_container_item(db, item_id)
    return {"success": True}


# ═══════════════════════════════════════════════════════════════
# ACUERDOS CON CLIENTES
# ═══════════════════════════════════════════════════════════════

@router.get("/customer-agreements/{company_id}")
async def list_customer_agreements(
    company_id: str,
    customer_id: str | None = Query(None),
    estado: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.list_customer_agreements(db, company_id, customer_id, estado)


@router.post("/customer-agreements/{company_id}", status_code=201)
async def create_customer_agreement(
    company_id: str,
    body: sc.CustomerAgreementCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.create_customer_agreement(db, company_id, body.model_dump())


@router.get("/customer-agreements/detail/{agreement_id}")
async def get_customer_agreement(
    agreement_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    obj = await service.get_customer_agreement(db, agreement_id)
    if not obj:
        raise HTTPException(404, "Acuerdo no encontrado")
    return obj


@router.put("/customer-agreements/{agreement_id}")
async def update_customer_agreement(
    agreement_id: str,
    body: sc.CustomerAgreementCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.update_customer_agreement(db, agreement_id, body.model_dump())


# ═══════════════════════════════════════════════════════════════
# RUTEO DE VENTA
# ═══════════════════════════════════════════════════════════════

@router.get("/routes/{company_id}")
async def list_routes(
    company_id: str,
    user_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.list_routes(db, company_id, user_id)


@router.post("/routes/{company_id}", status_code=201)
async def create_route(
    company_id: str,
    body: sc.SalesRouteCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.create_route(db, company_id, body.model_dump())


@router.get("/routes/detail/{route_id}")
async def get_route(
    route_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.get_route(db, route_id)


@router.get("/routes/{route_id}/customers")
async def list_route_customers(
    route_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.list_route_customers(db, route_id)


@router.post("/routes/{route_id}/customers", status_code=201)
async def add_route_customer(
    route_id: str,
    body: sc.RouteCustomerCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.add_route_customer(db, route_id, body.model_dump())


@router.delete("/routes/customers/{rc_id}")
async def remove_route_customer(
    rc_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    await service.remove_route_customer(db, rc_id)
    return {"success": True}


@router.get("/visits/{company_id}")
async def list_visits(
    company_id: str,
    route_id: str | None = Query(None),
    fecha: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.list_visits(db, company_id, route_id, fecha)


@router.post("/routes/{route_id}/visits", status_code=201)
async def create_visit(
    route_id: str,
    body: sc.RouteVisitCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.create_visit(db, route_id, body.model_dump())


@router.post("/visits/{visit_id}/complete")
async def complete_visit(
    visit_id: str,
    body: sc.RouteVisitComplete,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.complete_visit(db, visit_id, body.model_dump(exclude_none=True))


# ═══════════════════════════════════════════════════════════════
# CRÉDITO
# ═══════════════════════════════════════════════════════════════

@router.get("/credit/{company_id}/{customer_id}")
async def get_credit_limit(
    company_id: str,
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    obj = await service.get_credit_limit(db, company_id, customer_id)
    if not obj:
        return {"limite_credito": 0, "limite_disponible": 0, "saldo_utilizado": 0, "bloqueado_por_mora": False}
    return obj


@router.put("/credit/{company_id}/{customer_id}")
async def upsert_credit_limit(
    company_id: str,
    customer_id: str,
    body: sc.CreditLimitUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.upsert_credit_limit(db, company_id, customer_id, body.model_dump())


@router.get("/credit-authorizations/{company_id}")
async def list_authorizations(
    company_id: str,
    customer_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.list_credit_authorizations(db, company_id, customer_id)


@router.post("/credit-authorizations/{company_id}", status_code=201)
async def create_authorization(
    company_id: str,
    body: sc.CreditAuthorizationCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.create_credit_authorization(db, company_id, body.model_dump())


@router.post("/credit-authorizations/{auth_id}/approve")
async def approve_authorization(
    auth_id: str,
    monto: Decimal = Query(...),
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.approve_credit_authorization(db, auth_id, monto, user_id)


@router.post("/credit-authorizations/{auth_id}/reject")
async def reject_authorization(
    auth_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.reject_credit_authorization(db, auth_id)


# ═══════════════════════════════════════════════════════════════
# MÁRGENES Y RENTABILIDAD
# ═══════════════════════════════════════════════════════════════

@router.get("/margins/products/{company_id}")
async def product_margins(
    company_id: str,
    category_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.get_product_margins(db, company_id, category_id)


@router.get("/profitability/routes/{company_id}")
async def route_profitability(
    company_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.get_route_profitability(db, company_id)


@router.get("/profitability/customers/{company_id}")
async def customer_profitability(
    company_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_auth),
):
    return await service.get_customer_profitability(db, company_id)
