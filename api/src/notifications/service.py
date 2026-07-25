"""Notifications service"""

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import uuid

from api.src.notifications.models import NotificationTemplate, UserNotificationPreference, Notification
from api.src.notifications.schemas import (
    NotificationTemplateCreate, NotificationTemplateUpdate,
    UserNotificationPreferenceCreate, BulkPreferenceUpdate,
    NotificationCreate,
)
from api.src.auth.models import User
from api.src.rbac.models import Role, UserRole
from api.src.notifications.event_utils import emit_notification


async def create_template(db: AsyncSession, tenant_id: uuid.UUID, data: NotificationTemplateCreate) -> NotificationTemplate:
    template = NotificationTemplate(tenant_id=tenant_id, **data.model_dump())
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


async def update_template(db: AsyncSession, tenant_id: uuid.UUID, template_id: uuid.UUID, data: NotificationTemplateUpdate) -> Optional[NotificationTemplate]:
    result = await db.execute(
        select(NotificationTemplate).where(and_(NotificationTemplate.id == template_id, NotificationTemplate.tenant_id == tenant_id))
    )
    template = result.scalar_one_or_none()
    if not template:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(template, key, value)
    await db.commit()
    await db.refresh(template)
    return template


async def delete_template(db: AsyncSession, tenant_id: uuid.UUID, template_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(NotificationTemplate).where(and_(NotificationTemplate.id == template_id, NotificationTemplate.tenant_id == tenant_id))
    )
    template = result.scalar_one_or_none()
    if not template:
        return False
    await db.delete(template)
    await db.commit()
    return True


async def get_templates(db: AsyncSession, tenant_id: uuid.UUID) -> list[NotificationTemplate]:
    result = await db.execute(
        select(NotificationTemplate).where(NotificationTemplate.tenant_id == tenant_id).order_by(NotificationTemplate.name)
    )
    return list(result.scalars().all())


async def get_preferences(db: AsyncSession, user_id: uuid.UUID, tenant_id: uuid.UUID) -> list[UserNotificationPreference]:
    result = await db.execute(
        select(UserNotificationPreference).where(and_(UserNotificationPreference.user_id == user_id, UserNotificationPreference.tenant_id == tenant_id))
    )
    return list(result.scalars().all())


