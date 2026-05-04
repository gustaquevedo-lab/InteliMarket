"""SIFEN API client"""

import httpx
from typing import Optional
from datetime import datetime

from api.src.config import settings

TIPO_DE_MAP = {
    "factura": 1,
    "factura_exportacion": 2,
    "nota_debito": 3,
    "autofactura": 4,
    "nota_credito": 5,
    "factura_compra": 6,
    "comprobante_retencion": 7,
    "comprobante_pago": 8,
    "remito": 9,
    "cuenta_venta": 10,
    "factura_credito": 11,
}


class SifenClient:
    def __init__(self):
        self.base_url = settings.sifen_api_url
        self.env = settings.sifen_env
        self.cert_path = settings.sifen_cert_path
        self.cert_password = settings.sifen_cert_password
        self._client: Optional[httpx.AsyncClient] = None

    async def get_client(self) -> httpx.AsyncClient:
        if not self._client:
            if self.cert_path:
                self._client = httpx.AsyncClient(
                    cert=(self.cert_path, self.cert_password),
                    timeout=30.0,
                )
            else:
                self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    async def send_invoice(self, xml_content: str, cdc: str) -> dict:
        client = await self.get_client()
        payload = {
            "xml": xml_content,
            "cdc": cdc,
            "ambiente": self.env,
        }
        response = await client.post(
            f"{self.base_url}/enviar",
            json=payload,
        )
        response.raise_for_status()
        return response.json()

    async def query_cdc(self, cdc: str) -> dict:
        client = await self.get_client()
        response = await client.get(
            f"{self.base_url}/consultar",
            params={"cdc": cdc},
        )
        response.raise_for_status()
        return response.json()

    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None


sifen_client = SifenClient()


async def send_to_sifen(xml_content: str, cdc: str) -> dict:
    try:
        result = await sifen_client.send_invoice(xml_content, cdc)
        return {
            "success": True,
            "estado": "aprobado" if result.get("estado") == "A" else "rechazado",
            "codigo_error": result.get("codigo_error"),
            "mensaje": result.get("mensaje", ""),
            "cdc": cdc,
            "xml_response": str(result),
        }
    except httpx.HTTPStatusError as e:
        return {
            "success": False,
            "estado": "rechazado",
            "codigo_error": str(e.response.status_code),
            "mensaje": str(e),
            "cdc": cdc,
            "xml_response": "",
        }
    except Exception as e:
        return {
            "success": False,
            "estado": "error",
            "codigo_error": "CONNECTION_ERROR",
            "mensaje": str(e),
            "cdc": cdc,
            "xml_response": "",
        }
