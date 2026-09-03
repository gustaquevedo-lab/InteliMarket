"""Cifrado en reposo de credenciales guardadas en payment_integration_configs
(y label_printer_configs/intelifact_configs, que guardan el mismo tipo de
dato sensible). Antes las credenciales de PlugPay (client_id/password/
tokens) se guardaban en texto plano en la columna JSON -- sanitize_config()
las sacaba de las respuestas al frontend, pero cualquiera con acceso directo
a la base (un backup, una replica, un SELECT * en un reporte) se las
llevaba igual.

La clave se deriva de jwt_secret_key (ya es un secreto real en .env de
produccion, no hay que agregar una variable nueva) via SHA-256 -- Fernet
necesita una clave de 32 bytes url-safe-base64."""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from api.src.config import settings

_PREFIX = "enc:"  # marca un valor como cifrado, para no romper filas viejas en texto plano


def _fernet() -> Fernet:
    key_material = hashlib.sha256(settings.jwt_secret_key.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(key_material))


def encrypt_value(plain: str) -> str:
    if not plain:
        return plain
    token = _fernet().encrypt(plain.encode("utf-8")).decode("utf-8")
    return _PREFIX + token


def decrypt_value(value: str) -> str:
    if not value or not value.startswith(_PREFIX):
        return value  # fila vieja en texto plano, o valor vacio -- se devuelve tal cual
    try:
        return _fernet().decrypt(value[len(_PREFIX):].encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return value
