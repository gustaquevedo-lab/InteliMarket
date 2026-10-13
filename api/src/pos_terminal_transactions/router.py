from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.pos_terminal_transactions import service
from api.src.pos_terminal_transactions.schemas import (
    PosTerminalTransactionCreate, PosTerminalTransactionUpdate, PosTerminalTransactionResponse,
)

router = APIRouter(prefix="/api/v1/pos-terminal-transactions", tags=["pos-terminal-transactions"])


@router.post("", response_model=PosTerminalTransactionResponse)
async def create_txn(data: PosTerminalTransactionCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.create_transaction(db, user["company_id"], data)


@router.patch("/{txn_id}", response_model=PosTerminalTransactionResponse)
async def update_txn(txn_id: str, data: PosTerminalTransactionUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    txn = await service.update_transaction(db, txn_id, data)
    if not txn:
        raise HTTPException(status_code=404)
    return txn
