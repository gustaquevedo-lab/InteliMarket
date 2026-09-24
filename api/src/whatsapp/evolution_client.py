"""Evolution API / IntelliZapp Gateway Client for Intelimarket (Vertical Supermercado).

Maneja la comunicación unificada con la instancia de Evolution API en dev-server,
soportando normalización de números Paraguay (595) / Brasil (55), generación de QR,
consulta de estado de sesión, y envío transaccional de texto y archivos multimedia.
"""

import base64
import logging
import mimetypes
from pathlib import Path
import re
from typing import Any, Dict, Optional
import httpx

from api.src.config import settings

logger = logging.getLogger("whatsapp.evolution")

_UPLOADS_DIR = Path(__file__).resolve().parents[3] / "uploads"


def save_media_file_to_uploads(
    b64_string: str,
    message_id: str,
    mimetype: Optional[str] = None,
    original_name: Optional[str] = None,
) -> str:
    """
    Decodifica base64 y guarda el archivo en uploads/whatsapp_media/.
    Detecta automáticamente extensión y tipo MIME por magic bytes si no se proporciona.
    Retorna la URL relativa '/uploads/whatsapp_media/{filename}'.
    """
    clean_b64 = b64_string
    if "," in clean_b64:
        header, clean_b64 = clean_b64.split(",", 1)
        if not mimetype and "data:" in header and ";base64" in header:
            mimetype = header.split("data:")[1].split(";base64")[0]

    media_dir = _UPLOADS_DIR / "whatsapp_media"
    media_dir.mkdir(parents=True, exist_ok=True)

    try:
        file_bytes = base64.b64decode(clean_b64)
    except Exception as e:
        logger.error(f"Error decodificando base64 para {message_id}: {e}")
        return ""

    ext = "bin"
    if mimetype:
        guessed_ext = mimetypes.guess_extension(mimetype)
        if guessed_ext:
            ext = guessed_ext.lstrip(".")
        if ext in ("jpe", "jpeg"):
            ext = "jpeg"
        elif "ogg" in mimetype:
            ext = "ogg"
        elif "mp4" in mimetype:
            ext = "mp4"
        elif "pdf" in mimetype:
            ext = "pdf"
        elif "webp" in mimetype:
            ext = "webp"
    elif original_name and "." in original_name:
        ext = original_name.rsplit(".", 1)[1].lower()

    # Detección por magic bytes si sigue siendo .bin o genérico
    if ext in ("bin", "") and len(file_bytes) > 12:
        if file_bytes.startswith(b"\xff\xd8\xff"):
            ext = "jpeg"
        elif file_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
            ext = "png"
        elif file_bytes.startswith(b"RIFF") and file_bytes[8:12] == b"WEBP":
            ext = "webp"
        elif file_bytes.startswith(b"%PDF"):
            ext = "pdf"
        elif file_bytes.startswith(b"OggS"):
            ext = "ogg"
        elif file_bytes.startswith(b"ID3") or file_bytes.startswith(b"\xff\xfb"):
            ext = "mp3"
        elif file_bytes[4:8] == b"ftyp":
            ext = "mp4"

    clean_id = re.sub(r"[^\w\-]", "", message_id or "media")
    filename = f"{clean_id}.{ext}"
    target_path = media_dir / filename

    target_path.write_bytes(file_bytes)
    return f"/uploads/whatsapp_media/{filename}"


