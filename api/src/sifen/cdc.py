"""CDC (Código de Control Digital) calculation and validation"""

import hashlib
import re


def generate_cdc(
    ruc_emisor: str,
    tipo_de: str,
    timbrado: str,
    numero: str,
    fecha_emision: str,
    total: str,
    clave_cesion: str = "",
) -> str:
    estructura = (
        f"{ruc_emisor.replace('-', '')}"
        f"{tipo_de.zfill(2)}"
        f"{timbrado.zfill(8)}"
        f"{numero.zfill(10)}"
        f"{fecha_emision.replace('-', '')}"
        f"{str(total).zfill(12)}"
        f"{clave_cesion}"
    )

    cdc = hashlib.sha256(estructura.encode("utf-8")).hexdigest()
    return cdc[:44].upper()


def validate_cdc(cdc: str) -> bool:
    if not cdc or len(cdc) != 44:
        return False
    return bool(re.match(r"^[A-F0-9]{44}$", cdc))


def parse_numero_comprobante(numero: str) -> dict:
    partes = numero.split("-")
    if len(partes) != 3:
        raise ValueError("Formato invalido. Debe ser EST-PUNEXP-SEQ (ej: 001-001-0000001)")
    return {
        "establecimiento": partes[0].zfill(3),
        "punto_expedicion": partes[1].zfill(3),
        "secuencial": partes[2].zfill(7),
    }


def validate_ruc(ruc: str) -> bool:
    limpio = ruc.replace("-", "").replace(" ", "")
    if not re.match(r"^\d{7,9}$", limpio):
        return False
    if len(limpio) == 8:
        digito = int(limpio[-1])
        base = limpio[:7]
        factores = [2, 3, 4, 5, 6, 7, 8]
    elif len(limpio) == 9:
        digito = int(limpio[-1])
        base = limpio[:8]
        factores = [2, 3, 4, 5, 6, 7, 8, 9]
    else:
        return False

    suma = sum(int(b) * f for b, f in zip(base, factores))
    residuo = suma % 11
    verificado = 11 - residuo if residuo > 1 else 0
    return verificado == digito
