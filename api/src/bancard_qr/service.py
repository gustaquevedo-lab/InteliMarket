"""Ventas QR Bancard -- QR dinamico via API HTTPS directa (generate-qr-express
/ revert), mostrado en la pantalla del Electron. Especificacion: "Qr en API
de Comercios v1.2 Vuelto QR" (Bancard/GlobalSI). Config real (public/private
key, commerce_code, branch_code, credenciales del callback) vive en
payment_integration_configs, provider='bancard_qr' -- ver payment_integrations
para el patron de guardado/saneado."""

import base64
import secrets
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.bancard_qr.models import BancardQrTransaction
from api.src.payment_integrations import service as pi_service


class BancardQrConfigError(Exception):
    pass


class BancardQrApiError(Exception):
    def __init__(self, message: str, detail: dict | None = None):
        super().__init__(message)
        self.detail = detail or {}


async def _get_config(db: AsyncSession, company_id: str) -> dict:
    row = await pi_service.get_config(db, company_id, "bancard_qr")
    if not row or not row.config:
        raise BancardQrConfigError("No hay credenciales de Bancard QR configuradas para esta empresa")
    cfg = row.config
    required = ["base_url", "commerce_code", "branch_code", "public_key", "private_key"]
    missing = [k for k in required if not cfg.get(k)]
    if missing:
        raise BancardQrConfigError(f"Config de Bancard QR incompleta, faltan: {', '.join(missing)}")
    return cfg


def _basic_auth_header(public_key: str, private_key: str) -> str:
    # Prefijo "apps/" obligatorio antes de la clave publica, segun spec.
    raw = f"apps/{public_key}:{private_key}"
    token = base64.b64encode(raw.encode("utf-8")).decode("ascii")
    return f"Basic {token}"


async def generate_qr(db: AsyncSession, company_id: str, amount: int, description: str | None, punto_emision: str | None, cajero_id: str | None) -> BancardQrTransaction:
    cfg = await _get_config(db, company_id)
    auth_header = _basic_auth_header(cfg["public_key"], cfg["private_key"])
    url = f"{cfg['base_url']}/commerces/{cfg['commerce_code']}/branches/{cfg['branch_code']}/selling/generate-qr-express"

    payload: dict = {"amount": amount}
    if description:
        payload["description"] = description[:150]

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.post(url, json=payload, headers={"Authorization": auth_header, "Content-Type": "application/json"})
        except httpx.RequestError as e:
            raise BancardQrApiError(f"No se pudo conectar con Bancard: {e}")

    if resp.status_code >= 400:
        raise BancardQrApiError(f"Bancard rechazo la generacion del QR (HTTP {resp.status_code})", detail=_safe_json(resp))

    body = _safe_json(resp)
    if body.get("status") != "success":
        raise BancardQrApiError("Bancard no confirmo la generacion del QR", detail=body)

    qr = body.get("qr_express") or {}
    hook_alias = qr.get("hook_alias")
    if not hook_alias:
        raise BancardQrApiError("La respuesta de Bancard no trajo hook_alias", detail=body)

    txn = BancardQrTransaction(
        id=uuid.uuid4(),
        company_id=uuid.UUID(str(company_id)),
        hook_alias=hook_alias,
        amount=amount,
        description=description,
        qr_url=qr.get("url"),
        qr_data=qr.get("qr_data"),
        status="pending",
        punto_emision=punto_emision,
        cajero_id=uuid.UUID(str(cajero_id)) if cajero_id else None,
    )
    db.add(txn)
    await db.commit()
    await db.refresh(txn)
    return txn


async def get_by_hook_alias(db: AsyncSession, company_id: str, hook_alias: str) -> BancardQrTransaction | None:
    result = await db.execute(
        select(BancardQrTransaction).where(
            BancardQrTransaction.company_id == uuid.UUID(str(company_id)),
            BancardQrTransaction.hook_alias == hook_alias,
        )
    )
    return result.scalar_one_or_none()


async def revert_qr(db: AsyncSession, company_id: str, hook_alias: str) -> BancardQrTransaction:
    txn = await get_by_hook_alias(db, company_id, hook_alias)
    if not txn:
        raise BancardQrApiError("QR no encontrado")
    if txn.status == "confirmed":
        raise BancardQrApiError("Este QR ya fue pagado, no se puede reversar")

    cfg = await _get_config(db, company_id)
    auth_header = _basic_auth_header(cfg["public_key"], cfg["private_key"])
    url = f"{cfg['base_url']}/commerces/{cfg['commerce_code']}/branches/{cfg['branch_code']}/selling/payments/revert/{hook_alias}"

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.put(url, headers={"Authorization": auth_header})
        except httpx.RequestError as e:
            raise BancardQrApiError(f"No se pudo conectar con Bancard para reversar: {e}")

    body = _safe_json(resp)
    reverse = body.get("reverse") or body.get("payment") or {}

    # Independientemente del resultado exacto de Bancard, el QR ya no debe
    # poder confirmarse del lado del comercio -- si el callback de un pago ya
    # en curso llega despues, handle_callback() debe rechazarlo igual (ver
    # nota de la spec: "debe responder con error" si ya se pidio la reversa).
    txn.status = "reverted"
    txn.reverted = True
    txn.response_code = reverse.get("response_code")
    txn.response_description = reverse.get("response_description")
    await db.commit()
    await db.refresh(txn)
    return txn


async def handle_callback(db: AsyncSession, payload: dict) -> dict:
    """Procesa la notificacion de pago de Bancard. Debe responder en <5s,
    sin ningun trabajo pesado -- solo persistir el resultado."""
    payment = payload.get("payment") or {}
    hook_alias = payment.get("hook_alias")

    if not hook_alias:
        return {"status": "error", "messages": [{"level": "error", "key": "ConfirmedError", "description": "Falta hook_alias en la notificacion"}]}

    result = await db.execute(select(BancardQrTransaction).where(BancardQrTransaction.hook_alias == hook_alias))
    txn = result.scalar_one_or_none()
    if not txn:
        return {"status": "error", "messages": [{"level": "error", "key": "ConfirmedError", "description": f"No se encontro una venta QR con hook_alias {hook_alias}"}]}

    if txn.reverted:
        # Ya se pidio la reversa de este QR -- no se puede dar la venta por
        # buena aunque Bancard reporte el pago como confirmado (ver
        # recomendacion 3 de la spec).
        return {"status": "error", "messages": [{"level": "error", "key": "ConfirmedError", "description": "El comercio ya habia solicitado la reversa de este QR"}]}

    status = payment.get("status")
    txn.status = "confirmed" if status == "confirmed" else "failed"
    txn.response_code = payment.get("response_code")
    txn.response_description = payment.get("response_description")
    txn.ticket_number = str(payment.get("ticket_number") or "") or None
    txn.authorization_code = payment.get("authorization_code")
    txn.account_type = payment.get("account_type")
    txn.card_last_numbers = str(payment.get("card_last_numbers") or "") or None
    txn.bin = payment.get("bin")
    payer = payment.get("payer") or {}
    txn.payer_name = payer.get("name")
    txn.payer_lastname = payer.get("lastname")
    txn.raw_callback = str(payload)
    if txn.status == "confirmed":
        txn.confirmed_at = datetime.now(timezone.utc)
    await db.commit()

    return {"status": "success", "messages": [{"level": "success", "key": "Confirmed", "description": "Pago recibido con exito"}]}


def _safe_json(resp: httpx.Response) -> dict:
    try:
        return resp.json()
    except Exception:
        return {}
