"""Cifrado en reposo de credenciales guardadas en payment_integration_configs
(los unicos campos que hoy pasan por aca: bancard_qr.private_key,
bancard_qr.callback_password, plugpay.password -- ver SENSITIVE_CONFIG_KEYS
en payment_integrations/service.py, la unica lista de la verdad). Antes esas
credenciales se guardaban en texto plano en la columna JSON -- sanitize_config()
las sacaba de las respuestas al frontend, pero cualquiera con acceso directo
a la base (un backup, una replica, un SELECT * en un reporte) se las
llevaba igual.

La clave se deriva de ENCRYPTION_KEY (o de jwt_secret_key si no esta seteada,
para no romper un despliegue viejo) via SHA-256 -- Fernet necesita una clave
de 32 bytes url-safe-base64.

OJO -- lo unico que sabe descifrar esto es payment_integrations.service.
get_config() (via set_committed_value, solo en memoria). Cualquier otro
codigo que lea payment_integration_configs con un SELECT propio (como hacia
bancard_qr/router.py con el callback, hasta que se corrigio) se queda
comparando/usando el texto cifrado tal cual -- rompe en silencio, sin ningun
error visible, porque el valor sigue siendo un string valido. Si agregas un
campo sensible nuevo o un lugar nuevo que lo lea, pasa por ese get_config()."""

import base64
import hashlib
import logging

from cryptography.fernet import Fernet, InvalidToken

from api.src.config import settings

log = logging.getLogger("intelimarket.payment_integrations.crypto")

_PREFIX = "enc:"  # marca un valor como cifrado, para no romper filas viejas en texto plano


def _fernet() -> Fernet:
    key_material = hashlib.sha256((settings.encryption_key or settings.jwt_secret_key).encode("utf-8")).digest()
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
        # Antes esto devolvia el texto cifrado tal cual, sin avisar nada --
        # asi paso desapercibido el bug del callback de Bancard QR (ver
        # bancard_qr/router.py). Ahora al menos queda una incidencia: el
        # logging handler de plataforma/capture.py convierte cualquier
        # logger.error() de "intelimarket.*" en un issue de la consola.
        log.error("No se pudo descifrar un valor de payment_integration_configs -- clave equivocada o dato corrupto (queda devuelto tal cual, cifrado).")
        return value
