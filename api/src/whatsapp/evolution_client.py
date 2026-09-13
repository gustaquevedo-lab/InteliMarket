"""Evolution API / IntelliZapp Gateway Client for Intelimarket (Vertical Supermercado).

Maneja la comunicación unificada con la instancia de Evolution API en dev-server,
soportando normalización de números Paraguay (595) / Brasil (55), generación de QR,
consulta de estado de sesión, y envío transaccional de texto y archivos multimedia.
"""

import logging
import re
from typing import Any, Dict, Optional
import httpx

from api.src.config import settings

logger = logging.getLogger("whatsapp.evolution")


def normalize_phone_e164(phone: Optional[str]) -> Optional[str]:
    """
    Normaliza el número de teléfono al formato internacional E.164 sin signos '+' ni separadores.
    Soporta Paraguay (595) y Brasil (55).
    """
    if not phone:
        return None
    cleaned = re.sub(r"[^\d]", "", str(phone))
    if not cleaned:
        return None

    # Paraguay local con 0 inicial (ej: 0985 123456 -> 595985123456)
    if cleaned.startswith("09") and len(cleaned) == 10:
        return "595" + cleaned[1:]
    # Paraguay sin 0 (ej: 985 123456 -> 595985123456)
    if cleaned.startswith("9") and len(cleaned) == 9:
        return "595" + cleaned

    # Ya tiene código de país
    if cleaned.startswith("595") or cleaned.startswith("55"):
        return cleaned

    # Celulares brasileños frontera (DDD 67 u otros de 10 u 11 dígitos)
    if len(cleaned) in (10, 11) and cleaned.startswith("67"):
        return "55" + cleaned

    return cleaned


