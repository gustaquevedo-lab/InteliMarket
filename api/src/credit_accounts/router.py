"""Credit account router"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.rbac.deps import require_permission
from api.src.credit_accounts import service
from api.src.credit_accounts.schemas import (
    CreditAccountCreate,
    CreditAccountUpdate,
    CreditAccountResponse,
    CreditPayment,
    MoraConfig,
    MoraPreviewResponse,
    WriteoffRequestCreate,
    DunningConfig,
    DunningPreviewResponse,
    CustomerAdvanceCreate,
    CustomerAdvanceResponse,
    ApplyAdvanceRequest,
)

router = APIRouter(prefix="/api/v1/credit-accounts", tags=["credit-accounts"])
approval_router = APIRouter(prefix="/api/v1/credit-approval-requests", tags=["credit-accounts"])
writeoff_router = APIRouter(prefix="/api/v1/receivable-writeoff-requests", tags=["credit-accounts"])
advances_router = APIRouter(prefix="/api/v1/customer-advances", tags=["credit-accounts"])


class RejectBody(BaseModel):
    motivo: str = ""


@router.post("", response_model=CreditAccountResponse)
async def create_account(
    data: CreditAccountCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    data.company_id = user["company_id"]
    return await service.create_credit_account(db, data)


@router.get("", response_model=list[CreditAccountResponse])
async def list_accounts(
    activo: bool | None = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_credit_accounts(db, user["company_id"], activo=activo)


@router.get("/customer/{customer_id}", response_model=CreditAccountResponse | None)
async def get_account_by_customer(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    account = await service.get_credit_account_by_customer(db, user["company_id"], customer_id)
    return account


@router.get("/{account_id}", response_model=CreditAccountResponse)
async def get_account(
    account_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    account = await service.get_credit_account(db, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.patch("/{account_id}", response_model=CreditAccountResponse)
async def update_account(
    account_id: str,
    data: CreditAccountUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    account = await service.update_credit_account(db, account_id, data)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.post("/{account_id}/payment")
async def make_payment(
    account_id: str,
    data: CreditPayment,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    account = await service.get_credit_account(db, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    result = await service.process_payment(db, user["company_id"], str(account.customer_id), data)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/{account_id}/movements", response_model=list[dict])
async def list_movements(
    account_id: str,
    limit: int = Query(50, le=100),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_movements(db, account_id, limit=limit, offset=offset)


@router.get("/mora/config", response_model=MoraConfig)
async def get_mora_config(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_mora_config(db, user["company_id"])


@router.patch("/mora/config", response_model=MoraConfig)
async def update_mora_config(
    data: MoraConfig,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    from api.src.rbac.service import get_user_roles
    import uuid as _uuid

    roles = {r["role_name"] for r in await get_user_roles(db, _uuid.UUID(user["id"]), _uuid.UUID(user["tenant_id"]))}
    if not roles & {"Gerente", "Finanzas"}:
        raise HTTPException(status_code=403, detail="Se requiere rol Gerente o Finanzas para configurar el recargo por mora")
    return await service.update_mora_config(db, user["company_id"], data)


@router.get("/mora/preview", response_model=MoraPreviewResponse)
async def preview_mora(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_mora_preview(db, user["company_id"])


@router.post("/mora/aplicar")
async def apply_mora(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    from api.src.rbac.service import get_user_roles
    import uuid as _uuid

    roles = {r["role_name"] for r in await get_user_roles(db, _uuid.UUID(user["id"]), _uuid.UUID(user["tenant_id"]))}
    if not roles & {"Gerente", "Finanzas"}:
        raise HTTPException(status_code=403, detail="Se requiere rol Gerente o Finanzas para aplicar recargos por mora")
    return await service.apply_mora_surcharges(db, user["company_id"], user["id"])


@router.get("/dunning/config", response_model=DunningConfig)
async def get_dunning_config(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_dunning_config(db, user["company_id"])


@router.patch("/dunning/config", response_model=DunningConfig)
async def update_dunning_config(
    data: DunningConfig,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    from api.src.rbac.service import get_user_roles
    import uuid as _uuid

    roles = {r["role_name"] for r in await get_user_roles(db, _uuid.UUID(user["id"]), _uuid.UUID(user["tenant_id"]))}
    if not roles & {"Gerente", "Finanzas"}:
        raise HTTPException(status_code=403, detail="Se requiere rol Gerente o Finanzas para configurar el dunning automático")
    return await service.update_dunning_config(db, user["company_id"], data)


@router.get("/dunning/preview", response_model=DunningPreviewResponse)
async def preview_dunning(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_dunning_preview(db, user["company_id"])


@router.post("/dunning/run")
async def run_dunning(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    from api.src.rbac.service import get_user_roles
    import uuid as _uuid

    roles = {r["role_name"] for r in await get_user_roles(db, _uuid.UUID(user["id"]), _uuid.UUID(user["tenant_id"]))}
    if not roles & {"Gerente", "Finanzas"}:
        raise HTTPException(status_code=403, detail="Se requiere rol Gerente o Finanzas para enviar recordatorios de cobro")
    return await service.run_dunning(db, user["company_id"])


@advances_router.post("", response_model=CustomerAdvanceResponse)
async def create_advance(
    data: CustomerAdvanceCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_customer_advance(db, user["company_id"], data, user["id"])


@advances_router.get("", response_model=list[CustomerAdvanceResponse])
async def list_advances(
    customer_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_customer_advances(db, user["company_id"], customer_id=customer_id)


@advances_router.get("/customer/{customer_id}/balance")
async def get_advance_balance(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    balance = await service.get_customer_advance_balance(db, user["company_id"], customer_id)
    return {"customer_id": customer_id, "monto_disponible": float(balance)}


@advances_router.post("/{advance_id}/apply")
async def apply_advance(
    advance_id: str,
    data: ApplyAdvanceRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.apply_advance(
        db, user["company_id"], advance_id, str(data.accounts_receivable_id), Decimal(str(data.monto)), user["id"]
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@writeoff_router.post("")
async def create_writeoff_request(
    data: WriteoffRequestCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.request_writeoff(db, user["company_id"], data, user["id"])
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return {"success": True}


@writeoff_router.get("")
async def list_writeoff_requests(
    estado: str | None = Query("pendiente"),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    requests = await service.list_writeoff_requests(db, user["company_id"], estado=estado)
    return [
        {
            "id": str(r["id"]), "accounts_receivable_id": str(r["accounts_receivable_id"]),
            "customer_id": str(r["customer_id"]), "customer_nombre": r["customer_nombre"],
            "numero_documento": r["numero_documento"], "monto": float(r["monto"]),
            "motivo": r["motivo"], "estado": r["estado"],
            "aprobado_gerente_id": str(r["aprobado_gerente_id"]) if r["aprobado_gerente_id"] else None,
            "aprobado_finanzas_id": str(r["aprobado_finanzas_id"]) if r["aprobado_finanzas_id"] else None,
            "created_at": r["created_at"],
        }
        for r in requests
    ]


@writeoff_router.post("/{request_id}/approve")
async def approve_writeoff_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.approve_writeoff(db, request_id, user["id"], user["tenant_id"])
    if "error" in result:
        raise HTTPException(status_code=403 if "No autorizado" in result["error"] else 400, detail=result["error"])
    return {"success": True, "completo": result["completo"]}


@writeoff_router.post("/{request_id}/reject")
async def reject_writeoff_request(
    request_id: str,
    body: RejectBody,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.reject_writeoff(db, request_id, user["id"], user["tenant_id"], body.motivo)
    if "error" in result:
        raise HTTPException(status_code=403 if "No autorizado" in result["error"] else 400, detail=result["error"])
    return {"success": True}


@approval_router.get("")
async def list_approval_requests(
    estado: str | None = Query("pendiente"),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission("credit:approve_exception")),
):
    requests = await service.list_approval_requests(db, user["company_id"], estado=estado)
    return [
        {
            "id": str(r.id), "sale_id": str(r.sale_id), "customer_id": str(r.customer_id),
            "customer_nombre": r.customer_nombre, "monto": float(r.monto),
            "limite_credito": float(r.limite_credito) if r.limite_credito is not None else None,
            "saldo_disponible": float(r.saldo_disponible) if r.saldo_disponible is not None else None,
            "estado": r.estado,
            # No hay columna "motivo" propia -- se infiere de los mismos datos
            # guardados al crear la solicitud: si el saldo disponible ya
            # alcanzaba el monto, la venta no quedo retenida por limite, asi
            # que fue por mora (ver credit_accounts.service.get_credit_check).
            "motivo": "mora" if (r.saldo_disponible is not None and float(r.saldo_disponible) >= float(r.monto)) else "limite",
            "aprobado_supervisor_id": str(r.aprobado_supervisor_id) if r.aprobado_supervisor_id else None,
            "aprobado_gerente_id": str(r.aprobado_gerente_id) if r.aprobado_gerente_id else None,
            "created_at": r.created_at,
        }
        for r in requests
    ]


@approval_router.post("/{request_id}/approve")
async def approve_approval_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.approve_credit_request(db, request_id, user["id"], user["tenant_id"])
    if "error" in result:
        raise HTTPException(status_code=403 if "No autorizado" in result["error"] else 400, detail=result["error"])

    if result["completo"]:
        from api.src.sales.router import fire_sale_side_effects
        from api.src.sales.service import get_sale
        sale = await get_sale(db, str(result["request"].sale_id))
        if sale:
            await fire_sale_side_effects(db, sale, sale.tipo_comprobante)

    return {"success": True, "completo": result["completo"]}


@approval_router.post("/{request_id}/reject")
async def reject_approval_request(
    request_id: str,
    body: RejectBody,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.reject_credit_request(db, request_id, user["id"], user["tenant_id"], body.motivo)
    if "error" in result:
        raise HTTPException(status_code=403 if "No autorizado" in result["error"] else 400, detail=result["error"])
    return {"success": True}
