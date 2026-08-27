from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.plugpay import service, transactions_service
from api.src.plugpay.service import PlugpayNotConfigured, PlugpayApiError
from api.src.plugpay.schemas import (
    PixCreateRequest, PixQuoteRequest, CalcularParceladoRequest, StartParceladoRequest,
    PlugpayTransactionResponse, ComplianceCheckResponse,
)

router = APIRouter(prefix="/api/v1/plugpay", tags=["plugpay"])


def _error_response(e: Exception) -> PlugpayTransactionResponse:
    if isinstance(e, PlugpayNotConfigured):
        return PlugpayTransactionResponse(ok=False, error_message=str(e))
    if isinstance(e, PlugpayApiError):
        return PlugpayTransactionResponse(ok=False, error_message=e.message)
    return PlugpayTransactionResponse(ok=False, error_message=f"Error inesperado: {e}")


@router.get("/compliance/{cpf}", response_model=ComplianceCheckResponse)
async def compliance(cpf: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    try:
        data = await service.check_compliance(db, user["company_id"], cpf)
        return ComplianceCheckResponse(ok=True, data=data)
    except PlugpayNotConfigured as e:
        return ComplianceCheckResponse(ok=False, error_message=str(e))
    except PlugpayApiError as e:
        return ComplianceCheckResponse(ok=False, error_message=e.message)


@router.post("/pix/create", response_model=PlugpayTransactionResponse)
async def pix_create(data: PixCreateRequest, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    try:
        result = await service.create_pix(db, user["company_id"], data.monto, data.moneda, data.customer_cpf_cnpj)
        txn = await transactions_service.log_transaction(
            db, user["company_id"], sale_id=data.sale_id, customer_id=data.customer_id,
            tipo_operacion="pix", id_transacao=str(result.get("IdTransacao") or result.get("idTransacao") or ""),
            referencia_interna=result.get("referenciaInterna"), qr_code_id=result.get("qrCodeId"),
            qr_code_string_image=result.get("qrCodeStringImage"), moneda_origen=data.moneda, monto_origen=data.monto,
            exitosa=True, raw_response=result,
        )
        return PlugpayTransactionResponse(ok=True, data=result, transaction_log_id=txn.id)
    except (PlugpayNotConfigured, PlugpayApiError) as e:
        if isinstance(e, PlugpayApiError):
            await transactions_service.log_transaction(
                db, user["company_id"], sale_id=data.sale_id, customer_id=data.customer_id,
                tipo_operacion="pix", moneda_origen=data.moneda, monto_origen=data.monto,
                exitosa=False, error_message=e.message, raw_response=e.body,
            )
        return _error_response(e)


@router.post("/pix/quote", response_model=PlugpayTransactionResponse)
async def pix_quote(data: PixQuoteRequest, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    try:
        result = await service.quote_pix(db, user["company_id"], data.monto, data.moneda)
        return PlugpayTransactionResponse(ok=True, data=result)
    except (PlugpayNotConfigured, PlugpayApiError) as e:
        return _error_response(e)


@router.post("/credito-parcelado/calcular", response_model=PlugpayTransactionResponse)
async def credito_calcular(data: CalcularParceladoRequest, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    try:
        result = await service.calcular_valor_parcelado(db, user["company_id"], data.monto, data.moneda, data.cuotas)
        return PlugpayTransactionResponse(ok=True, data=result)
    except (PlugpayNotConfigured, PlugpayApiError) as e:
        return _error_response(e)


@router.post("/credito-parcelado/start", response_model=PlugpayTransactionResponse)
async def credito_start(data: StartParceladoRequest, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    try:
        result = await service.start_credito_parcelado(
            db, user["company_id"], data.monto, data.moneda, data.cuotas, data.customer_cpf, data.customer_phone,
        )
        txn = await transactions_service.log_transaction(
            db, user["company_id"], sale_id=data.sale_id, customer_id=data.customer_id,
            tipo_operacion="credito_parcelado", id_transacao=str(result.get("IdTransacao") or ""),
            referencia_interna=result.get("referenciaInterna"), value_brl=result.get("valueBRL"),
            url_payment_form=result.get("UrlPaymentForm"), numero_cuotas=data.cuotas,
            moneda_origen=data.moneda, monto_origen=data.monto, exitosa=True, raw_response=result,
        )
        return PlugpayTransactionResponse(ok=True, data=result, transaction_log_id=txn.id)
    except (PlugpayNotConfigured, PlugpayApiError) as e:
        if isinstance(e, PlugpayApiError):
            await transactions_service.log_transaction(
                db, user["company_id"], sale_id=data.sale_id, customer_id=data.customer_id,
                tipo_operacion="credito_parcelado", numero_cuotas=data.cuotas,
                moneda_origen=data.moneda, monto_origen=data.monto,
                exitosa=False, error_message=e.message, raw_response=e.body,
            )
        return _error_response(e)


@router.get("/credito-parcelado/{transaction_id}", response_model=PlugpayTransactionResponse)
async def credito_status(transaction_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    try:
        result = await service.get_credito_parcelado_status(db, user["company_id"], transaction_id)
        return PlugpayTransactionResponse(ok=True, data=result)
    except (PlugpayNotConfigured, PlugpayApiError) as e:
        return _error_response(e)


@router.patch("/transactions/{txn_id}/link-sale/{sale_id}")
async def link_sale(txn_id: str, sale_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    row = await transactions_service.link_sale(db, txn_id, sale_id)
    if not row:
        raise HTTPException(status_code=404)
    return {"message": "OK"}
