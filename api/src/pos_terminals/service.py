from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from api.src.pos_terminals.models import PosTerminalAssignment
from api.src.pos_terminals.schemas import PosTerminalAssignmentCreate, PosTerminalAssignmentUpdate


async def list_assignments(db: AsyncSession, company_id: str) -> list[PosTerminalAssignment]:
    result = await db.execute(
        select(PosTerminalAssignment).where(PosTerminalAssignment.company_id == company_id).order_by(PosTerminalAssignment.caja_nombre)
    )
    return list(result.scalars().all())


async def get_by_hostname(db: AsyncSession, company_id: str, hostname: str) -> PosTerminalAssignment | None:
    result = await db.execute(
        select(PosTerminalAssignment).where(
            PosTerminalAssignment.company_id == company_id,
            PosTerminalAssignment.hostname == hostname,
            PosTerminalAssignment.activo == True,
        )
    )
    return result.scalar_one_or_none()


async def create_assignment(db: AsyncSession, company_id: str, data: PosTerminalAssignmentCreate) -> PosTerminalAssignment:
    existing = await db.execute(
        select(PosTerminalAssignment).where(PosTerminalAssignment.hostname == data.hostname)
    )
    if existing.scalar_one_or_none():
        raise ValueError(f"El hostname '{data.hostname}' ya tiene una caja asignada")
    assignment = PosTerminalAssignment(
        company_id=company_id,
        hostname=data.hostname,
        punto_emision=data.punto_emision,
        caja_nombre=data.caja_nombre,
    )
    db.add(assignment)
    await db.flush()
    await db.refresh(assignment)
    return assignment


async def update_assignment(db: AsyncSession, assignment_id: str, data: PosTerminalAssignmentUpdate) -> PosTerminalAssignment | None:
    result = await db.execute(select(PosTerminalAssignment).where(PosTerminalAssignment.id == uuid.UUID(assignment_id)))
    assignment = result.scalar_one_or_none()
    if not assignment:
        return None
    if data.punto_emision is not None:
        assignment.punto_emision = data.punto_emision
    if data.caja_nombre is not None:
        assignment.caja_nombre = data.caja_nombre
    if data.activo is not None:
        assignment.activo = data.activo
    await db.flush()
    await db.refresh(assignment)
    return assignment


async def delete_assignment(db: AsyncSession, assignment_id: str) -> bool:
    result = await db.execute(select(PosTerminalAssignment).where(PosTerminalAssignment.id == uuid.UUID(assignment_id)))
    assignment = result.scalar_one_or_none()
    if not assignment:
        return False
    await db.delete(assignment)
    await db.flush()
    return True
