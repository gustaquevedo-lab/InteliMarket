from decimal import Decimal
from typing import Optional
import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.pagares.models import Pagare, PagarePayment
from api.src.pagares.schemas import PagareCreate, PagarePayInput, PagareProtestInput


class PagareService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: PagareCreate, created_by: Optional[str] = None) -> Pagare:
        pagare = Pagare(
            company_id=uuid.UUID(data.company_id),
            customer_id=uuid.UUID(data.customer_id),
            receivable_account_id=uuid.UUID(data.receivable_account_id) if data.receivable_account_id else None,
            numero_pagare=data.numero_pagare,
            monto_original=data.monto_original,
            saldo_pendiente=data.monto_original,
            fecha_emision=data.fecha_emision,
            fecha_vencimiento=data.fecha_vencimiento,
            motivo=data.motivo,
            estado="vigente",
            cobrador_id=uuid.UUID(data.cobrador_id) if data.cobrador_id else None,
            created_by=uuid.UUID(created_by) if created_by else None,
        )
        self.db.add(pagare)
        await self.db.commit()
        await self.db.refresh(pagare)
        return pagare

    async def list(
        self,
        company_id: str,
        estado: Optional[str] = None,
        cobrador_id: Optional[str] = None,
    ) -> list[Pagare]:
        stmt = select(Pagare).where(Pagare.company_id == uuid.UUID(company_id))
        if estado:
            stmt = stmt.where(Pagare.estado == estado)
        if cobrador_id:
            stmt = stmt.where(Pagare.cobrador_id == uuid.UUID(cobrador_id))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get(self, pagare_id: uuid.UUID) -> Optional[Pagare]:
        result = await self.db.execute(select(Pagare).where(Pagare.id == pagare_id))
        return result.scalar_one_or_none()

    async def pay(
        self, pagare_id: uuid.UUID, data: PagarePayInput, created_by: Optional[str] = None
    ) -> Pagare:
        result = await self.db.execute(select(Pagare).where(Pagare.id == pagare_id))
        pagare = result.scalar_one_or_none()
        if not pagare:
            raise HTTPException(status_code=404, detail="Pagaré no encontrado")
        if pagare.estado != "vigente":
            raise HTTPException(status_code=409, detail=f"El pagaré está en estado '{pagare.estado}', no se puede cobrar")
        if data.monto > pagare.saldo_pendiente:
            raise HTTPException(
                status_code=422,
                detail=f"El monto {data.monto} supera el saldo pendiente {pagare.saldo_pendiente}",
            )
        payment = PagarePayment(
            pagare_id=pagare.id,
            monto_aplicado=data.monto,
            fecha=data.fecha,
            observaciones=data.observaciones,
            created_by=uuid.UUID(created_by) if created_by else None,
        )
        self.db.add(payment)
        pagare.saldo_pendiente = pagare.saldo_pendiente - data.monto
        if pagare.saldo_pendiente <= Decimal("0"):
            pagare.estado = "pagado"
        await self.db.commit()
        await self.db.refresh(pagare)
        return pagare

    async def protest(
        self, pagare_id: uuid.UUID, data: PagareProtestInput, created_by: Optional[str] = None
    ) -> Pagare:
        result = await self.db.execute(select(Pagare).where(Pagare.id == pagare_id))
        pagare = result.scalar_one_or_none()
        if not pagare:
            raise HTTPException(status_code=404, detail="Pagaré no encontrado")
        if pagare.estado != "vigente":
            raise HTTPException(status_code=409, detail=f"Solo se pueden protestar pagarés vigentes (estado actual: {pagare.estado})")
        pagare.estado = "protestado"
        pagare.motivo = data.motivo
        await self.db.commit()
        await self.db.refresh(pagare)
        return pagare
