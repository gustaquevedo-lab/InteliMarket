from datetime import datetime
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.rbac.deps import require_permission
from api.src.price_lists import service
from api.src.price_lists.schemas import (
    PriceListCreate, PriceListUpdate, PriceListResponse,
    PriceListItemCreate, PriceListItemUpdate, PriceListItemResponse,
    PriceVariationsResponse,
)

router = APIRouter(prefix="/api/v1/price-lists", tags=["price-lists"])


class AuditSaveRequest(BaseModel):
    decisiones: list[dict]


@router.get("/audit-state")
async def get_audit_state(db: AsyncSession = Depends(get_db)):
    """Obtiene el estado de decisiones de la auditoría de precios guardado en el servidor."""
    return await service.get_audit_state(db)


@router.post("/audit-save")
async def save_audit_state(body: AuditSaveRequest, db: AsyncSession = Depends(get_db)):
    """Guarda de forma persistente un lote de decisiones de auditoría de precios en el servidor."""
    return await service.save_audit_decisions(db, body.decisiones)


@router.post("/audit-reset")
async def reset_audit_state(db: AsyncSession = Depends(get_db)):
    """Reinicia todas las decisiones de la auditoría guardadas en el servidor."""
    return await service.reset_audit_decisions(db)


@router.post("/audit-apply")
async def apply_audit_state(db: AsyncSession = Depends(get_db)):
    """Aplica de forma atómica y definitiva los cambios de precios auditados en la base de datos de producción."""
    return await service.apply_audit_decisions(db, "00000000-0000-0000-0000-000000000010")


@router.get("/variations", response_model=PriceVariationsResponse)
async def list_variations(
    fecha_desde: str | None = Query(None),
    fecha_hasta: str | None = Query(None),
    tipo: str | None = Query(None),
    search: str | None = Query(None),
    order_by: str = Query("fecha_desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_price_variations(
        db, user["company_id"], fecha_desde, fecha_hasta, tipo, search, order_by, page, page_size
    )


@router.get("/variations/export/csv")
async def export_variations_csv(
    fecha_desde: str | None = Query(None),
    fecha_hasta: str | None = Query(None),
    tipo: str | None = Query(None),
    search: str | None = Query(None),
    order_by: str = Query("fecha_desc"),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    items = await service.get_price_variations_for_export(
        db, user["company_id"], fecha_desde, fecha_hasta, tipo, search, order_by
    )
    from api.src.price_lists.pdf_reports import generate_price_variations_csv
    csv_content = generate_price_variations_csv(items)
    now_str = datetime.now().strftime("%Y%m%d_%H%M")
    return Response(
        content=csv_content.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="variaciones_precios_{now_str}.csv"'},
    )


@router.get("/variations/export/pdf")
async def export_variations_pdf(
    fecha_desde: str | None = Query(None),
    fecha_hasta: str | None = Query(None),
    tipo: str | None = Query(None),
    search: str | None = Query(None),
    order_by: str = Query("fecha_desc"),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    items = await service.get_price_variations_for_export(
        db, user["company_id"], fecha_desde, fecha_hasta, tipo, search, order_by
    )
    from api.src.price_lists.pdf_reports import generate_price_variations_pdf
    company = {
        "nombre": "Extra Supermercado Mayorista",
        "razon_social": "GRUPO SANTA TERESA E.A.S.",
        "ruc": "80150377-9",
    }
    user_name = user.get("nombre") or user.get("username") or "Administrador"
    pdf_bytes = generate_price_variations_pdf(
        company, items, fecha_desde, fecha_hasta, tipo, generated_by=user_name
    )
    now_str = datetime.now().strftime("%Y%m%d_%H%M")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="reporte_variaciones_precios_{now_str}.pdf"'},
    )



@router.get("/tiers-summary")
async def tiers_summary(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_tiers_summary(db, user["company_id"])


@router.get("/products-with-tiers")
async def products_with_tiers(
    search: str | None = Query(None),
    min_qty: int | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_products_with_tiers(db, user["company_id"], search, min_qty, limit, offset)


@router.get("/lookup")
async def lookup_price(
    customer_id: str, product_id: str, quantity: float = 1,
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    return await service.resolve_customer_price(db, user["company_id"], customer_id, product_id, quantity)


@router.post("", response_model=PriceListResponse)
async def create_pl(data: PriceListCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth), _=Depends(require_permission("price_lists:manage"))):
    data.company_id = user["company_id"]
    return await service.create_price_list(db, data)


@router.get("", response_model=list[PriceListResponse])
async def list_pls(db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.list_price_lists(db, user["company_id"])


@router.get("/{pl_id}", response_model=PriceListResponse)
async def get_pl(pl_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    pl = await service.get_price_list(db, pl_id)
    if not pl:
        raise HTTPException(status_code=404)
    return pl


@router.patch("/{pl_id}", response_model=PriceListResponse)
async def update_pl(pl_id: str, data: PriceListUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_auth), _=Depends(require_permission("price_lists:manage"))):
    pl = await service.update_price_list(db, pl_id, data)
    if not pl:
        raise HTTPException(status_code=404)
    return pl


@router.delete("/{pl_id}")
async def delete_pl(pl_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth), _=Depends(require_permission("price_lists:manage"))):
    ok = await service.delete_price_list(db, pl_id)
    if not ok:
        raise HTTPException(status_code=404)
    return {"message": "Deleted"}


@router.post("/{pl_id}/items", response_model=PriceListItemResponse)
async def add_item(pl_id: str, data: PriceListItemCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth), _=Depends(require_permission("price_lists:manage"))):
    data.price_list_id = pl_id
    return await service.add_item(db, data)


@router.get("/{pl_id}/items", response_model=list[PriceListItemResponse])
async def list_items(pl_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.list_items(db, pl_id)


@router.patch("/items/{item_id}", response_model=PriceListItemResponse)
async def update_item(item_id: str, data: PriceListItemUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_auth), _=Depends(require_permission("price_lists:manage"))):
    item = await service.update_item(db, item_id, data)
    if not item:
        raise HTTPException(status_code=404)
    return item


@router.delete("/items/{item_id}")
async def delete_item(item_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth), _=Depends(require_permission("price_lists:manage"))):
    ok = await service.delete_item(db, item_id)
    if not ok:
        raise HTTPException(status_code=404)
    return {"message": "Deleted"}
