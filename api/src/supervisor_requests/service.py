from datetime import datetime, timezone
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.supervisor_requests.models import SupervisorAuthRequest
from api.src.supervisor_requests.schemas import SupervisorAuthRequestCreate, SupervisorAuthRequestResolve


async def create_request(db: AsyncSession, data: SupervisorAuthRequestCreate) -> SupervisorAuthRequest:
    req = SupervisorAuthRequest(**data.model_dump())
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return req


async def get_request(db: AsyncSession, request_id: str) -> SupervisorAuthRequest | None:
    result = await db.execute(select(SupervisorAuthRequest).where(SupervisorAuthRequest.id == uuid.UUID(request_id)))
    return result.scalar_one_or_none()


async def list_requests(db: AsyncSession, company_id: str, estado: str | None = None, limit: int = 50) -> list[SupervisorAuthRequest]:
    query = select(SupervisorAuthRequest).where(SupervisorAuthRequest.company_id == uuid.UUID(company_id))
    if estado:
        query = query.where(SupervisorAuthRequest.estado == estado)
    query = query.order_by(SupervisorAuthRequest.created_at.desc()).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def resolve_request(db: AsyncSession, request_id: str, data: SupervisorAuthRequestResolve) -> SupervisorAuthRequest | None:
    req = await get_request(db, request_id)
    if not req or req.estado != "pendiente":
        return None
    req.estado = "aprobado" if data.aprobado else "rechazado"
    req.resuelto_por = data.resuelto_por
    req.resuelto_por_nombre = data.resuelto_por_nombre
    req.resuelto_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(req)
    return req
