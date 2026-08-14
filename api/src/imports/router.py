"""Import router"""

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.imports import service
from api.src.imports.schemas import ImportResult

router = APIRouter(prefix="/api/v1/imports", tags=["imports"])


@router.post("/products", response_model=ImportResult)
async def import_products(
    file: UploadFile = File(...),
    delimiter: str = Form(";"),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos CSV")
    content = await file.read()
    return await service.import_products(db, user["company_id"], content, delimiter=delimiter)


@router.post("/customers", response_model=ImportResult)
async def import_customers(
    file: UploadFile = File(...),
    delimiter: str = Form(";"),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos CSV")
    content = await file.read()
    return await service.import_customers(db, user["company_id"], content, delimiter=delimiter)


@router.post("/preview")
async def preview_import(
    file: UploadFile = File(...),
    delimiter: str = Form(";"),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos CSV")
    content = await file.read()
    return await service.preview_file(content, delimiter=delimiter)


@router.get("/template/{tipo}")
async def download_template(tipo: str):
    if tipo == "products":
        headers = "sku;nombre;codigo_barra;descripcion;unidad_medida;iva_tasa;stock_minimo;categoria_id\n"
        example = "PROD-001;Producto Ejemplo;123456789;Descripcion del producto;unidad;10;5;\n"
    elif tipo == "customers":
        headers = "razon_social;ruc;ci;tipo_persona;direccion;ciudad;telefono;email;credito_limite\n"
        example = "Juan Perez;80012345-6;1234567;fisica;Av. España 123;Asuncion;021123456;juan@email.com;5000000\n"
    else:
        raise HTTPException(status_code=400, detail="Tipo no válido. Use 'products' o 'customers'")

    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(
        content=headers + example,
        headers={"Content-Disposition": f"attachment; filename=template_{tipo}.csv"},
    )
