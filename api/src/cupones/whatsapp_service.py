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


from api.src.whatsapp.evolution_client import evolution_client, normalize_phone_e164


async def send_cupon_whatsapp_confirmation(
    telefono: str,
    nombre: str,
    nro_ticket: str,
    cantidad_cupones: int,
    nombre_fantasia: str = "Extra Supermercado",
    template: Optional[str] = None,
    sorteo_nombre: Optional[str] = None,
    db: Any = None,
    company_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Envía mensaje humanizado de confirmación de cupones vía Evolution API,
    resolviendo prioritariamente la plantilla oficial 'cupon.sorteo' configurada por el usuario.
    """
    plural_cupon = "cupón" if cantidad_cupones == 1 else "cupones"
    sorteo_txt = sorteo_nombre or "Gran Sorteo Aniversario Extra Supermercado"

    resolved_template = template
    if db and company_id:
        try:
            from uuid import UUID
            from api.src.whatsapp.service import get_wa_template
            official_tmpl = await get_wa_template(db, UUID(str(company_id)), "cupon.sorteo")
            if official_tmpl and official_tmpl.strip():
                resolved_template = official_tmpl
        except Exception as e:
            logger.warning(f"No se pudo consultar get_wa_template para cupones: {e}")

    if resolved_template and resolved_template.strip():
        from api.src.whatsapp.service import format_wa_template
        mensaje = format_wa_template(
            resolved_template,
            nombre=nombre.strip(),
            cliente=nombre.strip(),
            cantidad=f"{cantidad_cupones} {plural_cupon}",
            cupones_generados=str(cantidad_cupones),
            sorteo=sorteo_txt,
            campana_sorteo=sorteo_txt,
            ticket=nro_ticket,
            numero=nro_ticket,
            empresa=nombre_fantasia,
        )
    else:
        mensaje = (
            f"¡Hola *{nombre.strip()}*! 👋\n\n"
            f"🎉 Registramos exitosamente tus *{cantidad_cupones} {plural_cupon}* para el *{sorteo_txt}* con tu Ticket *#{nro_ticket}* en *{nombre_fantasia}*.\n\n"
            f"🛒 ¡Muchas gracias por tu compra y mucha suerte! 🍀✨"
        )

    res = await evolution_client.send_text_message(telefono, mensaje, delay_ms=1200)
    if res.get("success"):
        logger.info(f"WhatsApp de cupón enviado a {telefono} (Ticket #{nro_ticket})")
        return {"success": True, "status": "enviado", "response": res.get("data")}
    else:
        logger.warning(f"Fallo al enviar WhatsApp de cupón a {telefono}: {res.get('detail')}")
        return res
