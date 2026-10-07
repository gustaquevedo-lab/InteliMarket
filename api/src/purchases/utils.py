"""Utilidades de normalización y cotejo canónico para el módulo de compras y Procure-to-Pay."""

from __future__ import annotations

import re
from typing import Optional


def normalize_invoice_number(raw: Optional[str]) -> Optional[str]:
    """Normaliza un número de factura paraguaya al formato canónico DNIT (EEE-PPP-NNNNNNN).
    
    Ejemplos:
        '0010050080098'     -> '001-005-0080098'
        '001-005-0080098'   -> '001-005-0080098'
        '1-1-28206'         -> '001-001-0028206'
        '28206'             -> '001-001-0028206'
    """
    if not raw:
        return None
    raw = raw.strip()
    if not raw:
        return None

    # Formato con guiones estándar (EEE-PPP-NNNNNNN)
    m = re.match(r"^(\d{1,3})[-/](\d{1,3})[-/](\d{1,7})$", raw)
    if m:
        e, p, n = m.groups()
        return f"{e.zfill(3)}-{p.zfill(3)}-{n.zfill(7)}"

    # Si contiene letras o identificadores especiales (ej: "CP-6500B4E0", "VALE-12")
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return raw

    if len(digits) == 13:
        return f"{digits[:3]}-{digits[3:6]}-{digits[6:]}"
    elif len(digits) <= 7:
        return f"001-001-{digits.zfill(7)}"
    elif len(digits) < 13:
        padded = digits.zfill(13)
        return f"{padded[:3]}-{padded[3:6]}-{padded[6:]}"
    else:
        # Más de 13 dígitos: tomar los últimos 13 dígitos
        d = digits[-13:]
        return f"{d[:3]}-{d[3:6]}-{d[6:]}"


def invoice_numbers_match(num1: Optional[str], num2: Optional[str]) -> bool:
    """Compara tolerante si dos números de factura corresponden al mismo comprobante.
    
    Acepta equivalencias como:
        '0010050080098' == '001-005-0080098'
        '0010010008221' == '001-001-0008221'
        '8221'          == '001-001-0008221'
    """
    if not num1 or not num2:
        return False
    s1 = num1.strip().lower()
    s2 = num2.strip().lower()
    if s1 == s2:
        return True

    norm1 = normalize_invoice_number(num1)
    norm2 = normalize_invoice_number(num2)
    if norm1 and norm2 and norm1 == norm2:
        return True

    # Comparar dígitos limpios
    d1 = re.sub(r"\D", "", num1)
    d2 = re.sub(r"\D", "", num2)
    if d1 and d2:
        if d1 == d2:
            return True
        # Si uno es el sufijo de 7 dígitos del otro
        seq1 = d1[-7:] if len(d1) >= 7 else d1.zfill(7)
        seq2 = d2[-7:] if len(d2) >= 7 else d2.zfill(7)
        if seq1 == seq2 and len(d1) >= 3 and len(d2) >= 3:
            return True

    return False


def normalize_ruc(raw: Optional[str]) -> tuple[str, Optional[str]]:
    """Limpia un RUC paraguayo separando el número base y el dígito verificador.
    
    Devuelve (ruc_limpio_sin_dv, dv).
    Ejemplos:
        '80150377-9' -> ('80150377', '9')
        '80150377'   -> ('80150377', None)
    """
    if not raw:
        return ("", None)
    cleaned = raw.strip()
    if "-" in cleaned:
        parts = cleaned.split("-", 1)
        base = re.sub(r"\D", "", parts[0])
        dv = re.sub(r"\D", "", parts[1])
        return (base, dv if dv else None)
    base = re.sub(r"\D", "", cleaned)
    return (base, None)
