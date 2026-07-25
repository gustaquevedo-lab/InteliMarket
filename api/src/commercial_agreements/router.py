from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.commercial_agreements import service
from api.src.commercial_agreements.schemas import AgreementCreate, AgreementUpdate

router = APIRouter(prefix="/api/v1", tags=["commercial-agreements"])


@router.post("/commercial-agreements")
async def create_agreement(body: AgreementCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_agreement(db, body)


@router.get("/companies/{company_id}/commercial-agreements")
async def list_agreements(
    company_id: str,
    supplier_id: str | None = Query(None),
    estado: str | None = Query(None),
    vigentes: bool | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_agreements(db, company_id, supplier_id, estado, vigentes, limit, offset)


@router.get("/companies/{company_id}/commercial-agreements/expiring")
async def agreements_expiring(
    company_id: str, dias: int = Query(30), db: AsyncSession = Depends(get_db),
):
    return await service.get_agreements_expiring(db, company_id, dias)


@router.get("/commercial-agreements/{agreement_id}")
async def get_agreement(agreement_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.get_agreement_with_items(db, agreement_id)
    if not result:
        raise HTTPException(status_code=404, detail="Acuerdo no encontrado")
    return result


@router.put("/commercial-agreements/{agreement_id}")
async def update_agreement(agreement_id: str, body: AgreementUpdate, db: AsyncSession = Depends(get_db)):
    result = await service.update_agreement(db, agreement_id, body)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo actualizar el acuerdo")
    return result


@router.post("/commercial-agreements/{agreement_id}/approve")
async def approve_agreement(agreement_id: str, aprobado_por: str = Query(...), db: AsyncSession = Depends(get_db)):
    result = await service.approve_agreement(db, agreement_id, aprobado_por)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo aprobar el acuerdo")
    return result


@router.post("/commercial-agreements/{agreement_id}/activate")
async def activate_agreement(agreement_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.activate_agreement(db, agreement_id)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo activar el acuerdo")
    return result


@router.post("/commercial-agreements/{agreement_id}/renew")
async def renew_agreement(agreement_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.renew_agreement(db, agreement_id)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo renovar el acuerdo")
    return result


@router.post("/commercial-agreements/{agreement_id}/cancel")
async def cancel_agreement(agreement_id: str, motivo: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    result = await service.cancel_agreement(db, agreement_id, motivo)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo cancelar el acuerdo")
    return result


@router.get("/commercial-agreements/{agreement_id}/summary")
async def agreement_summary(agreement_id: str, db: AsyncSession = Depends(get_db)):
    agreement = await service.get_agreement(db, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Acuerdo no encontrado")
    pct = await service.calculate_execution_percentage(db, agreement_id)
    return {
        "agreement": agreement,
        "porcentaje_ejecucion": pct,
        "monto_restante": float((agreement.monto_total_acordado or 0) - (agreement.monto_ejecutado or 0)),
    }


@router.post("/commercial-agreements/{agreement_id}/items")
async def add_agreement_item(
    agreement_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    from api.src.commercial_agreements.schemas import AgreementItemInput
    data = AgreementItemInput(**body)
    result = await service.add_agreement_item(db, agreement_id, data)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo agregar el item")
    return result


@router.delete("/commercial-agreements/items/{item_id}")
async def remove_agreement_item(item_id: str, db: AsyncSession = Depends(get_db)):
    deleted = await service.remove_agreement_item(db, item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    return {"message": "Item eliminado"}


@router.get("/companies/{company_id}/rebates/pending")
async def pending_rebates(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_pending_rebates(db, company_id)


@router.post("/rebates/{rebate_id}/liquidate")
async def liquidate_rebate(rebate_id: str, aprobado_por: str = Query(...), db: AsyncSession = Depends(get_db)):
    result = await service.liquidate_rebate(db, rebate_id, aprobado_por)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo liquidar el rebate")
    return result


@router.get("/suppliers/{supplier_id}/volume-summary")
async def volume_summary(supplier_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        service.text("""
            SELECT av.*, ca.nombre as agreement_name, ca.numero as agreement_numero
            FROM agreement_volumes av
            JOIN commercial_agreements ca ON ca.id = av.agreement_id
            WHERE av.supplier_id = :sid
            ORDER BY av.periodo DESC
            LIMIT 24
        """),
        {"sid": supplier_id},
    )
    return [dict(row._mapping) for row in result.fetchall()]


@router.post("/supplier-negotiations")
async def create_negotiation(body: dict, db: AsyncSession = Depends(get_db)):
    from api.src.commercial_agreements.schemas import SupplierNegotiationCreate
    data = SupplierNegotiationCreate(**body)
    return await service.create_negotiation(db, data)


@router.get("/companies/{company_id}/supplier-negotiations")
async def list_negotiations(
    company_id: str,
    supplier_id: str | None = Query(None),
    estado: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_negotiations(db, company_id, supplier_id, estado)


@router.post("/supplier-negotiations/{negotiation_id}/close")
async def close_negotiation(
    negotiation_id: str,
    precio_final: float | None = Query(None),
    estado: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    from decimal import Decimal
    result = await service.close_negotiation(
        db, negotiation_id,
        Decimal(str(precio_final)) if precio_final else None,
        estado,
    )
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo cerrar la negociación")
    return result


@router.get("/suppliers/{supplier_id}/commercial-summary")
async def commercial_summary(supplier_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_supplier_commercial_summary(db, supplier_id)


@router.get("/suppliers/{supplier_id}/price-competitiveness")
async def price_competitiveness(supplier_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_supplier_price_competitiveness(db, supplier_id)


@router.get("/companies/{company_id}/agreements/by-supplier")
async def agreements_by_supplier(company_id: str, db: AsyncSession = Depends(get_db)):
    return await service.get_agreements_by_supplier(db, company_id)
