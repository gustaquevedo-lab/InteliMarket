"""Branch service"""

from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import select, func, and_, text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import uuid

from api.src.branches.models import Branch, BranchPrice, BranchTransfer, BranchTransferItem
from api.src.branches.schemas import (
    BranchCreate, BranchUpdate, BranchPriceUpsert, BranchTransferCreate, TransferReceiveItem,
)


async def create_branch(db: AsyncSession, data: BranchCreate) -> Branch:
    branch = Branch(**data.model_dump())
    db.add(branch)
    await db.commit()
    await db.refresh(branch)
    return branch


async def list_branches(db: AsyncSession, company_id: str, activo: Optional[bool] = None) -> list[Branch]:
    query = select(Branch).where(Branch.company_id == company_id)
    if activo is not None:
        query = query.where(Branch.activo == activo)
    query = query.order_by(Branch.nombre)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_branch(db: AsyncSession, branch_id: str) -> Branch | None:
    result = await db.execute(select(Branch).where(Branch.id == uuid.UUID(branch_id)))
    return result.scalar_one_or_none()


async def update_branch(db: AsyncSession, branch_id: str, data: BranchUpdate) -> Branch | None:
    branch = await get_branch(db, branch_id)
    if not branch:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(branch, key, value)
    await db.commit()
    await db.refresh(branch)
    return branch


async def delete_branch(db: AsyncSession, branch_id: str) -> bool:
    branch = await get_branch(db, branch_id)
    if not branch:
        return False
    await db.delete(branch)
    await db.commit()
    return True


# ── Branch Prices ──────────────────────────────────────────────

