"""POS terminal assignments — caja/punto de emisión fijos por máquina física
(hostname o IP), configurables solo por administración."""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

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


@router.get("/detect", response_model=PosTerminalAssignmentResponse)
async def detect_terminal(
    request: Request,
    hostname: Optional[str] = None,
    ip: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth)
):
    # Detectar IP del cliente (considerando proxies/reverse proxies)
    client_ip = ip or request.headers.get("x-forwarded-for", "").split(",")[0].strip() or request.client.host if request.client else None
    assignment = await service.detect_terminal(db, user["company_id"], client_ip, hostname)
    if not assignment:
        raise HTTPException(status_code=404, detail="No se encontró una caja asignada para esta IP o equipo")
    return assignment


@router.get("/by-hostname/{hostname}", response_model=PosTerminalAssignmentResponse)
async def get_by_hostname(hostname: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    assignment = await service.get_by_hostname(db, user["company_id"], hostname)
    if not assignment:
        raise HTTPException(status_code=404, detail="Esta máquina no tiene una caja asignada todavía")
    return assignment


@router.get("/by-ip/{ip_address}", response_model=PosTerminalAssignmentResponse)
async def get_by_ip(ip_address: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    assignment = await service.get_by_ip(db, user["company_id"], ip_address)
    if not assignment:
        raise HTTPException(status_code=404, detail="Esta dirección IP no tiene una caja asignada")
    return assignment


@router.post("", response_model=PosTerminalAssignmentResponse, status_code=201)
async def create_assignment(body: PosTerminalAssignmentCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    _require_admin(user)
    try:
        return await service.create_assignment(db, user["company_id"], body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{assignment_id}", response_model=PosTerminalAssignmentResponse)
@router.put("/{assignment_id}", response_model=PosTerminalAssignmentResponse)
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
