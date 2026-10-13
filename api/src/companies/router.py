"""Company API router"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.companies.schemas import CompanyCreate, CompanyUpdate, CompanyResponse
from api.src.companies import service

router = APIRouter(prefix="/api/v1/companies", tags=["companies"], dependencies=[Depends(require_auth)])


@router.post("", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_company(body: CompanyCreate, db: AsyncSession = Depends(get_db)):
    existing = await service.get_company_by_ruc(db, body.ruc)
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una empresa con ese RUC")
    return await service.create_company(db, body)


@router.get("", response_model=list[CompanyResponse])
async def list_companies(db: AsyncSession = Depends(get_db)):
    return await service.list_companies(db)


@router.get("/{company_id}", response_model=CompanyResponse)
async def get_company(company_id: str, db: AsyncSession = Depends(get_db)):
    company = await service.get_company(db, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return company


@router.patch("/{company_id}", response_model=CompanyResponse)
async def update_company(company_id: str, body: CompanyUpdate, db: AsyncSession = Depends(get_db)):
    company = await service.update_company(db, company_id, body)
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return company


from fastapi import UploadFile, File
import time
import shutil
from pathlib import Path

@router.post("/{company_id}/logo", response_model=CompanyResponse)
async def upload_company_logo(
    company_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Sube cualquier archivo de imagen, realiza auto-crop, redimensionado inteligente
    (máx 600px de ancho) y optimización en formato PNG de alta fidelidad,
    guardándolo en /uploads/logos/ y asociándolo a la empresa.
    """
    import io
    from PIL import Image, ImageOps
    from pathlib import Path
    
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="El archivo está vacío.")
    
    try:
        image = Image.open(io.BytesIO(content))
        image = ImageOps.exif_transpose(image)
    except Exception as img_err:
        raise HTTPException(status_code=400, detail=f"Formato de imagen inválido: {str(img_err)}")
    
    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        image = image.convert("RGBA")
    else:
        image = image.convert("RGB")
        
    try:
        max_w, max_h = 600, 300
        image.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
    except Exception:
        pass
        
    upload_dir = Path("uploads/logos")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    filename = f"logo_{company_id}.png"
    file_path = upload_dir / filename
    
    image.save(file_path, format="PNG", optimize=True)
    
    logo_url = f"/uploads/logos/{filename}?t={int(time.time())}"
    
    company = await service.update_company(db, company_id, CompanyUpdate(logo_url=logo_url))
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return company


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_company(company_id: str, db: AsyncSession = Depends(get_db)):
    deleted = await service.delete_company(db, company_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
