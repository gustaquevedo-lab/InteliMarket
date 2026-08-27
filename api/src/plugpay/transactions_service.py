from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from api.src.plugpay.models import PlugpayTransaction


async def log_transaction(db: AsyncSession, company_id: str, **kwargs) -> PlugpayTransaction:
    row = PlugpayTransaction(company_id=uuid.UUID(company_id), **kwargs)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def link_sale(db: AsyncSession, txn_id: str, sale_id: str) -> PlugpayTransaction | None:
    result = await db.execute(select(PlugpayTransaction).where(PlugpayTransaction.id == uuid.UUID(txn_id)))
    row = result.scalar_one_or_none()
    if not row:
        return None
    row.sale_id = uuid.UUID(sale_id)
    await db.commit()
    await db.refresh(row)
    return row
