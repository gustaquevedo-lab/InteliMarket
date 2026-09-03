"""Ventas QR Bancard -- ver api/src/bancard_qr/service.py para el detalle
de la integracion. El endpoint /callback es el unico publico del modulo:
lo invoca Bancard desde internet, protegido por Basic Auth propio (no el
JWT del sistema) segun exige la especificacion."""

import secrets

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.bancard_qr import service
from api.src.bancard_qr.schemas import GenerateQrRequest, GenerateQrResponse, QrStatusResponse, RevertResponse
from api.src.payment_integrations.models import PaymentIntegrationConfig

router = APIRouter(prefix="/api/v1/bancard-qr", tags=["bancard-qr"])


@router.post("/generate", response_model=GenerateQrResponse)
async def generate(body: GenerateQrRequest, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="El monto debe ser mayor a cero")
    try:
        txn = await service.generate_qr(
            db, user["company_id"], body.amount, body.description, body.punto_emision, user.get("id"),
        )
    except service.BancardQrConfigError as e:
        raise HTTPException(status_code=412, detail=str(e))
    except service.BancardQrApiError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return GenerateQrResponse(
        hook_alias=txn.hook_alias, amount=txn.amount, description=txn.description,
        qr_url=txn.qr_url, qr_data=txn.qr_data, status=txn.status, created_at=txn.created_at,
    )


@router.get("/status/{hook_alias}", response_model=QrStatusResponse)
async def get_status(hook_alias: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    txn = await service.get_by_hook_alias(db, user["company_id"], hook_alias)
    if not txn:
        raise HTTPException(status_code=404, detail="QR no encontrado")
    return QrStatusResponse(
        hook_alias=txn.hook_alias, status=txn.status, amount=txn.amount,
        response_code=txn.response_code, response_description=txn.response_description,
        ticket_number=txn.ticket_number, authorization_code=txn.authorization_code,
        account_type=txn.account_type, card_last_numbers=txn.card_last_numbers,
        payer_name=txn.payer_name, payer_lastname=txn.payer_lastname, confirmed_at=txn.confirmed_at,
    )


@router.put("/revert/{hook_alias}", response_model=RevertResponse)
async def revert(hook_alias: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    try:
        txn = await service.revert_qr(db, user["company_id"], hook_alias)
    except service.BancardQrConfigError as e:
        raise HTTPException(status_code=412, detail=str(e))
    except service.BancardQrApiError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return RevertResponse(
        hook_alias=txn.hook_alias, status=txn.status,
        response_code=txn.response_code, response_description=txn.response_description,
    )


@router.post("/callback")
async def callback(request: Request, db: AsyncSession = Depends(get_db)):
    """Notificacion de pago de Bancard -- publico, protegido por Basic Auth
    propio (definido por nosotros, configurado en Bancard al activar el
    comercio). Debe responder en <5s segun la spec, sin trabajo pesado."""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Basic "):
        raise HTTPException(status_code=401, detail="Falta autenticacion")

    import base64
    try:
        decoded = base64.b64decode(auth_header[6:]).decode("utf-8")
        sent_user, sent_pass = decoded.split(":", 1)
    except Exception:
        raise HTTPException(status_code=401, detail="Autenticacion invalida")

    result = await db.execute(
        select(PaymentIntegrationConfig).where(PaymentIntegrationConfig.provider == "bancard_qr")
    )
    configs = result.scalars().all()
    matched = any(
        secrets.compare_digest(sent_user, (c.config or {}).get("callback_user", ""))
        and secrets.compare_digest(sent_pass, (c.config or {}).get("callback_password", ""))
        for c in configs
    )
    if not matched:
        raise HTTPException(status_code=401, detail="Credenciales invalidas")

    payload = await request.json()
    return await service.handle_callback(db, payload)
