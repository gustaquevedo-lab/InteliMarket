"""Router de impresion de etiquetas -- config de impresoras (Pantum/Zebra),
plantillas de campos y resolucion/impresion de etiquetas."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.label_printing import service
from api.src.label_printing.schemas import (
    LabelPrinterConfigUpsert, LabelPrinterConfigResponse,
    LabelTemplateCreate, LabelTemplateResponse,
    LabelSourceFilter, ResolvedLabelItem,
    PrintZebraRequest, PrintZebraResponse,
)

router = APIRouter(prefix="/api/v1/label-printing", tags=["label-printing"])

ALLOWED_TIPOS = {"pantum_rollo", "zebra_zpl"}


@router.get("/printer-config/{tipo}", response_model=LabelPrinterConfigResponse | None)
async def get_printer_config(tipo: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    if tipo not in ALLOWED_TIPOS:
        raise HTTPException(status_code=404, detail="Tipo de impresora desconocido")
    row = await service.get_printer_config(db, user["company_id"], tipo)
    return row


@router.put("/printer-config/{tipo}", response_model=LabelPrinterConfigResponse)
async def upsert_printer_config(tipo: str, data: LabelPrinterConfigUpsert, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    if tipo not in ALLOWED_TIPOS:
        raise HTTPException(status_code=404, detail="Tipo de impresora desconocido")
    return await service.upsert_printer_config(db, user["company_id"], tipo, data)


@router.get("/templates", response_model=list[LabelTemplateResponse])
async def list_templates(tipo_impresora: str | None = None, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.list_templates(db, user["company_id"], tipo_impresora)


@router.post("/templates", response_model=LabelTemplateResponse)
async def create_template(data: LabelTemplateCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.create_template(db, user["company_id"], data)


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    ok = await service.delete_template(db, user["company_id"], template_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    return {"success": True}


@router.post("/resolve", response_model=list[ResolvedLabelItem])
async def resolve_labels(filtro: LabelSourceFilter, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.resolve_label_items(db, user["company_id"], filtro)


@router.post("/print/zebra", response_model=PrintZebraResponse)
async def print_zebra(data: PrintZebraRequest, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    printer_config = await service.get_printer_config(db, user["company_id"], "zebra_zpl")
    if not printer_config:
        raise HTTPException(status_code=400, detail="No hay una impresora Zebra configurada para esta empresa")

    campos = {}
    if data.template_id:
        templates = await service.list_templates(db, user["company_id"], "zebra_zpl")
        match = next((t for t in templates if t.id == data.template_id), None)
        if match:
            campos = match.campos

    zpl = service.generate_zpl(data.items, campos, printer_config)

    if printer_config.conexion == "red_tcp" and printer_config.host and printer_config.puerto_tcp:
        await service.send_zpl_over_tcp(printer_config.host, printer_config.puerto_tcp, zpl)
        return PrintZebraResponse(zpl=zpl, enviado_por_red=True)

    return PrintZebraResponse(zpl=zpl, enviado_por_red=False)
