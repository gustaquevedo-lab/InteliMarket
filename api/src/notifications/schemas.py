"""Notifications schemas"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, time
from enum import Enum
import uuid


class TipoNotificacion(str, Enum):
    venta = "venta"
    pago = "pago"
    inventario = "inventario"
    alerta = "alerta"
    sistema = "sistema"
    promocion = "promocion"


class CanalNotificacion(str, Enum):
    in_app = "in_app"
    email = "email"
    sms = "sms"
    push = "push"


class NotificationTemplateCreate(BaseModel):
    name: str
    title_template: str
    body_template: str
    tipo: TipoNotificacion
    canales: list[str] = ["in_app"]
    activo: bool = True


class NotificationTemplateUpdate(BaseModel):
    name: Optional[str] = None
    title_template: Optional[str] = None
    body_template: Optional[str] = None
    tipo: Optional[TipoNotificacion] = None
    canales: Optional[list[str]] = None
    activo: Optional[bool] = None


class NotificationTemplateResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    title_template: str
    body_template: str
    tipo: str
    canales: list[str]
    activo: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserNotificationPreferenceCreate(BaseModel):
    canal: CanalNotificacion
    tipo: str
    habilitado: bool = True
    horario_inicio: Optional[time] = None
    horario_fin: Optional[time] = None


class UserNotificationPreferenceUpdate(BaseModel):
    habilitado: Optional[bool] = None
    horario_inicio: Optional[time] = None
    horario_fin: Optional[time] = None


class UserNotificationPreferenceResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    tenant_id: uuid.UUID
    canal: str
    tipo: str
    habilitado: bool
    horario_inicio: Optional[time]
    horario_fin: Optional[time]
    created_at: datetime

    class Config:
        from_attributes = True


class BulkPreferenceUpdate(BaseModel):
    preferences: list[UserNotificationPreferenceCreate]


class NotificationCreate(BaseModel):
    title: str
    body: str
    tipo: TipoNotificacion
    link: Optional[str] = None


class NotificationResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    title: str
    body: str
    tipo: str
    link: Optional[str]
    leida: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    total: int
    notifications: list[NotificationResponse]


class MarkReadRequest(BaseModel):
    notification_ids: list[uuid.UUID]


class UnreadCountResponse(BaseModel):
    count: int