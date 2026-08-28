"""Evolution API WhatsApp Gateway Service for Cupones Sorteo"""

import httpx
import logging
import re
from typing import Optional, Dict, Any
from api.src.config import settings

logger = logging.getLogger("cupones.whatsapp")


def normalize_phone_e164(phone: Optional[str]) -> Optional[str]:
    """
    Normaliza el número de teléfono al formato internacional E.164 (sin signos + ni guiones).
    Soporta Paraguay (595...) y Brasil (55...).
    """
    if not phone:
        return None
    cleaned = re.sub(r"[^\d]", "", phone)
    if not cleaned:
        return None

    # Si empieza con 09, es Paraguay local -> 5959...
    if cleaned.startswith("09") and len(cleaned) == 10:
        return "595" + cleaned[1:]
    elif cleaned.startswith("9") and len(cleaned) == 9:
        return "595" + cleaned

    # Si ya tiene prefijo 595 o 55
    if cleaned.startswith("595") or cleaned.startswith("55"):
        return cleaned

    # Default: si tiene 9 o 10 dígitos y empieza por 67 o 9
    if len(cleaned) in (10, 11) and cleaned.startswith("67"):
        return "55" + cleaned

    return cleaned


async def send_cupon_whatsapp_confirmation(
    telefono: str,
    nombre: str,
    nro_ticket: str,
    cantidad_cupones: int,
    nombre_fantasia: str = "Extra Supermercado"
) -> Dict[str, Any]:
    """
    Envía mensaje humanizado de confirmación de cupones vía Evolution API local (:8085).
    """
    normalized_num = normalize_phone_e164(telefono)
    if not normalized_num:
        return {"success": False, "status": "error_numero_invalido", "detail": "Número de teléfono no válido"}

    evolution_url = getattr(settings, "evolution_api_url", "http://127.0.0.1:8085")
    api_key = getattr(settings, "evolution_api_key", "intelizapp_master_key_2026")
    instance = getattr(settings, "evolution_instance_name", "supermercado")

    endpoint = f"{evolution_url.rstrip('/')}/message/sendText/{instance}"

    # Formato humanizado del mensaje de sorteo
    plural_cupon = "cupón" if cantidad_cupones == 1 else "cupones"
    mensaje = (
        f"¡Hola *{nombre.strip()}*! 👋\n\n"
        f"🎉 Registramos exitosamente tus *{cantidad_cupones} {plural_cupon}* para el Gran Sorteo con tu Ticket *#{nro_ticket}* en *{nombre_fantasia}*.\n\n"
        f"🛒 ¡Muchas gracias por tu compra y mucha suerte! 🍀✨"
    )

    payload = {
        "number": normalized_num,
        "text": mensaje,
        "options": {
            "delay": 1200,
            "presence": "composing",
            "linkPreview": False
        }
    }

    headers = {
        "Content-Type": "application/json",
        "apikey": api_key
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.post(endpoint, json=payload, headers=headers)
            if response.status_code in (200, 201):
                logger.info(f"WhatsApp de cupón enviado a {normalized_num} (Ticket #{nro_ticket})")
                return {"success": True, "status": "enviado", "response": response.json()}
            else:
                logger.warning(f"Evolution API error {response.status_code}: {response.text}")
                return {"success": False, "status": f"http_{response.status_code}", "detail": response.text}
    except httpx.ConnectError:
        logger.warning(f"Evolution API no accesible en {evolution_url} (¿Contenedor intelizapp-evo offline?)")
        return {"success": False, "status": "gateway_offline", "detail": "Evolution API local no responde"}
    except Exception as e:
        logger.error(f"Error al enviar WhatsApp a {normalized_num}: {e}")
        return {"success": False, "status": "error_excepcion", "detail": str(e)}
