"""Scale bridge router — 20+ endpoints for scale management, weight, PLU, labels"""

from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.auth.deps import require_auth, require_feature
from api.src.db import get_db
from api.src.integrations.scales.schemas import (
    ScaleConfigCreate, ScaleConfigUpdate, ScaleConfigResponse,
    WeightReadResult, WeightLogFilter,
    TareResult, ConnectionTestResult, ProtocolDetectInput, ProtocolDetectResult,
    PLUSyncInput, PLUSyncResponse,
    LabelTemplateCreate, LabelTemplateResponse,
    PrintLabelInput, PrintLabelResult,
    WeighProductInput, WeighProductResult,
)
from api.src.integrations.scales import service

router = APIRouter(prefix="/api/v1/scales", tags=["Scales"])


# ═══════════════════════════════════════════════════════════════
# SCALE CONFIG CRUD
# ═══════════════════════════════════════════════════════════════

@router.get("/configs", response_model=list[ScaleConfigResponse])
async def list_scales(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_scales(db, user["company_id"])


@router.get("/configs/{scale_id}", response_model=ScaleConfigResponse)
async def get_scale(
    scale_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    s = await service.get_scale(db, scale_id)
    if not s or s.company_id != user["company_id"]:
        raise HTTPException(status_code=404, detail="Scale not found")
    return s


@router.post("/configs", response_model=ScaleConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_scale(
    data: ScaleConfigCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_scale(db, user["company_id"], data)


@router.put("/configs/{scale_id}", response_model=ScaleConfigResponse)
async def update_scale(
    scale_id: str,
    data: ScaleConfigUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    s = await service.update_scale(db, scale_id, data)
    if not s:
        raise HTTPException(status_code=404, detail="Scale not found")
    return s


@router.delete("/configs/{scale_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scale(
    scale_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    ok = await service.delete_scale(db, scale_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Scale not found")


# ═══════════════════════════════════════════════════════════════
# WEIGHT OPERATIONS
# ═══════════════════════════════════════════════════════════════

@router.post("/{scale_id}/weight", response_model=WeightReadResult)
async def read_weight(
    scale_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.read_weight(db, user["company_id"], scale_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ConnectionError as e:
        raise HTTPException(status_code=502, detail=f"Scale communication error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{scale_id}/tare", response_model=dict)
async def tare_scale(
    scale_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.tare_scale(db, user["company_id"], scale_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{scale_id}/zero", response_model=dict)
async def zero_scale(
    scale_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.zero_scale(db, user["company_id"], scale_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{scale_id}/weigh-product", response_model=WeighProductResult)
async def weigh_product(
    scale_id: str,
    data: WeighProductInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.weigh_product(
            db, user["company_id"], scale_id, data.producto_id, data.precio_unitario,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ConnectionError as e:
        raise HTTPException(status_code=502, detail=f"Scale communication error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════
# CONNECTION TEST & PROTOCOL DETECTION
# ═══════════════════════════════════════════════════════════════

@router.post("/{scale_id}/test", response_model=ConnectionTestResult)
async def test_connection(
    scale_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.test_connection(db, user["company_id"], scale_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/detect-protocol", response_model=ProtocolDetectResult)
async def detect_protocol(
    data: ProtocolDetectInput,
    user=Depends(require_auth),
):
    return await service.detect_protocol(data)


# ═══════════════════════════════════════════════════════════════
# PLU SYNC
# ═══════════════════════════════════════════════════════════════

@router.post("/{scale_id}/plu-sync", response_model=dict)
async def sync_plu(
    scale_id: str,
    data: PLUSyncInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.sync_plu(db, user["company_id"], scale_id, data.producto_ids, data.modo)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{scale_id}/plu-syncs", response_model=list[dict])
async def list_plu_syncs(
    scale_id: str,
    limit: int = Query(20, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_plu_syncs(db, user["company_id"], scale_id, limit, offset)


# ═══════════════════════════════════════════════════════════════
# LABEL PRINTING
# ═══════════════════════════════════════════════════════════════

@router.post("/print-label", response_model=dict)
async def print_label(
    data: PrintLabelInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.print_label(db, user["company_id"], data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════
# LABEL TEMPLATES
# ═══════════════════════════════════════════════════════════════

@router.get("/label-templates", response_model=list[LabelTemplateResponse])
async def list_label_templates(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_label_templates(db, user["company_id"])


@router.post("/label-templates", response_model=LabelTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_label_template(
    data: LabelTemplateCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_label_template(db, user["company_id"], data)


@router.delete("/label-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_label_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    ok = await service.delete_label_template(db, template_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Template not found")

# ═══════════════════════════════════════════════════════════════
# WEIGHT LOGS
# ═══════════════════════════════════════════════════════════════

@router.get("/-/weight-logs")
@router.get("/weight-logs")
@router.get("/{scale_id}/weight-logs")
async def list_weight_logs(
    scale_id: str | None = None,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    target_scale = None if scale_id == "-" else scale_id
    return await service.list_weight_logs(db, user["company_id"], target_scale, limit, offset)
