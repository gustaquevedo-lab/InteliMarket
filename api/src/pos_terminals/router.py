"""POS terminal assignments — caja/punto de emisión fijos por máquina física
(hostname), configurables solo por administración."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.pos_terminals import service
from api.src.pos_terminals.schemas import PosTerminalAssignmentCreate, PosTerminalAssignmentUpdate, PosTerminalAssignmentResponse

router = APIRouter(prefix="/api/v1/pos-terminals", tags=["pos-terminals"])


def _require_admin(user: dict):
    rol = (user.get("rol") or "").lower()
    if rol not in ("admin", "supervisor") and not user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Solo un administrador o supervisor puede asignar cajas")


@router.get("", response_model=list[PosTerminalAssignmentResponse])
async def list_assignments(db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.list_assignments(db, user["company_id"])


@router.get("/by-hostname/{hostname}", response_model=PosTerminalAssignmentResponse)
async def get_by_hostname(hostname: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    assignment = await service.get_by_hostname(db, user["company_id"], hostname)
    if not assignment:
        raise HTTPException(status_code=404, detail="Esta máquina no tiene una caja asignada todavía")
    return assignment


@router.post("", response_model=PosTerminalAssignmentResponse, status_code=201)
async def create_assignment(body: PosTerminalAssignmentCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    _require_admin(user)
    try:
        return await service.create_assignment(db, user["company_id"], body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{assignment_id}", response_model=PosTerminalAssignmentResponse)
async def update_assignment(assignment_id: str, body: PosTerminalAssignmentUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    _require_admin(user)
    result = await service.update_assignment(db, assignment_id, body)
    if not result:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    return result


@router.delete("/{assignment_id}", status_code=204)
async def delete_assignment(assignment_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    _require_admin(user)
    ok = await service.delete_assignment(db, assignment_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