class EvolutionClient:
    """Cliente HTTP asíncrono para Evolution API."""

    def __init__(self):
        self.base_url = (getattr(settings, "evolution_api_url", None) or "http://100.72.38.119:8085").rstrip("/")
        self.api_key = getattr(settings, "evolution_api_key", None) or "c616d81834c74317ad473380a10d35d84d6eacd08a7c467a6e7d79f29c0340d4"
        self.default_instance = getattr(settings, "evolution_instance_name", None) or "extra_supermercado"

    def _headers(self) -> Dict[str, str]:
        return {
            "apikey": self.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def get_instance_status(self, instance_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Consulta el estado de conexión de la instancia en Evolution API.
        Retorna status: 'open' (conectado), 'connecting' (esperando QR/vínculo), 'close' (desconectado) o 'not_found'.
        """
        instance = instance_name or self.default_instance
        url = f"{self.base_url}/instance/connectionState/{instance}"

        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(url, headers=self._headers())
                if res.status_code == 200:
                    data = res.json()
                    state = data.get("instance", {}).get("state", "unknown")
                    # open = conectado, close = desconectado, connecting = conectando
                    return {
                        "instance": instance,
                        "state": state,
                        "connected": (state == "open"),
                        "raw": data,
                    }
                elif res.status_code == 404:
                    return {
                        "instance": instance,
                        "state": "not_created",
                        "connected": False,
                    }
                else:
                    return {
                        "instance": instance,
                        "state": "error",
                        "connected": False,
                        "detail": res.text,
                    }
        except httpx.ConnectError:
            logger.warning(f"Evolution API inalcanzable en {self.base_url}")
            return {
                "instance": instance,
                "state": "offline",
                "connected": False,
                "error": "Gateway de WhatsApp offline o inalcanzable",
            }
        except Exception as e:
            logger.error(f"Error consultando estado de Evolution API: {e}")
            return {
                "instance": instance,
                "state": "error",
                "connected": False,
                "error": str(e),
            }

    async def create_instance(self, instance_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Crea la instancia en Evolution API si no existe.
        """
        instance = instance_name or self.default_instance
        url = f"{self.base_url}/instance/create"
        payload = {
            "instanceName": instance,
            "qrcode": True,
            "integration": "WHATSAPP-BAILEYS",
            "rejectCall": False,
            "groupsIgnore": True,
            "alwaysOnline": True,
            "readMessages": False,
        }

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.post(url, json=payload, headers=self._headers())
                if res.status_code in (200, 201):
                    logger.info(f"Instancia {instance} creada con éxito en Evolution API")
                    return {"success": True, "data": res.json()}
                elif res.status_code in (400, 403):
                    # Probablemente ya existe
                    return {"success": True, "already_exists": True, "detail": res.text}
                else:
                    return {"success": False, "status_code": res.status_code, "detail": res.text}
        except Exception as e:
            logger.error(f"Error al crear instancia {instance}: {e}")
            return {"success": False, "error": str(e)}

    async def get_qr_code(self, instance_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Solicita o renueva el código QR para vincular el WhatsApp del supermercado.
        Si la instancia no existe, la crea primero.
        """
        instance = instance_name or self.default_instance

        # 1. Verificar estado actual
        status_info = await self.get_instance_status(instance)
        if status_info.get("state") == "not_created":
            await self.create_instance(instance)

        # Si ya está conectada, no requiere QR
        if status_info.get("connected"):
            return {
                "instance": instance,
                "state": "open",
                "connected": True,
                "message": "La instancia ya se encuentra conectada",
            }

        # 2. Conectar y solicitar QR
        url = f"{self.base_url}/instance/connect/{instance}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, headers=self._headers())
                if res.status_code in (200, 201):
                    data = res.json()
                    # Evolution API devuelve qrcode en base64 o pairing code
                    qrcode_base64 = data.get("base64") or data.get("qrcode", {}).get("base64")
                    pairing_code = data.get("pairingCode")
                    return {
                        "instance": instance,
                        "state": "connecting",
                        "connected": False,
                        "qrcode": qrcode_base64,
                        "pairing_code": pairing_code,
                        "count": data.get("count", 0),
                    }
                else:
                    return {
                        "instance": instance,
                        "state": "error",
                        "connected": False,
                        "detail": res.text,
                    }
        except Exception as e:
            logger.error(f"Error obteniendo QR de instancia {instance}: {e}")
            return {"instance": instance, "state": "error", "error": str(e)}

    async def disconnect_instance(self, instance_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Desconecta la sesión de WhatsApp limpiamente.
        """
        instance = instance_name or self.default_instance
        url = f"{self.base_url}/instance/logout/{instance}"

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.delete(url, headers=self._headers())
                return {
                    "instance": instance,
                    "success": res.status_code in (200, 201, 204),
                    "status_code": res.status_code,
                    "response": res.text,
                }
        except Exception as e:
            logger.error(f"Error desconectando instancia {instance}: {e}")
            return {"instance": instance, "success": False, "error": str(e)}

    async def send_text_message(
        self,
        phone: str,
        text: str,
        instance_name: Optional[str] = None,
        delay_ms: int = 1200,
    ) -> Dict[str, Any]:
        """
        Envía un mensaje de texto plano con presencia 'composing' y delay humanizado anti-spam.
        """
        normalized = normalize_phone_e164(phone)
        if not normalized:
            return {
                "success": False,
                "status": "error_numero_invalido",
                "detail": f"Número '{phone}' no es válido para WhatsApp",
            }

        instance = instance_name or self.default_instance
        url = f"{self.base_url}/message/sendText/{instance}"

        payload = {
            "number": normalized,
            "text": text,
            "options": {
                "delay": delay_ms,
                "presence": "composing",
                "linkPreview": False,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload, headers=self._headers())
                if res.status_code in (200, 201):
                    data = res.json()
                    msg_id = data.get("key", {}).get("id") or "evolution-ok"
                    logger.info(f"WhatsApp enviado a {normalized} (msg_id: {msg_id})")
                    return {
                        "success": True,
                        "status": "sent",
                        "message_id": msg_id,
                        "data": data,
                    }
                else:
                    logger.warning(f"Error Evolution API ({res.status_code}): {res.text}")
                    return {
                        "success": False,
                        "status": f"http_{res.status_code}",
                        "detail": res.text,
                    }
        except httpx.ConnectError:
            logger.error(f"Gateway Evolution API inalcanzable en {self.base_url}")
            return {
                "success": False,
                "status": "gateway_offline",
                "detail": "Gateway Evolution API no responde",
            }
        except Exception as e:
            logger.error(f"Excepción al enviar WhatsApp a {normalized}: {e}")
            return {"success": False, "status": "error_excepcion", "detail": str(e)}

    async def send_media_message(
        self,
        phone: str,
        media_url: str,
        caption: str = "",
        file_name: str = "documento.pdf",
        media_type: str = "document",
        instance_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Envía un archivo multimedia (PDF, imagen, video) vía Evolution API.
        """
        normalized = normalize_phone_e164(phone)
        if not normalized:
            return {
                "success": False,
                "status": "error_numero_invalido",
                "detail": f"Número '{phone}' no válido",
            }

        instance = instance_name or self.default_instance
        url = f"{self.base_url}/message/sendMedia/{instance}"

        payload = {
            "number": normalized,
            "media": media_url,
            "mediaType": media_type,
            "caption": caption,
            "fileName": file_name,
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, json=payload, headers=self._headers())
                if res.status_code in (200, 201):
                    data = res.json()
                    msg_id = data.get("key", {}).get("id") or "evolution-media-ok"
                    return {
                        "success": True,
                        "status": "sent",
                        "message_id": msg_id,
                        "data": data,
                    }
                else:
                    return {
                        "success": False,
                        "status": f"http_{res.status_code}",
                        "detail": res.text,
                    }
        except Exception as e:
            logger.error(f"Error al enviar multimedia a {normalized}: {e}")
            return {"success": False, "status": "error_excepcion", "detail": str(e)}


# Singleton
evolution_client = EvolutionClient()
