"""Branch router"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.branches import service
from api.src.branches.schemas import (
    BranchCreate, BranchUpdate, BranchResponse,
    BranchPriceUpsert, BranchPriceResponse,
    BranchTransferCreate, BranchTransferResponse,
    TransferReceiveInput, ConsolidatedDashboard,
)

router = APIRouter(prefix="/api/v1/branches", tags=["branches"])


# ── Static routes FIRST (before /{branch_id}) ────────────────

@router.get("/prices", response_model=list[BranchPriceResponse])
async def list_all_prices(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_branch_prices(db, user["company_id"])


@router.post("/prices", response_model=BranchPriceResponse)
async def upsert_branch_price(
    data: BranchPriceUpsert,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    bp = await service.upsert_branch_price(db, data)
    result = await service.get_branch_prices(db, user["company_id"])
    for r in result:
        if r["id"] == str(bp.id):
            return r
    return {"id": str(bp.id), "branch_id": str(bp.branch_id), "product_id": str(bp.product_id), "precio": float(bp.precio)}


@router.delete("/prices/{price_id}")
async def delete_branch_price(
    price_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    ok = await service.delete_branch_price(db, price_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Price not found")
    return {"message": "Price deleted"}


@router.post("/transfers", response_model=BranchTransferResponse)
async def create_transfer(
    data: BranchTransferCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    transfer = await service.create_transfer(db, user["company_id"], data, user["id"])
    return _build_transfer_response_sync(transfer)


@router.get("/transfers", response_model=list[BranchTransferResponse])
async def list_transfers(
    estado: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    transfers = await service.list_transfers(db, user["company_id"], estado=estado)
    return [_build_transfer_response_sync(t) for t in transfers]


@router.get("/transfers/{transfer_id}", response_model=BranchTransferResponse)
async def get_transfer(
    transfer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    transfer = await service.get_transfer(db, transfer_id)
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    return _build_transfer_response_sync(transfer)


@router.post("/transfers/{transfer_id}/receive", response_model=BranchTransferResponse)
async def receive_transfer(
    transfer_id: str,
    data: TransferReceiveInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        transfer = await service.receive_transfer(db, transfer_id, data.items, user["id"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _build_transfer_response_sync(transfer)


@router.post("/transfers/{transfer_id}/send", response_model=BranchTransferResponse)
async def send_transfer(
    transfer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    transfer = await service.get_transfer(db, transfer_id)
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if transfer.estado != "pendiente":
        raise HTTPException(status_code=400, detail=f"Transfer must be 'pendiente' to send, current: {transfer.estado}")
    transfer.estado = "en_transito"
    await db.commit()
    await db.refresh(transfer)
    return _build_transfer_response_sync(transfer)


@router.get("/dashboard", response_model=ConsolidatedDashboard)
async def consolidated_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_consolidated_dashboard(db, user["company_id"])


@router.get("/commercial-targets/matrix")
async def get_commercial_targets_matrix(
    branch_id: Optional[str] = None,
    periodo: str = "2026-08",
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_commercial_targets_matrix(
        db=db,
        company_id=user["company_id"],
        branch_id=branch_id,
        periodo=periodo,
    )


# ── Branch CRUD (with /{branch_id} param) ────────────────────

@router.post("", response_model=BranchResponse)
async def create_branch(
    data: BranchCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_branch(db, data)


@router.get("", response_model=list[BranchResponse])
async def list_branches(
    activo: bool | None = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_branches(db, user["company_id"], activo=activo)


@router.get("/{branch_id}", response_model=BranchResponse)
async def get_branch(
    branch_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    branch = await service.get_branch(db, branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    return branch


@router.patch("/{branch_id}", response_model=BranchResponse)
async def update_branch(
    branch_id: str,
    data: BranchUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    branch = await service.update_branch(db, branch_id, data)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    return branch


@router.delete("/{branch_id}")
async def delete_branch(
    branch_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    success = await service.delete_branch(db, branch_id)
    if not success:
        raise HTTPException(status_code=404, detail="Branch not found")
    return {"message": "Branch deleted"}


@router.get("/{branch_id}/prices", response_model=list[BranchPriceResponse])
async def list_branch_prices(
    branch_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_branch_prices(db, user["company_id"], branch_id=branch_id)


# ── Helpers ───────────────────────────────────────────────────

def _build_transfer_response_sync(transfer):
    items = []
    for it in (transfer.items or []):
        items.append({
            "id": str(it.id),
            "product_id": str(it.product_id),
            "cantidad": it.cantidad,
            "costo_unitario": float(it.costo_unitario) if it.costo_unitario else None,
            "cantidad_recibida": it.cantidad_recibida,
        })
    return {
        "id": str(transfer.id),
        "company_id": str(transfer.company_id),
        "origen_branch_id": str(transfer.origen_branch_id),
        "destino_branch_id": str(transfer.destino_branch_id),
        "numero": transfer.numero,
        "estado": transfer.estado,
        "notas": transfer.notas,
        "transportista": transfer.transportista,
        "created_by": str(transfer.created_by) if transfer.created_by else None,
        "approved_by": str(transfer.approved_by) if transfer.approved_by else None,
        "items": items,
        "created_at": transfer.created_at,
        "updated_at": transfer.updated_at,
    }
