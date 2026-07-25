"""Notifications router"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import uuid

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.notifications import service
from api.src.notifications.schemas import (
    NotificationTemplateCreate, NotificationTemplateUpdate, NotificationTemplateResponse,
    UserNotificationPreferenceCreate, UserNotificationPreferenceResponse, BulkPreferenceUpdate,
    NotificationCreate, NotificationResponse, NotificationListResponse,
    MarkReadRequest, UnreadCountResponse,
)

router = APIRouter(prefix="/api/v1/notifications", tags=["Notifications"])


@router.get("/templates", response_model=list[NotificationTemplateResponse])
async def get_templates(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = uuid.UUID(user["tenant_id"])
    return await service.get_templates(db, tenant_id)


@router.post("/templates", response_model=NotificationTemplateResponse)
async def create_template(
    data: NotificationTemplateCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = uuid.UUID(user["tenant_id"])
    return await service.create_template(db, tenant_id, data)


@router.put("/templates/{template_id}", response_model=NotificationTemplateResponse)
async def update_template(
    template_id: uuid.UUID,
    data: NotificationTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = uuid.UUID(user["tenant_id"])
    template = await service.update_template(db, tenant_id, template_id, data)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = uuid.UUID(user["tenant_id"])
    success = await service.delete_template(db, tenant_id, template_id)
    if not success:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted"}


@router.get("/preferences", response_model=list[UserNotificationPreferenceResponse])
async def get_preferences(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    user_id = uuid.UUID(user["id"])
    tenant_id = uuid.UUID(user["tenant_id"])
    return await service.get_preferences(db, user_id, tenant_id)


@router.put("/preferences", response_model=UserNotificationPreferenceResponse)
async def save_preference(
    data: UserNotificationPreferenceCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    user_id = uuid.UUID(user["id"])
    tenant_id = uuid.UUID(user["tenant_id"])
    return await service.save_preference(db, user_id, tenant_id, data)


@router.put("/preferences/bulk", response_model=list[UserNotificationPreferenceResponse])
async def bulk_update_preferences(
    data: BulkPreferenceUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    user_id = uuid.UUID(user["id"])
    tenant_id = uuid.UUID(user["tenant_id"])
    return await service.bulk_update_preferences(db, user_id, tenant_id, data.preferences)


@router.get("/notifications", response_model=NotificationListResponse)
async def get_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    user_id = uuid.UUID(user["id"])
    tenant_id = uuid.UUID(user["tenant_id"])
    notifications, total = await service.get_notifications(db, user_id, tenant_id, unread_only, limit, offset)
    return NotificationListResponse(total=total, notifications=notifications)


@router.get("/notifications/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    user_id = uuid.UUID(user["id"])
    tenant_id = uuid.UUID(user["tenant_id"])
    count = await service.get_unread_count(db, user_id, tenant_id)
    return UnreadCountResponse(count=count)


@router.post("/notifications/mark-read")
async def mark_as_read(
    data: MarkReadRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    user_id = uuid.UUID(user["id"])
    tenant_id = uuid.UUID(user["tenant_id"])
    count = await service.mark_as_read(db, user_id, tenant_id, data.notification_ids)
    return {"marked": count}


@router.post("/notifications/mark-all-read")
async def mark_all_as_read(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    user_id = uuid.UUID(user["id"])
    tenant_id = uuid.UUID(user["tenant_id"])
    count = await service.mark_all_as_read(db, user_id, tenant_id)
    return {"marked": count}


@router.delete("/notifications/{notification_id}")
async def delete_notification(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    user_id = uuid.UUID(user["id"])
    tenant_id = uuid.UUID(user["tenant_id"])
    success = await service.delete_notification(db, tenant_id, notification_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification deleted"}