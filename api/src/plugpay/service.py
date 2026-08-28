"""Cliente real de la API de PlugPay (PIX + Credito Parcelado Brasil).

Spec real (no el PDF sintetizado por IA que trajo el cliente -- ese tenia
varias inexactitudes) sacada del propio Swagger publico de PlugPay:
https://apisandbox.plugpayapi.com/api-docs/swagger-ui-init.js

Reglas de seguridad que este modulo respeta:
- client_id/password/tokens viven SOLO en el backend (payment_integration_configs),
  el frontend nunca los ve -- confirmado por sanitize_config en
  payment_integrations/service.py.
- Datos de tarjeta NUNCA pasan por nuestro backend -- credito parcelado
  devuelve una UrlPaymentForm (checkout hospedado por PlugPay), nunca
  recibimos numero de tarjeta.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.payment_integrations import service as payint_service
from api.src.payment_integrations.models import PaymentIntegrationConfig
from api.src.payment_integrations.schemas import PaymentIntegrationConfigUpsert

BASE_URLS = {
    "sandbox": "https://apisandbox.plugpayapi.com/v1/partners/",
    "production": "https://api.plugpayapi.com/v1/partners/",
}


class PlugpayNotConfigured(Exception):
    pass


class PlugpayApiError(Exception):
    def __init__(self, status_code: int, message: str, body: dict | None = None):
        self.status_code = status_code
        self.message = message
        self.body = body
        super().__init__(message)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_token_valid(expires_at_iso: str | None) -> bool:
    if not expires_at_iso:
        return False
    try:
        expires_at = datetime.fromisoformat(expires_at_iso)
    except ValueError:
        return False
    # Margen de 2 min para no usar un token a punto de vencer a mitad de una operacion.
    return datetime.now(timezone.utc) < expires_at - timedelta(minutes=2)


async def _load_config(db: AsyncSession, company_id: str) -> PaymentIntegrationConfig:
    row = await payint_service.get_config(db, company_id, "plugpay")
    if not row or not row.enabled:
        raise PlugpayNotConfigured("PlugPay no esta configurado o esta deshabilitado. Cargalo en Integraciones > Configuración.")
    cfg = row.config or {}
    if not cfg.get("client_id") or not cfg.get("password"):
        raise PlugpayNotConfigured("Falta client_id o password de PlugPay en la configuración.")
    return row


def _base_url(row: PaymentIntegrationConfig) -> str:
    return BASE_URLS.get(row.environment, BASE_URLS["sandbox"])


async def _save_tokens(db: AsyncSession, company_id: str, row: PaymentIntegrationConfig, token: str, refresh_token: str):
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=55)).isoformat()
    new_config = dict(row.config or {})
    new_config.update({
        "cached_token": token,
        "cached_refresh_token": refresh_token,
        "cached_token_expires_at": expires_at,
    })
    await payint_service.upsert_config(db, company_id, "plugpay", PaymentIntegrationConfigUpsert(
        environment=row.environment, enabled=row.enabled, config=new_config,
    ))


async def get_valid_token(db: AsyncSession, company_id: str) -> tuple[str, PaymentIntegrationConfig]:
    row = await _load_config(db, company_id)
    cfg = row.config or {}
    base_url = _base_url(row)

    if _is_token_valid(cfg.get("cached_token_expires_at")) and cfg.get("cached_token"):
        return cfg["cached_token"], row

    async with httpx.AsyncClient(base_url=base_url, timeout=20) as client:
        # 1. Intentar refresh si hay uno guardado -- evita gastar el rate
        #    limit de login (10 req/15min) en cada operacion.
        if cfg.get("cached_refresh_token"):
            try:
                resp = await client.post("auth/refresh", json={"refresh_token": cfg["cached_refresh_token"]})
                if resp.status_code == 200:
                    data = resp.json()
                    await _save_tokens(db, company_id, row, data["token"], data["refresh_token"])
                    return data["token"], row
            except httpx.HTTPError:
                pass  # cae a login de cero

        # 2. Login de cero con client_id/password.
        resp = await client.post("auth/token", json={"client_id": cfg["client_id"], "password": cfg["password"]})
        if resp.status_code != 200:
            raise PlugpayApiError(resp.status_code, f"No se pudo autenticar con PlugPay: {resp.text}", None)
        data = resp.json()
        await _save_tokens(db, company_id, row, data["token"], data["refresh_token"])
        return data["token"], row


async def _authed_request(db: AsyncSession, company_id: str, method: str, path: str, json_body: dict | None = None) -> dict:
    token, row = await get_valid_token(db, company_id)
    base_url = _base_url(row)
    headers = {"Authorization": f"Bearer {token}"}
    # Asegurar que el path no inicie con slash / ni contenga prefijo duplicado
    clean_path = path.lstrip("/")
    if clean_path.startswith("partners/"):
        clean_path = clean_path[len("partners/"):]
    async with httpx.AsyncClient(base_url=base_url, timeout=30) as client:
        resp = await client.request(method, clean_path, json=json_body, headers=headers)
    if resp.status_code >= 400:
        try:
            body = resp.json()
        except Exception:
            body = {"raw": resp.text}
        raise PlugpayApiError(resp.status_code, body.get("message", resp.text) if isinstance(body, dict) else str(body), body)
    return resp.json() if resp.content else {}


async def check_compliance(db: AsyncSession, company_id: str, cpf: str) -> dict:
    return await _authed_request(db, company_id, "GET", f"/customers/checkCompliance/{cpf}")


async def create_pix(db: AsyncSession, company_id: str, monto: float, moneda: str, customer_cpf: str) -> dict:
    row = await _load_config(db, company_id)
    document_merchant = (row.config or {}).get("document_merchant")
    if not document_merchant:
        raise PlugpayNotConfigured("Falta document_merchant en la configuración de PlugPay.")
    return await _authed_request(db, company_id, "POST", "/transactionPix/create", {
        "originCurrencie": moneda,
        "value": monto,
        "customerCPF": customer_cpf,
        "documentMerchant": document_merchant,
    })


async def get_pix_status(db: AsyncSession, company_id: str, referencia_interna: str) -> dict:
    return await _authed_request(db, company_id, "GET", f"/transactionPix/status/{referencia_interna}")


async def get_pix_qrcode(db: AsyncSession, company_id: str, referencia_interna: str) -> dict:
    return await _authed_request(db, company_id, "GET", f"/transactionPix/qrcode/{referencia_interna}")


async def quote_pix(db: AsyncSession, company_id: str, monto: float, moneda: str) -> dict:
    row = await _load_config(db, company_id)
    document_merchant = (row.config or {}).get("document_merchant")
    return await _authed_request(db, company_id, "POST", "/transactionPix/quote", {
        "originCurrencie": moneda,
        "value": monto,
        "documentMerchant": document_merchant,
    })


async def calcular_valor_parcelado(db: AsyncSession, company_id: str, monto: float, moneda: str, cuotas: int) -> dict:
    row = await _load_config(db, company_id)
    document_merchant = (row.config or {}).get("document_merchant")
    if not document_merchant:
        raise PlugpayNotConfigured("Falta document_merchant en la configuración de PlugPay.")
    return await _authed_request(db, company_id, "POST", "/transactionCreditoParcelado/calcularValor", {
        "originCurrencie": moneda,
        "value": monto,
        "qtdParcelas": cuotas,
        "documentMerchant": document_merchant,
    })


async def start_credito_parcelado(db: AsyncSession, company_id: str, monto: float, moneda: str, cuotas: int, customer_cpf: str, customer_phone: str) -> dict:
    row = await _load_config(db, company_id)
    document_merchant = (row.config or {}).get("document_merchant")
    if not document_merchant:
        raise PlugpayNotConfigured("Falta document_merchant en la configuración de PlugPay.")
    return await _authed_request(db, company_id, "POST", "/transactionCreditoParcelado/start", {
        "originCurrencie": moneda,
        "value": monto,
        "numberInstallments": cuotas,
        "customerCPF": customer_cpf,
        "customerPhone": customer_phone,
        "documentMerchant": document_merchant,
    })


async def get_credito_parcelado_status(db: AsyncSession, company_id: str, referencia_interna: str) -> dict:
    return await _authed_request(db, company_id, "GET", f"/transactionCreditoParcelado/status/{referencia_interna}")


async def cancel_credito_parcelado(db: AsyncSession, company_id: str, referencia_interna: str) -> dict:
    return await _authed_request(db, company_id, "POST", f"/transactionCreditoParcelado/cancel/{referencia_interna}")