async def upsert_branch_price(db: AsyncSession, data: BranchPriceUpsert) -> BranchPrice:
    result = await db.execute(
        select(BranchPrice).where(
            BranchPrice.branch_id == data.branch_id,
            BranchPrice.product_id == data.product_id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.precio = data.precio
        await db.commit()
        await db.refresh(existing)
        return existing
    bp = BranchPrice(branch_id=data.branch_id, product_id=data.product_id, precio=data.precio)
    db.add(bp)
    await db.commit()
    await db.refresh(bp)
    return bp


async def get_branch_prices(
    db: AsyncSession, company_id: str, branch_id: Optional[str] = None
) -> list[dict]:
    query = select(
        BranchPrice.id,
        BranchPrice.branch_id,
        Branch.nombre.label("branch_nombre"),
        BranchPrice.product_id,
        BranchPrice.precio,
        BranchPrice.created_at,
        BranchPrice.updated_at,
    ).join(Branch, Branch.id == BranchPrice.branch_id).where(
        Branch.company_id == company_id
    )
    if branch_id:
        query = query.where(BranchPrice.branch_id == uuid.UUID(branch_id))
    result = await db.execute(query.order_by(Branch.nombre))
    rows = result.all()
    return [
        {
            "id": str(r.id),
            "branch_id": str(r.branch_id),
            "branch_nombre": r.branch_nombre,
            "product_id": str(r.product_id),
            "precio": float(r.precio) if r.precio else 0,
            "created_at": r.created_at,
            "updated_at": r.updated_at,
        }
        for r in rows
    ]


async def delete_branch_price(db: AsyncSession, price_id: str) -> bool:
    result = await db.execute(select(BranchPrice).where(BranchPrice.id == uuid.UUID(price_id)))
    bp = result.scalar_one_or_none()
    if not bp:
        return False
    await db.delete(bp)
    await db.commit()
    return True


# ── Branch Transfers ──────────────────────────────────────────

async def _generate_transfer_numero(db: AsyncSession) -> str:
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    prefix = f"TR{today}-"
    result = await db.execute(
        select(func.coalesce(func.max(BranchTransfer.numero), text("''")))
    )
    max_num = result.scalar() or ""
    seq = 1
    if max_num and max_num.startswith(prefix):
        seq = int(max_num.split("-")[1]) + 1
    return f"{prefix}{seq:04d}"


async def create_transfer(db: AsyncSession, company_id: str, data: BranchTransferCreate, user_id: str) -> BranchTransfer:
    numero = await _generate_transfer_numero(db)
    transfer = BranchTransfer(
        company_id=uuid.UUID(company_id),
        origen_branch_id=data.origen_branch_id,
        destino_branch_id=data.destino_branch_id,
        numero=numero,
        estado="pendiente",
        notas=data.notas,
        transportista=data.transportista,
        created_by=uuid.UUID(user_id),
    )
    db.add(transfer)
    await db.flush()
    for item in data.items:
        ti = BranchTransferItem(
            transfer_id=transfer.id,
            product_id=item.product_id,
            cantidad=item.cantidad,
            costo_unitario=item.costo_unitario,
        )
        db.add(ti)
    await db.commit()
    await db.refresh(transfer)
    return transfer


async def list_transfers(
    db: AsyncSession, company_id: str, estado: Optional[str] = None
) -> list[BranchTransfer]:
    query = select(BranchTransfer).where(BranchTransfer.company_id == uuid.UUID(company_id))
    if estado:
        query = query.where(BranchTransfer.estado == estado)
    query = query.order_by(BranchTransfer.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_transfer(db: AsyncSession, transfer_id: str) -> BranchTransfer | None:
    result = await db.execute(
        select(BranchTransfer).where(BranchTransfer.id == uuid.UUID(transfer_id))
    )
    return result.scalar_one_or_none()


async def receive_transfer(
    db: AsyncSession, transfer_id: str, items_data: list[TransferReceiveItem], user_id: str
) -> BranchTransfer:
    transfer = await get_transfer(db, transfer_id)
    if not transfer:
        raise ValueError("Transfer not found")
    if transfer.estado != "en_transito":
        raise ValueError(f"Transfer must be 'en_transito' to receive, current: {transfer.estado}")

    update_map = {str(i.item_id): i.cantidad_recibida for i in items_data}
    for item in transfer.items:
        if str(item.id) in update_map:
            item.cantidad_recibida = update_map[str(item.id)]

    transfer.estado = "recibido"
    transfer.approved_by = uuid.UUID(user_id)
    await db.commit()
    await db.refresh(transfer)
    return transfer


# ── Consolidated Dashboard ────────────────────────────────────

async def get_consolidated_dashboard(db: AsyncSession, company_id: str) -> dict:
    branches = await list_branches(db, company_id, activo=True)

    result = {
        "total_branches": len(branches),
        "total_ventas": 0,
        "total_stock_valor": 0,
        "transferencias_pendientes": 0,
        "branches": [],
    }

    for branch in branches:
        bid = branch.id
        branch_data = {
            "branch_id": str(bid),
            "branch_nombre": branch.nombre,
            "total_ventas": 0,
            "cantidad_ventas": 0,
            "stock_valor": 0,
            "total_gastos": 0,
        }

        try:
            sales_row = await db.execute(
                text("""
                    SELECT COALESCE(SUM(total), 0) as total_ventas, COUNT(*) as cantidad
                    FROM sales WHERE branch_id = :bid AND estado NOT IN ('anulado', 'cancelado')
                """),
                {"bid": bid},
            )
            s = sales_row.fetchone()
            if s:
                branch_data["total_ventas"] = float(s.total_ventas)
                branch_data["cantidad_ventas"] = int(s.cantidad)
        except Exception:
            pass

        try:
            stock_row = await db.execute(
                text("""
                    SELECT COALESCE(SUM(s.cantidad * s.costo_unitario), 0) as valor
                    FROM stock s
                    JOIN warehouses w ON w.id = s.warehouse_id
                    WHERE w.branch_id = :bid
                """),
                {"bid": bid},
            )
            st = stock_row.fetchone()
            if st:
                branch_data["stock_valor"] = float(st.valor)
        except Exception:
            pass

        result["total_ventas"] += branch_data["total_ventas"]
        result["total_stock_valor"] += branch_data["stock_valor"]
        result["branches"].append(branch_data)

    try:
        pend_row = await db.execute(
            text("SELECT COUNT(*) FROM branch_transfers WHERE company_id = :cid AND estado IN ('pendiente','en_transito')"),
            {"cid": uuid.UUID(company_id)},
        )
        result["transferencias_pendientes"] = int(pend_row.scalar() or 0)
    except Exception:
        pass

    return result