async def save_preference(db: AsyncSession, user_id: uuid.UUID, tenant_id: uuid.UUID, data: UserNotificationPreferenceCreate) -> UserNotificationPreference:
    result = await db.execute(
        select(UserNotificationPreference).where(
            and_(
                UserNotificationPreference.user_id == user_id,
                UserNotificationPreference.tenant_id == tenant_id,
                UserNotificationPreference.canal == data.canal.value,
                UserNotificationPreference.tipo == data.tipo,
            )
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.habilitado = data.habilitado
        existing.horario_inicio = data.horario_inicio
        existing.horario_fin = data.horario_fin
        await db.commit()
        await db.refresh(existing)
        return existing
    preference = UserNotificationPreference(user_id=user_id, tenant_id=tenant_id, canal=data.canal.value, tipo=data.tipo, **data.model_dump(exclude={"canal"}))
    db.add(preference)
    await db.commit()
    await db.refresh(preference)
    return preference


async def bulk_update_preferences(db: AsyncSession, user_id: uuid.UUID, tenant_id: uuid.UUID, preferences: list[UserNotificationPreferenceCreate]) -> list[UserNotificationPreference]:
    result = []
    for pref_data in preferences:
        pref = await save_preference(db, user_id, tenant_id, pref_data)
        result.append(pref)
    return result


async def create_notification(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, title: str, body: str, tipo: str, link: Optional[str] = None) -> Notification:
    notification = Notification(tenant_id=tenant_id, user_id=user_id, title=title, body=body, tipo=tipo, link=link)
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    await emit_notification(user_id, {
        "id": str(notification.id),
        "title": title,
        "body": body,
        "tipo": tipo,
        "link": link,
    })
    return notification


async def create_notification_for_role(db: AsyncSession, tenant_id: uuid.UUID, role_name: str, title: str, body: str, tipo: str, link: Optional[str] = None) -> list[Notification]:
    result = await db.execute(
        select(User.id).join(UserRole).join(Role).where(and_(User.tenant_id == tenant_id, Role.name == role_name))
    )
    user_ids = [row[0] for row in result.all()]
    notifications = []
    for uid in user_ids:
        notif = await create_notification(db, tenant_id, uid, title, body, tipo, link)
        notifications.append(notif)
    return notifications


async def get_notifications(db: AsyncSession, user_id: uuid.UUID, tenant_id: uuid.UUID, unread_only: bool = False, limit: int = 50, offset: int = 0) -> tuple[list[Notification], int]:
    query = select(Notification).where(and_(Notification.user_id == user_id, Notification.tenant_id == tenant_id))
    if unread_only:
        query = query.where(Notification.leida == False)
    query = query.order_by(Notification.created_at.desc())
    count_query = select(func.count(Notification.id)).where(and_(Notification.user_id == user_id, Notification.tenant_id == tenant_id))
    if unread_only:
        count_query = count_query.where(Notification.leida == False)
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    notifications = list(result.scalars().all())
    return notifications, total


async def mark_as_read(db: AsyncSession, user_id: uuid.UUID, tenant_id: uuid.UUID, notification_ids: list[uuid.UUID]) -> int:
    result = await db.execute(
        select(Notification).where(
            and_(
                Notification.id.in_(notification_ids),
                Notification.user_id == user_id,
                Notification.tenant_id == tenant_id,
            )
        )
    )
    notifications = result.scalars().all()
    count = 0
    for notif in notifications:
        notif.leida = True
        count += 1
    await db.commit()
    return count


async def mark_all_as_read(db: AsyncSession, user_id: uuid.UUID, tenant_id: uuid.UUID) -> int:
    result = await db.execute(
        select(Notification).where(and_(Notification.user_id == user_id, Notification.tenant_id == tenant_id, Notification.leida == False))
    )
    notifications = result.scalars().all()
    count = 0
    for notif in notifications:
        notif.leida = True
        count += 1
    await db.commit()
    return count


async def get_unread_count(db: AsyncSession, user_id: uuid.UUID, tenant_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count(Notification.id)).where(and_(Notification.user_id == user_id, Notification.tenant_id == tenant_id, Notification.leida == False))
    )
    return result.scalar() or 0


async def delete_notification(db: AsyncSession, tenant_id: uuid.UUID, notification_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(Notification).where(and_(Notification.id == notification_id, Notification.tenant_id == tenant_id, Notification.user_id == user_id))
    )
    notif = result.scalar_one_or_none()
    if not notif:
        return False
    await db.delete(notif)
    await db.commit()
    return True


DEFAULT_TEMPLATES = [
    {
        "name": "Nueva Venta",
        "title_template": "Nueva venta realizada",
        "body_template": "Nueva venta realizada por {cliente} - {total} PYG",
        "tipo": "venta",
        "canales": ["in_app", "email"],
    },
    {
        "name": "Pago Recibido",
        "title_template": "Pago recibido",
        "body_template": "Pago recibido de {cliente} - {monto} PYG",
        "tipo": "pago",
        "canales": ["in_app", "email"],
    },
    {
        "name": "Stock Bajo",
        "title_template": "Alerta de stock",
        "body_template": "Alerta: {producto} tiene stock bajo ({stock} unidades)",
        "tipo": "inventario",
        "canales": ["in_app"],
    },
    {
        "name": "Alerta de Sistema",
        "title_template": "Alerta del sistema",
        "body_template": "{mensaje}",
        "tipo": "alerta",
        "canales": ["in_app", "email"],
    },
    {
        "name": "Promoción",
        "title_template": "Nueva promoción",
        "body_template": "{titulo}: {mensaje}",
        "tipo": "promocion",
        "canales": ["in_app", "email", "push"],
    },
]


async def seed_default_templates(db: AsyncSession, tenant_id: uuid.UUID) -> None:
    for tmpl_data in DEFAULT_TEMPLATES:
        result = await db.execute(
            select(NotificationTemplate).where(and_(NotificationTemplate.tenant_id == tenant_id, NotificationTemplate.name == tmpl_data["name"]))
        )
        existing = result.scalar_one_or_none()
        if not existing:
            template = NotificationTemplate(tenant_id=tenant_id, **tmpl_data)
            db.add(template)
    await db.commit()