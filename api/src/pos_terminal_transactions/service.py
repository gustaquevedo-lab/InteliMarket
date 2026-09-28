from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.pos_terminal_transactions.models import PosTerminalTransaction
from api.src.pos_terminal_transactions.schemas import PosTerminalTransactionCreate, PosTerminalTransactionUpdate


def _sanitize_txn_data(d: dict) -> dict:
    if "nombre_cliente" in d and d["nombre_cliente"]:
        d["nombre_cliente"] = str(d["nombre_cliente"])[:255]
    if "mensaje_display" in d and d["mensaje_display"]:
        d["mensaje_display"] = str(d["mensaje_display"])[:255]
    if "nombre_tarjeta" in d and d["nombre_tarjeta"]:
        d["nombre_tarjeta"] = str(d["nombre_tarjeta"])[:100]
    return d


async def create_transaction(db: AsyncSession, company_id: str, data: PosTerminalTransactionCreate) -> PosTerminalTransaction:
    raw = _sanitize_txn_data(data.model_dump())
    txn = PosTerminalTransaction(company_id=company_id, **raw)
    db.add(txn)
    await db.commit()
    await db.refresh(txn)
    return txn


async def update_transaction(db: AsyncSession, txn_id: str, data: PosTerminalTransactionUpdate) -> PosTerminalTransaction | None:
    result = await db.execute(select(PosTerminalTransaction).where(PosTerminalTransaction.id == txn_id))
    txn = result.scalar_one_or_none()
    if not txn:
        return None
    update_data = _sanitize_txn_data(data.model_dump(exclude_unset=True))
    for k, v in update_data.items():
        setattr(txn, k, v)
    await db.commit()
    await db.refresh(txn)
    return txn
