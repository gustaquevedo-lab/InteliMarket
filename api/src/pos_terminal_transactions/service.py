from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.pos_terminal_transactions.models import PosTerminalTransaction
from api.src.pos_terminal_transactions.schemas import PosTerminalTransactionCreate, PosTerminalTransactionUpdate


async def create_transaction(db: AsyncSession, company_id: str, data: PosTerminalTransactionCreate) -> PosTerminalTransaction:
    txn = PosTerminalTransaction(company_id=company_id, **data.model_dump())
    db.add(txn)
    await db.commit()
    await db.refresh(txn)
    return txn


async def update_transaction(db: AsyncSession, txn_id: str, data: PosTerminalTransactionUpdate) -> PosTerminalTransaction | None:
    result = await db.execute(select(PosTerminalTransaction).where(PosTerminalTransaction.id == txn_id))
    txn = result.scalar_one_or_none()
    if not txn:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(txn, k, v)
    await db.commit()
    await db.refresh(txn)
    return txn
