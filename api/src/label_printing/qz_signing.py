"""Certificado e identidad digital para QZ Tray (impresion silenciosa de
etiquetas). La clave privada nunca sale del servidor -- QZ Tray solo recibe
el certificado publico y, por cada pedido de impresion, una firma calculada
aca. Esto es lo que permite que "Remember this decision" funcione en QZ Tray:
sin certificado, la conexion es anonima y QZ Tray no deja recordarla."""

import base64
from functools import lru_cache
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

SECRETS_DIR = Path(__file__).resolve().parents[3] / "secrets" / "qz"
CERT_PATH = SECRETS_DIR / "qz-certificate.pem"
KEY_PATH = SECRETS_DIR / "qz-private-key.pem"


@lru_cache(maxsize=1)
def get_certificate_pem() -> str:
    return CERT_PATH.read_text()


@lru_cache(maxsize=1)
def _load_private_key():
    with open(KEY_PATH, "rb") as f:
        return serialization.load_pem_private_key(f.read(), password=None)


def sign_request(to_sign: str) -> str:
    key = _load_private_key()
    signature = key.sign(to_sign.encode("utf-8"), padding.PKCS1v15(), hashes.SHA512())
    return base64.b64encode(signature).decode("ascii")
