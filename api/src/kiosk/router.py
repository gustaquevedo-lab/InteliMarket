import io
import time
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.kiosk.schemas import (
    KioskBannerCreate, KioskBannerUpdate, KioskBannerResponse, ProductLookupResponse,
)
from api.src.kiosk import service

router = APIRouter(prefix="/api/v1/kiosk", tags=["kiosk"])


# ── PUBLICOS -- usados por las terminales del salon, sin login ──────────────

@router.get("/lookup", response_model=ProductLookupResponse)
async def lookup_product(
    code: str = Query(...),
    company_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    product = await service.lookup_product(db, company_id, code.strip())
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return product


@router.get("/banners/active", response_model=list[KioskBannerResponse])
async def list_active_banners(company_id: str = Query(...), db: AsyncSession = Depends(get_db)):
    return await service.list_active_banners(db, company_id)


# ── ADMINISTRACION -- panel de marketing, requiere sesion ───────────────────

@router.post("/banners", response_model=KioskBannerResponse, status_code=status.HTTP_201_CREATED)
async def create_banner(body: KioskBannerCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.create_banner(db, user["company_id"], body)


@router.get("/banners", response_model=list[KioskBannerResponse])
async def list_banners(db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.list_banners(db, user["company_id"])


@router.patch("/banners/{banner_id}", response_model=KioskBannerResponse)
async def update_banner(banner_id: str, body: KioskBannerUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    banner = await service.update_banner(db, banner_id, body)
    if not banner:
        raise HTTPException(status_code=404, detail="Banner no encontrado")
    return banner


@router.delete("/banners/{banner_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_banner(banner_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    deleted = await service.delete_banner(db, banner_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Banner no encontrado")


@router.post("/banners/{banner_id}/image", response_model=KioskBannerResponse)
async def upload_banner_image(
    banner_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Sube el creativo de un banner -- redimensiona a un ancho maximo
    generoso (1600px) porque estos se ven en pantalla completa en las
    terminales, a diferencia de un logo chico."""
    from PIL import Image, ImageOps

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

    image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)

    upload_dir = Path("uploads/kiosk_banners")
    upload_dir.mkdir(parents=True, exist_ok=True)
    filename = f"banner_{banner_id}.png"
    image.save(upload_dir / filename, format="PNG", optimize=True)

    imagen_url = f"/uploads/kiosk_banners/{filename}?t={int(time.time())}"
    banner = await service.set_banner_image(db, banner_id, imagen_url)
    if not banner:
        raise HTTPException(status_code=404, detail="Banner no encontrado")
    return banner
