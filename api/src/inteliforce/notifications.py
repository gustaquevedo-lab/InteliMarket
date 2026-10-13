"""Push notifications para la app Inteliforce (FCM HTTP v1).

Utiliza Google Cloud Service Account (api/fcm-service-account.json) para
autenticación segura con OAuth2 Bearer Tokens en FCM v1 API.
Los tokens de dispositivo se almacenan en inteliforce_devices.
"""

import json
import logging
import os
import time
from pathlib import Path
from typing import Any
from uuid import UUID

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.inteliforce.models import InteliforceDevice

logger = logging.getLogger(__name__)

# Rutas posibles para las credenciales de Service Account
CREDENTIAL_PATHS = [
    os.getenv("FCM_SERVICE_ACCOUNT_PATH"),
    str(Path(__file__).resolve().parent.parent.parent / "fcm-service-account.json"),
    str(Path.cwd() / "api" / "fcm-service-account.json"),
    str(Path.cwd() / "fcm-service-account.json"),
]

SCOPES = ["https://www.googleapis.com/auth/firebase.messaging"]

_cached_creds = None
_cached_token: str | None = None
_cached_token_expiry: float = 0.0
_project_id: str | None = None


def _get_credentials():
    """Carga las credenciales del Service Account desde el archivo JSON."""
    global _cached_creds, _project_id
    if _cached_creds:
        return _cached_creds, _project_id

    cred_file = None
    for p in CREDENTIAL_PATHS:
        if p and Path(p).is_file():
            cred_file = p
            break

    if not cred_file:
        logger.warning("FCM Service Account JSON no encontrado. Buscado en: %s", [p for p in CREDENTIAL_PATHS if p])
        return None, None

    try:
        from google.oauth2 import service_account
        _cached_creds = service_account.Credentials.from_service_account_file(cred_file, scopes=SCOPES)
        _project_id = _cached_creds.project_id or "intelimarket-distribuidora-py"
        logger.info("FCM Service Account cargado correctamente para proyecto: %s", _project_id)
        return _cached_creds, _project_id
    except Exception as e:
        logger.error("Error al cargar credenciales de Service Account FCM: %s", e)
        return None, None


def _get_access_token() -> tuple[str | None, str | None]:
    """Obtiene un OAuth2 Bearer Token válido con refresco automático."""
    global _cached_token, _cached_token_expiry
    creds, project_id = _get_credentials()
    if not creds or not project_id:
        return None, None

    now = time.time()
    # Si el token existe y le quedan más de 60 segundos de validez, reutilizar
    if _cached_token and now < _cached_token_expiry - 60:
        return _cached_token, project_id

    try:
        import google.auth.transport.requests
        req = google.auth.transport.requests.Request()
        creds.refresh(req)
        _cached_token = creds.token
        # Google tokens suelen expirar en 3600 segundos
        _cached_token_expiry = now + 3500
        return _cached_token, project_id
    except Exception as e:
        logger.error("Error renovando OAuth2 Access Token para FCM v1: %s", e)
        return None, None


async def _get_tokens(db: AsyncSession, sales_rep_id: UUID) -> list[str]:
    r = await db.execute(
        select(InteliforceDevice.fcm_token).where(
            InteliforceDevice.sales_rep_id == sales_rep_id,
            InteliforceDevice.activo == True,
            InteliforceDevice.fcm_token.isnot(None),
        )
    )
    return [row[0] for row in r.all()]


async def _get_supervisor_tokens(db: AsyncSession, supervisor_id: UUID) -> list[str]:
    return await _get_tokens(db, supervisor_id)


async def _send_fcm_v1_message(message: dict[str, Any]) -> bool:
    """Envía un mensaje individual vía FCM HTTP v1 API."""
    token, project_id = _get_access_token()
    if not token or not project_id:
        logger.warning("FCM no configurado o token no disponible — mensaje omitido")
        return False

    url = f"https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {"message": message}

    try:
        async with httpx.AsyncClient(timeout=10) as http:
            resp = await http.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                return True
            else:
                logger.error("FCM v1 error %s: %s", resp.status_code, resp.text[:300])
                return False
    except Exception as e:
        logger.error("Excepción al enviar FCM v1: %s", e)
        return False


async def send_to_rep(
    db: AsyncSession,
    sales_rep_id: UUID,
    title: str,
    body: str,
    data: dict | None = None,
) -> None:
    tokens = await _get_tokens(db, sales_rep_id)
    if not tokens:
        return

    string_data = {str(k): str(v) for k, v in (data or {}).items()}
    for tok in tokens:
        msg = {
            "token": tok,
            "notification": {"title": title, "body": body},
            "data": string_data,
            "android": {
                "priority": "HIGH",
                "notification": {
                    "sound": "default",
                    "channel_id": "default",
                },
            },
        }
        await _send_fcm_v1_message(msg)


async def send_to_supervisor(
    db: AsyncSession,
    supervisor_id: UUID,
    title: str,
    body: str,
    data: dict | None = None,
) -> None:
    tokens = await _get_supervisor_tokens(db, supervisor_id)
    if not tokens:
        return

    string_data = {str(k): str(v) for k, v in (data or {}).items()}
    for tok in tokens:
        msg = {
            "token": tok,
            "notification": {"title": title, "body": body},
            "data": string_data,
            "android": {
                "priority": "HIGH",
                "notification": {
                    "sound": "default",
                    "channel_id": "default",
                },
            },
        }
        await _send_fcm_v1_message(msg)


