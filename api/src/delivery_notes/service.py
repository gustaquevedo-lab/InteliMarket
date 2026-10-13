from typing import Optional
import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.delivery_notes.models import DeliveryNote
from api.src.delivery_notes.schemas import DeliveryNoteCreate, DeliveryNoteApplyInput


class DeliveryNoteService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: DeliveryNoteCreate, created_by: Optional[str] = None) -> DeliveryNote:
        note = DeliveryNote(
            company_id=uuid.UUID(data.company_id),
            customer_id=uuid.UUID(data.customer_id),
            sale_id=uuid.UUID(data.sale_id) if data.sale_id else None,
            numero_nota=data.numero_nota,
            numero_factura_ref=data.numero_factura_ref,
            fecha=data.fecha,
            monto=data.monto,
            concepto=data.concepto,
            descripcion=data.descripcion,
            vendedor_id=uuid.UUID(data.vendedor_id) if data.vendedor_id else None,
            cobrador_id=uuid.UUID(data.cobrador_id) if data.cobrador_id else None,
            estado="pendiente",
            created_by=uuid.UUID(created_by) if created_by else None,
        )
        self.db.add(note)
        await self.db.commit()
        await self.db.refresh(note)
        return note

    async def list(
        self,
        company_id: str,
        estado: Optional[str] = None,
        concepto: Optional[str] = None,
        customer_id: Optional[str] = None,
    ) -> list[DeliveryNote]:
        stmt = select(DeliveryNote).where(DeliveryNote.company_id == uuid.UUID(company_id))
        if estado:
            stmt = stmt.where(DeliveryNote.estado == estado)
        if concepto:
            stmt = stmt.where(DeliveryNote.concepto == concepto)
        if customer_id:
            stmt = stmt.where(DeliveryNote.customer_id == uuid.UUID(customer_id))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get(self, note_id: uuid.UUID) -> Optional[DeliveryNote]:
        result = await self.db.execute(select(DeliveryNote).where(DeliveryNote.id == note_id))
        return result.scalar_one_or_none()

    async def apply(
        self,
        note_id: uuid.UUID,
        data: DeliveryNoteApplyInput,
        created_by: Optional[str] = None,
    ) -> DeliveryNote:
        result = await self.db.execute(select(DeliveryNote).where(DeliveryNote.id == note_id))
        note = result.scalar_one_or_none()
        if not note:
            raise HTTPException(status_code=404, detail="Nota de crédito no encontrada")
        if note.estado != "pendiente":
            raise HTTPException(
                status_code=409,
                detail=f"La nota de crédito ya está en estado '{note.estado}', no se puede aplicar",
            )
        note.estado = "aplicada"
        note.aplicada_en_cobro_id = uuid.UUID(data.cobro_id)
        await self.db.commit()
        await self.db.refresh(note)
        return note

    async def cancel(self, note_id: uuid.UUID, created_by: Optional[str] = None) -> DeliveryNote:
        result = await self.db.execute(select(DeliveryNote).where(DeliveryNote.id == note_id))
        note = result.scalar_one_or_none()
        if not note:
            raise HTTPException(status_code=404, detail="Nota de crédito no encontrada")
        if note.estado == "aplicada":
            raise HTTPException(
                status_code=409,
                detail="La nota ya fue aplicada a un cobro; no se puede anular",
            )
        note.estado = "anulada"
        await self.db.commit()
        await self.db.refresh(note)
        return note
