from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features.deps import require_feature
from api.src.scanandgo import service
from api.src.scanandgo.schemas import (
    ScanSessionCreate, ScanItemAdd, ScanPaymentRequest,
    ScanAuditCheck, ScanAuditResolve, SendDigitalTicketRequest,
)

router = APIRouter(
    prefix="/api/v1/scanandgo",
    tags=["scanandgo"],
    dependencies=[Depends(require_feature("scanandgo")), Depends(require_auth)],
)


@router.post("/sessions")
async def create_session(
    data: ScanSessionCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_session(db, user["company_id"], user.get("customer_id") or user["id"], data)


@router.get("/sessions/active")
async def get_active_session(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_active_session(db, user["company_id"], user.get("customer_id") or user["id"])
    if not result:
        raise HTTPException(status_code=404, detail="No active session")
    return result


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_session(db, user["company_id"], session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return result


@router.get("/sessions")
async def list_sessions(
    status: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_sessions(db, user["company_id"], status, customer_id, limit, offset)


@router.post("/items")
async def add_item(
    data: ScanItemAdd,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.add_item(db, user["company_id"], data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/items/{session_id}/{item_id}")
async def remove_item(
    session_id: str, item_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.remove_item(db, user["company_id"], session_id, item_id)
    if not result:
        raise HTTPException(status_code=404, detail="Item not found")
    return result


@router.post("/payments")
async def process_payment(
    data: ScanPaymentRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.process_payment(db, user["company_id"], data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/audits/pending")
async def list_pending_audits(
    limit: int = Query(50),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_pending_audits(db, user["company_id"], limit)


@router.get("/audits/{audit_id}")
async def get_audit(
    audit_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_audit(db, user["company_id"], audit_id)
    if not result:
        raise HTTPException(status_code=404, detail="Audit not found")
    return result


@router.post("/audits/check")
async def check_audit(
    data: ScanAuditCheck,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.check_audit(db, user["company_id"], data)
    if not result:
        raise HTTPException(status_code=404, detail="Audit not found")
    return result


@router.post("/audits/resolve")
async def resolve_audit(
    data: ScanAuditResolve,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.resolve_audit(db, user["company_id"], data)
    if not result:
        raise HTTPException(status_code=404, detail="Audit not found")
    return result


@router.get("/dashboard")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_dashboard(db, user["company_id"])


@router.post("/digital-ticket")
async def send_digital_ticket(
    data: SendDigitalTicketRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.send_digital_ticket(db, user["company_id"], data)


@router.get("/products/lookup/{barcode}")
async def lookup_product(
    barcode: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.lookup_product(db, user["company_id"], barcode)
    if not result:
        raise HTTPException(status_code=404, detail="Product not found")
    return result
