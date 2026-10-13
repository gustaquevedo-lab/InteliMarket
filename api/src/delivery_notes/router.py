from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.delivery_notes.schemas import (
    DeliveryNoteCreate,
    DeliveryNoteApplyInput,
    DeliveryNoteResponse,
)
from api.src.delivery_notes.service import DeliveryNoteService

router = APIRouter(prefix="/api/v1/distribuidora/delivery-notes", tags=["delivery-notes"])


@router.post("", response_model=DeliveryNoteResponse)
async def create_delivery_note(
    body: DeliveryNoteCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    svc = DeliveryNoteService(db)
    user_id = str(user.get("sub") or user.get("id", ""))
    return await svc.create(body, created_by=user_id)


@router.get("", response_model=list[DeliveryNoteResponse])
async def list_delivery_notes(
    company_id: str = Query(...),
    estado: Optional[str] = Query(None),
    concepto: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    svc = DeliveryNoteService(db)
    return await svc.list(company_id, estado=estado, concepto=concepto, customer_id=customer_id)


@router.get("/{note_id}", response_model=DeliveryNoteResponse)
async def get_delivery_note(
    note_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    svc = DeliveryNoteService(db)
    note = await svc.get(note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Nota de crédito no encontrada")
    return note


@router.post("/{note_id}/apply", response_model=DeliveryNoteResponse)
async def apply_delivery_note(
    note_id: uuid.UUID,
    body: DeliveryNoteApplyInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    svc = DeliveryNoteService(db)
    user_id = str(user.get("sub") or user.get("id", ""))
    return await svc.apply(note_id, body, created_by=user_id)


@router.post("/{note_id}/cancel", response_model=DeliveryNoteResponse)
async def cancel_delivery_note(
    note_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    svc = DeliveryNoteService(db)
    user_id = str(user.get("sub") or user.get("id", ""))
    return await svc.cancel(note_id, created_by=user_id)
