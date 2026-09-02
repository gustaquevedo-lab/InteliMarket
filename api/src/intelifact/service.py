"""Config por tenant + cliente HTTP hacia el microservicio Node InteliFact
(services/intelifact-service/). Adaptado del mismo patron ya probado en la
vertical Distribuidora (api/src/sifen/client.py de esa rama), generalizado:
ninguna llamada confia en el EMITTER_CONFIG de fallback del lado del
microservicio -- el emisor completo se arma aca, desde la config real del
tenant, y se manda explicito en cada request."""

import uuid
import httpx
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.intelifact.models import IntelifactConfig
from api.src.intelifact.schemas import IntelifactConfigUpsert, InvoicePreviewRequest

DEFAULT_SERVICE_URL = "http://localhost:3000"
SENSITIVE_CONFIG_FIELDS = {"cert_p12_base64", "cert_password"}


# ── Config por tenant ────────────────────────────────────────────────────

async def get_config(db: AsyncSession, company_id: str) -> IntelifactConfig | None:
    result = await db.execute(
        select(IntelifactConfig).where(IntelifactConfig.company_id == uuid.UUID(company_id))
    )
    return result.scalars().first()


async def upsert_config(db: AsyncSession, company_id: str, data: IntelifactConfigUpsert) -> IntelifactConfig:
    existing = await get_config(db, company_id)
    payload = data.model_dump()
    if existing:
        for field, value in payload.items():
            # Si no viene un cert/password nuevo (string vacio), se preserva el guardado --
            # mismo criterio ya usado en payment_integrations para no pisar credenciales.
            if field in SENSITIVE_CONFIG_FIELDS and not value:
                continue
            setattr(existing, field, value)
        await db.commit()
        await db.refresh(existing)
        return existing

    row = IntelifactConfig(company_id=uuid.UUID(company_id), **payload)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


def to_response_dict(row: IntelifactConfig) -> dict:
    d = {c.name: getattr(row, c.name) for c in row.__table__.columns}
    d["cert_cargado"] = bool(d.pop("cert_p12_base64", None))
    d.pop("cert_password", None)
    return d


def _emitter_dict(cfg: IntelifactConfig) -> dict:
    """Arma el bloque de emisor completo que el microservicio Node necesita
    en cada request -- nunca depende de su EMITTER_CONFIG de desarrollo."""
    return {
        "ruc": cfg.ruc, "dv": cfg.dv, "name": cfg.razon_social, "tradeName": cfg.nombre_fantasia,
        "economicActivity": cfg.actividad_economica, "address": cfg.direccion, "city": cfg.ciudad,
        "department": cfg.departamento, "email": cfg.email, "phone": cfg.telefono,
        "timbrado": cfg.timbrado, "timbradoStartDate": cfg.timbrado_inicio,
        "establishmentCode": cfg.codigo_establecimiento, "pointOfSaleCode": cfg.codigo_punto_expedicion,
    }


# ── Cliente HTTP hacia el microservicio ─────────────────────────────────

class InteliFactClient:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    async def health(self) -> dict:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{self.base_url}/health")
            resp.raise_for_status()
            return resp.json()

    async def generate_and_sign(self, cdc_data: dict, cert_base64: str | None = None, cert_password: str | None = None) -> dict:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{self.base_url}/api/v1/sifen/generate-and-sign",
                json={"cdcData": cdc_data, "certBase64": cert_base64, "certPassword": cert_password},
            )
            resp.raise_for_status()
            return resp.json()

    async def submit(self, xml: str, ruc_emitter: str, document_number: str, cert_base64: str | None, cert_password: str | None, environment: str) -> dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self.base_url}/api/v1/sifen/submit",
                json={
                    "xml": xml, "rucEmitter": ruc_emitter, "documentNumber": document_number,
                    "certBase64": cert_base64, "certPassword": cert_password, "environment": environment,
                },
            )
            resp.raise_for_status()
            return resp.json()

    async def generate_kude_pdf(self, sale: dict, customer: dict, items: list, tenant_id: str, emitter: dict) -> bytes:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{self.base_url}/api/v1/sifen/kude",
                json={"sale": sale, "customer": customer, "items": items, "tenantId": tenant_id, "emitter": emitter},
            )
            resp.raise_for_status()
            return resp.content

    async def telemetry_status(self) -> dict:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{self.base_url}/api/v1/telemetry/status")
            resp.raise_for_status()
            return resp.json()


def _client_for(cfg: IntelifactConfig) -> InteliFactClient:
    return InteliFactClient(cfg.service_base_url or DEFAULT_SERVICE_URL)


# ── Operaciones de alto nivel (usadas por el router; nada de esto lo llama sales/service.py todavia) ──

async def preview_invoice(cfg: IntelifactConfig, data: InvoicePreviewRequest) -> dict:
    """Genera y firma un CDC de prueba sin enviarlo a SET -- sirve para probar
    la config de un tenant sin gastar numeracion real."""
    client = _client_for(cfg)
    emitter = _emitter_dict(cfg)
    cdc_data = {
        **emitter,
        "emitterRuc": cfg.ruc, "emitterDv": cfg.dv, "emitterName": cfg.razon_social,
        "timbradoNumber": cfg.timbrado, "establishmentCode": cfg.codigo_establecimiento,
        "pointOfSaleCode": cfg.codigo_punto_expedicion,
        "totalAmount": data.total_amount, "subtotal": data.subtotal or data.total_amount,
        "recipientDocument": data.recipient_document, "recipientName": data.recipient_name,
        "items": [item.model_dump() for item in data.items],
    }
    return await client.generate_and_sign(cdc_data, cfg.cert_p12_base64, cfg.cert_password)


async def get_telemetry_status(cfg: IntelifactConfig) -> dict:
    client = _client_for(cfg)
    return await client.telemetry_status()