def normalize_phone_e164(phone: Optional[str]) -> Optional[str]:
    """
    Normaliza el número de teléfono al formato internacional E.164 sin signos '+' ni separadores.
    Soporta Paraguay (595) y Brasil (55). Corrige prefijos duplicados (595595..., 59509..., 5509...).
    """
    if not phone:
        return None
    cleaned = re.sub(r"[^\d]", "", str(phone))
    if not cleaned:
        return None

    # Caso 1: Error común de doble prefijo 595 (ej: 595595971...)
    while cleaned.startswith("595595"):
        cleaned = cleaned[3:]

    # Caso 2: Error de importación -> "5509..." (ej: 550982528386)
    if cleaned.startswith("5509") and len(cleaned) == 12:
        cleaned = "595" + cleaned[3:]

    # Caso 3: 595 con 0 local (ej: 5950985123456 -> 595985123456)
    if cleaned.startswith("59509") and len(cleaned) == 13:
        cleaned = "595" + cleaned[4:]

    # Caso 4: Prefijo 55 erróneo en línea paraguaya (ej: 5597..., 5598..., 5599..., 5596...)
    if cleaned.startswith("55") and len(cleaned) == 11 and cleaned[2:4] in ("96", "97", "98", "99"):
        cleaned = "595" + cleaned[2:]

    # Caso 5: Paraguay local con 0 inicial (ej: 0985 123456 -> 595985123456)
    if cleaned.startswith("09") and len(cleaned) == 10:
        return "595" + cleaned[1:]
    # Paraguay sin 0 (ej: 985 123456 -> 595985123456)
    if cleaned.startswith("9") and len(cleaned) == 9:
        return "595" + cleaned

    # Ya tiene código de país 595
    if cleaned.startswith("595"):
        return cleaned

    # Celulares brasileños frontera sin 55 (DDD 67 u otros de 10 u 11 dígitos)
    if len(cleaned) in (10, 11) and cleaned.startswith("67"):
        return "55" + cleaned

    # Legacy Brasil con 8 dígitos de celular: 55 + DDD (2 dig) + 8 dígitos = 12 dígitos -> insertar 9
    if cleaned.startswith("55") and len(cleaned) == 12:
        ddd = cleaned[2:4]
        subscriber = cleaned[4:]
        return f"55{ddd}9{subscriber}"

    if cleaned.startswith("55"):
        return cleaned

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


    async def get_base64_from_media_message(
        self,
        message_data: dict,
        instance_name: Optional[str] = None,
    ) -> Optional[dict]:
        """
        Descarga y desencripta el archivo multimedia desde Evolution API / Baileys.
        Retorna dict con 'base64', 'mimetype', 'fileName', etc.
        """
        instance = instance_name or self.default_instance
        url = f"{self.base_url}/chat/getBase64FromMediaMessage/{instance}"
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(url, json={"message": message_data, "convertToMp4": False}, headers=self._headers())
                if res.status_code in (200, 201):
                    return res.json()
                else:
                    logger.warning(f"getBase64FromMediaMessage fallo ({res.status_code}): {res.text}")
                    return None
        except Exception as e:
            logger.error(f"Error obteniendo base64 de multimedia: {e}")
            return None

    async def send_media_message(
        self,
        phone: str,
        media_url: str,
        caption: str = "",
        file_name: Optional[str] = None,
        media_type: Optional[str] = None,
        instance_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Envía un archivo multimedia (PDF, imagen, video, audio) vía Evolution API.
        Soporta rutas locales /uploads/... leyéndolas como base64 directo para mayor fiabilidad.
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

        # Preparar payload de multimedia
        media_payload = media_url
        final_file_name = file_name or "archivo"
        final_media_type = media_type

        # Si es una ruta local en /uploads/
        if media_url.startswith("/uploads/"):
            sub_path = media_url.replace("/uploads/", "", 1)
            local_file = _UPLOADS_DIR / sub_path
            if local_file.exists():
                file_bytes = local_file.read_bytes()
                guessed_type, _ = mimetypes.guess_type(str(local_file))
                mtype = guessed_type or "application/octet-stream"
                b64_content = base64.b64encode(file_bytes).decode("ascii")
                media_payload = f"data:{mtype};base64,{b64_content}"
                if not file_name:
                    final_file_name = local_file.name
                if not final_media_type:
                    if mtype.startswith("image/"):
                        final_media_type = "image"
                    elif mtype.startswith("video/"):
                        final_media_type = "video"
                    elif mtype.startswith("audio/"):
                        final_media_type = "audio"
                    else:
                        final_media_type = "document"

        # Si aún no tenemos media_type, inferir por extensión o fallback a document
        if not final_media_type:
            low_url = media_url.lower()
            if any(low_url.endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp", ".gif")):
                final_media_type = "image"
                if not file_name:
                    final_file_name = "imagen.jpg"
            elif any(low_url.endswith(ext) for ext in (".mp4", ".mov", ".avi", ".mkv", ".webm")):
                final_media_type = "video"
                if not file_name:
                    final_file_name = "video.mp4"
            elif any(low_url.endswith(ext) for ext in (".mp3", ".ogg", ".wav", ".m4a", ".aac")):
                final_media_type = "audio"
                if not file_name:
                    final_file_name = "audio.mp3"
            else:
                final_media_type = "document"
                if not file_name:
                    final_file_name = "documento.pdf"

        payload = {
            "number": normalized,
            "media": media_payload,
            "mediaType": final_media_type,
            "caption": caption or "",
            "fileName": final_file_name,
        }

        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                res = await client.post(url, json=payload, headers=self._headers())
                if res.status_code in (200, 201):
                    data = res.json()
                    msg_id = data.get("key", {}).get("id") or "evolution-media-ok"
                    logger.info(f"Multimedia enviado con éxito a {normalized} (tipo: {final_media_type}, msg_id: {msg_id})")
                    return {
                        "success": True,
                        "status": "sent",
                        "message_id": msg_id,
                        "data": data,
                    }
                else:
                    logger.warning(f"Error Evolution sendMedia ({res.status_code}): {res.text}")
                    return {
                        "success": False,
                        "status": f"http_{res.status_code}",
                        "detail": res.text,
                    }
        except Exception as e:
            logger.error(f"Error al enviar multimedia a {normalized}: {e}")
            return {"success": False, "status": "error_excepcion", "detail": str(e)}

    async def send_buttons_message(
        self,
        phone: str,
        text: str,
        buttons: list[dict[str, Any]],
        title: str = "Extra Supermercado",
        footer: str = "Extra Supermercado Mayorista",
        instance_name: Optional[str] = None,
        delay_ms: int = 1000,
    ) -> Dict[str, Any]:
        """
        Envía un mensaje interactivo con botones nativos de WhatsApp vía Evolution API.
        Soporta botones tipo 'reply' (respuestas rápidas) y 'url' (enlaces web).
        Si la entrega con botones falla por compatibilidad, aplica fallback automático a texto.
        """
        normalized = normalize_phone_e164(phone)
        if not normalized:
            return {
                "success": False,
                "status": "error_numero_invalido",
                "detail": f"Número '{phone}' no válido",
            }

        instance = instance_name or self.default_instance
        url = f"{self.base_url}/message/sendButtons/{instance}"

        # Normalizar estructura de botones para Evolution API
        formatted_buttons = []
        for i, b in enumerate(buttons[:3]):  # WhatsApp limita a 3 botones de respuesta rápida
            btn_type = b.get("type", "reply")
            btn_text = b.get("displayText") or b.get("text") or b.get("title") or f"Opción {i+1}"
            btn_id = b.get("id") or b.get("rowId") or f"btn_{i+1}"
            
            btn_obj: dict[str, Any] = {
                "type": btn_type,
                "displayText": str(btn_text)[:20],  # WhatsApp limita texto del botón a 20 chars
            }
            if btn_type == "reply":
                btn_obj["id"] = str(btn_id)
            elif btn_type == "url":
                btn_obj["url"] = b.get("url", "https://superextra.com.py")
            elif btn_type == "call":
                btn_obj["phoneNumber"] = b.get("phoneNumber", "+595981000000")
            formatted_buttons.append(btn_obj)

        payload = {
            "number": normalized,
            "title": title,
            "description": text,
            "footer": footer,
            "buttons": formatted_buttons,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload, headers=self._headers())
                if res.status_code in (200, 201):
                    data = res.json()
                    msg_id = data.get("key", {}).get("id") or "evolution-btn-ok"
                    logger.info(f"Botones WhatsApp enviados a {normalized} (msg_id: {msg_id})")
                    return {
                        "success": True,
                        "status": "sent",
                        "message_id": msg_id,
                        "data": data,
                        "type": "buttons",
                    }
                else:
                    logger.warning(f"sendButtons rechazado ({res.status_code}): {res.text}. Aplicando fallback a texto...")
        except Exception as e:
            logger.warning(f"Error en sendButtons: {e}. Aplicando fallback a texto...")

        # Fallback a texto limpio con botones numerados y enlaces
        fallback_lines = [text, ""]
        number_emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"]
        for idx, b in enumerate(buttons):
            em = number_emojis[idx] if idx < len(number_emojis) else f"{idx+1}."
            b_text = b.get("displayText") or b.get("text") or b.get("title") or f"Opción {idx+1}"
            if b.get("type") == "url" and b.get("url"):
                fallback_lines.append(f"{em} {b_text} 👉 {b.get('url')}")
            else:
                fallback_lines.append(f"{em} *{b_text}*")
        fallback_lines.append(f"\n_{footer}_")

        return await self.send_text_message(normalized, "\n".join(fallback_lines), instance_name=instance, delay_ms=delay_ms)

    async def send_list_message(
        self,
        phone: str,
        text: str,
        sections: list[dict[str, Any]],
        button_text: str = "Ver Opciones 📋",
        title: str = "Extra Supermercado",
        footer: str = "Extra Supermercado Mayorista",
        instance_name: Optional[str] = None,
        delay_ms: int = 1000,
    ) -> Dict[str, Any]:
        """
        Envía un menú interactivo desplegable (List Message) de WhatsApp vía Evolution API.
        Soporta secciones con filas estructuradas (título, descripción, ID).
        Si falla por compatibilidad, aplica fallback automático a texto.
        """
        normalized = normalize_phone_e164(phone)
        if not normalized:
            return {
                "success": False,
                "status": "error_numero_invalido",
                "detail": f"Número '{phone}' no válido",
            }

        instance = instance_name or self.default_instance
        url = f"{self.base_url}/message/sendList/{instance}"

        payload = {
            "number": normalized,
            "title": title,
            "description": text,
            "buttonText": button_text[:20],
            "footerText": footer,
            "sections": sections,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload, headers=self._headers())
                if res.status_code in (200, 201):
                    data = res.json()
                    msg_id = data.get("key", {}).get("id") or "evolution-list-ok"
                    logger.info(f"Lista interactiva WhatsApp enviada a {normalized} (msg_id: {msg_id})")
                    return {
                        "success": True,
                        "status": "sent",
                        "message_id": msg_id,
                        "data": data,
                        "type": "list",
                    }
                else:
                    logger.warning(f"sendList rechazado ({res.status_code}): {res.text}. Aplicando fallback...")
        except Exception as e:
            logger.warning(f"Error en sendList: {e}. Aplicando fallback...")

        # Fallback a texto
        fallback_lines = [f"*{title}*", text, ""]
        num = 1
        for sec in sections:
            if sec.get("title"):
                fallback_lines.append(f"📌 *{sec.get('title')}*")
            for row in sec.get("rows", []):
                r_title = row.get("title", f"Opción {num}")
                r_desc = row.get("description", "")
                if r_desc:
                    fallback_lines.append(f"{num}️⃣ *{r_title}* — {r_desc}")
                else:
                    fallback_lines.append(f"{num}️⃣ *{r_title}*")
                num += 1
            fallback_lines.append("")
        fallback_lines.append(f"_{footer}_")

        return await self.send_text_message(normalized, "\n".join(fallback_lines), instance_name=instance, delay_ms=delay_ms)


# Singleton
evolution_client = EvolutionClient()
