"""Router de impresion de etiquetas -- config de impresoras (Pantum/Zebra),
plantillas de campos y resolucion/impresion de etiquetas."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.label_printing import service, qz_signing, tspl, calibracion
from api.src.label_printing.schemas import (
    LabelPrinterConfigUpsert, LabelPrinterConfigResponse,
    LabelTemplateCreate, LabelTemplateResponse,
    LabelSourceFilter, ResolvedLabelItem,
    PrintZebraRequest, PrintZebraResponse,
    PrintPantumRequest, PrintPantumResponse,
    QzSignRequest, QzSignResponse, QzCertificateResponse,
)

router = APIRouter(prefix="/api/v1/label-printing", tags=["label-printing"])

ALLOWED_TIPOS = {"pantum_rollo", "zebra_zpl"}


@router.get("/qz-certificate", response_model=QzCertificateResponse)
async def get_qz_certificate():
    # SIN autenticacion a proposito: un certificado publico esta hecho para
    # distribuirse (no lleva la clave privada). Pedirle login solo agregaba un
    # modo de falla confuso -- al expirar la sesion, QZ dejaba de recibir la
    # identidad, volvia a tratar la conexion como anonima y reaparecia el
    # dialogo de permiso, en vez de avisar que habia que loguearse de nuevo.
    # Lo que si queda protegido es /qz-sign, que usa la clave privada.
    """Certificado publico de InteliMarket para QZ Tray -- permite que QZ
    identifique al sitio de forma persistente en vez de tratarlo como una
    conexion anonima (con anonima, QZ Tray no deja tildar "Remember")."""
    return QzCertificateResponse(certificate=qz_signing.get_certificate_pem())


@router.post("/qz-sign", response_model=QzSignResponse)
async def sign_qz_request(data: QzSignRequest, user=Depends(require_auth)):
    """Firma un pedido de impresion con la clave privada del servidor -- la
    clave nunca sale de aca, solo la firma resultante viaja al navegador."""
    return QzSignResponse(signature=qz_signing.sign_request(data.request))


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


@router.post("/print/pantum", response_model=PrintPantumResponse)
async def print_pantum(data: PrintPantumRequest, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    """Genera los comandos TSPL de la cola de etiquetas para la Pantum.

    El frontend los manda tal cual a la impresora via QZ Tray en modo raw. No
    se rasteriza nada: TSPL posiciona en dots contra la calibracion real del
    rollo, y el codigo de barras lo dibuja el firmware de la impresora.
    """
    cfg = await service.get_printer_config(db, user["company_id"], "pantum_rollo")
    if not cfg:
        raise HTTPException(status_code=400, detail="No hay una impresora Pantum configurada para esta empresa")

    comandos = tspl.generate_tspl(data.items, data.campos, cfg)
    total = sum(max(1, int(i.cantidad or 1)) for i in data.items)
    return PrintPantumResponse(tspl=comandos, etiquetas=total)


@router.post("/calibracion/{tipo}")
async def imprimir_regla_calibracion(tipo: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    """Devuelve los comandos de una regla milimetrica para calibrar.

    Se mide con una regla comun sobre la etiqueta impresa: donde cae la ultima
    marca da la escala real del eje, y si el marco coincide con el troquel
    confirma el tamano declarado. Es la unica forma confiable de sacar los
    dots/mm -- asumirlos deforma la etiqueta (a la Pantum le medimos 8 en el
    eje horizontal pero 8.889 en el vertical).
    """
    if tipo not in ALLOWED_TIPOS:
        raise HTTPException(status_code=404, detail="Tipo de impresora desconocido")
    cfg = await service.get_printer_config(db, user["company_id"], tipo)
    if not cfg:
        raise HTTPException(status_code=400, detail="Esa impresora no esta configurada todavia")
    comandos = calibracion.regla_tspl(cfg) if tipo == "pantum_rollo" else calibracion.regla_zpl(cfg)
    return {"comandos": comandos, "printer_name": cfg.qz_printer_name}
