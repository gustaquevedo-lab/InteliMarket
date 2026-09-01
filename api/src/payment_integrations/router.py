from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.payment_integrations import service
from api.src.payment_integrations.schemas import PaymentIntegrationConfigUpsert, PaymentIntegrationConfigResponse

router = APIRouter(prefix="/api/v1/payment-integrations", tags=["payment-integrations"])

ALLOWED_PROVIDERS = {"bancard", "plugpay", "dinelco"}


@router.get("/{provider}", response_model=PaymentIntegrationConfigResponse | None)
async def get_provider_config(provider: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    if provider not in ALLOWED_PROVIDERS:
        raise HTTPException(status_code=404, detail="Proveedor desconocido")
    row = await service.get_config(db, user["company_id"], provider)
    if not row:
        return None
    return PaymentIntegrationConfigResponse(
        id=row.id, company_id=row.company_id, provider=row.provider, environment=row.environment,
        enabled=row.enabled, config=service.sanitize_config(row.config), created_at=row.created_at, updated_at=row.updated_at,
    )


@router.put("/{provider}", response_model=PaymentIntegrationConfigResponse)
async def upsert_provider_config(provider: str, data: PaymentIntegrationConfigUpsert, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    if provider not in ALLOWED_PROVIDERS:
        raise HTTPException(status_code=404, detail="Proveedor desconocido")
    row = await service.upsert_config(db, user["company_id"], provider, data)
    return PaymentIntegrationConfigResponse(
        id=row.id, company_id=row.company_id, provider=row.provider, environment=row.environment,
        enabled=row.enabled, config=service.sanitize_config(row.config), created_at=row.created_at, updated_at=row.updated_at,
    )
