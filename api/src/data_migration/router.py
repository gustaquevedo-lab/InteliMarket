"""Data migration router"""

from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.data_migration import service
from api.src.data_migration.schemas import MigrationPreview, MigrationLogResponse

router = APIRouter(prefix="/api/v1/migration", tags=["migration"])


@router.post("/preview", response_model=MigrationPreview)
async def preview(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.preview_file(db, user["company_id"], file)


@router.post("/import")
async def import_data(
    file: UploadFile = File(...),
    tipo: str = Form(...),
    column_mapping: str = Form(...),
    skip_header: bool = Form(True),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    import json
    try:
        mapping = json.loads(column_mapping)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="column_mapping debe ser un JSON valido")

    if tipo not in ("clientes", "productos", "proveedores", "ventas", "saldos"):
        raise HTTPException(status_code=400, detail=f"Tipo invalido: {tipo}")

    return await service.import_data(db, user["company_id"], file, tipo, mapping, skip_header)


@router.get("/logs", response_model=list[MigrationLogResponse])
async def list_logs(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_migration_logs(db, user["company_id"])