async def send_to_topic(
    topic: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> bool:
    """Envía un broadcast a un topic (ej: 'preventistas', 'choferes', 'all')."""
    clean_topic = topic.replace("/topics/", "")
    string_data = {str(k): str(v) for k, v in (data or {}).items()}
    msg = {
        "topic": clean_topic,
        "notification": {"title": title, "body": body},
        "data": string_data,
        "android": {
            "priority": "HIGH",
            "notification": {
                "sound": "default",
                "channel_id": "default",
            },
        },
    }
    return await _send_fcm_v1_message(msg)


async def send_silent_sync(
    db: AsyncSession,
    sales_rep_id: UUID,
    action: str,
    extra_data: dict | None = None,
) -> None:
    """Envía un push silencioso (data-only) para sincronización en segundo plano."""
    tokens = await _get_tokens(db, sales_rep_id)
    if not tokens:
        return

    payload_data = {"type": "silent_sync", "action": action}
    if extra_data:
        payload_data.update({str(k): str(v) for k, v in extra_data.items()})

    for tok in tokens:
        msg = {
            "token": tok,
            "data": payload_data,
            "android": {
                "priority": "NORMAL",
            },
        }
        await _send_fcm_v1_message(msg)


async def send_silent_sync_topic(
    topic: str,
    action: str,
    extra_data: dict | None = None,
) -> bool:
    """Envía un push silencioso a un topic para actualizar stock/catálogo a todos."""
    clean_topic = topic.replace("/topics/", "")
    payload_data = {"type": "silent_sync", "action": action}
    if extra_data:
        payload_data.update({str(k): str(v) for k, v in extra_data.items()})

    msg = {
        "topic": clean_topic,
        "data": payload_data,
        "android": {
            "priority": "NORMAL",
        },
    }
    return await _send_fcm_v1_message(msg)


# ── Notificaciones de negocio ──────────────────────────────────────────────────

async def notify_order_approved(db: AsyncSession, sales_rep_id: UUID, numero: str) -> None:
    await send_to_rep(db, sales_rep_id, "Pedido aprobado ✓", f"Pedido #{numero} fue aprobado.", {"type": "order_approved", "numero": numero})


async def notify_order_rejected(db: AsyncSession, sales_rep_id: UUID, numero: str, motivo: str = "") -> None:
    await send_to_rep(db, sales_rep_id, "Pedido rechazado", f"Pedido #{numero} fue rechazado. {motivo}".strip(), {"type": "order_rejected", "numero": numero})


async def notify_new_route(db: AsyncSession, sales_rep_id: UUID) -> None:
    await send_to_rep(db, sales_rep_id, "Nueva ruta asignada", "Tenés una nueva ruta para hoy. Revisá tus paradas.", {"type": "new_route", "viewMode": "map"})


async def notify_route_optimized(
    db: AsyncSession,
    sales_rep_id: UUID,
    route_name: str,
    stops_count: int,
    distance_km: float | None = None,
    duration_min: int | None = None,
) -> None:
    """Notifica al preventista que su ruta fue optimizada por el supervisor con Google Routes."""
    details = f"({stops_count} paradas)"
    if distance_km and duration_min:
        details += f" • {distance_km:.1f} km • ~{duration_min} min"

    await send_to_rep(
        db,
        sales_rep_id,
        "⚡ Ruta Optimizada",
        f"Tu supervisor optimizó el recorrido de '{route_name}' {details}. El camino más eficiente ya está listo en tu mapa.",
        {
            "type": "route_optimized",
            "route_name": route_name,
            "stops_count": str(stops_count),
            "viewMode": "map",
        },
    )


async def notify_target_achieved(db: AsyncSession, sales_rep_id: UUID, linea: str, pct: float) -> None:
    await send_to_rep(db, sales_rep_id, "Meta alcanzada 🎯", f"Alcanzaste el {pct:.0f}% de tu meta en {linea}.", {"type": "target_achieved", "linea": linea})


async def notify_expiry_alert(db: AsyncSession, supervisor_id: UUID, customer_nombre: str, producto_nombre: str, dias: int) -> None:
    await send_to_supervisor(
        db, supervisor_id,
        "Alerta de vencimiento ⚠️",
        f"{producto_nombre} en {customer_nombre} vence en {dias} días.",
        {"type": "expiry_alert", "dias": str(dias)},
    )


async def notify_incident(db: AsyncSession, supervisor_id: UUID, tipo: str, customer_nombre: str, rep_nombre: str) -> None:
    labels = {"quiebre": "Quiebre de stock", "producto_danado": "Producto dañado", "falta_espacio": "Falta de espacio", "competencia": "Actividad de competencia"}
    label = labels.get(tipo, "Incidencia")
    await send_to_supervisor(
        db, supervisor_id,
        f"{label} reportado",
        f"{rep_nombre} reportó {label.lower()} en {customer_nombre}.",
        {"type": "incident", "tipo": tipo},
    )

