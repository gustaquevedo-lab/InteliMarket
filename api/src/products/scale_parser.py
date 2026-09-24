"""Módulo de parsing y resolución de códigos de balanza.
Soporta etiquetas de balanzas de supermercado (Balmak Edge, Toledo Prix, Systel, DIGI)
que emiten códigos EAN-13 con prefijo '2' o '20' para productos pesables a granel.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class ScaleBarcodeMatch:
    raw_barcode: str
    base_barcode: str  # Ej: '2000988' o '200988'
    plu: Optional[int]  # Ej: 988
    importe_o_peso_raw: Optional[str]  # Ej: '00540'
    valor_extraido: Optional[float]  # Ej: 5400 (Gs) o 0.540 (kg)


def parse_scale_barcode(raw_code: str) -> Optional[ScaleBarcodeMatch]:
    """Analiza un código de barras leído por un lector físico. Si corresponde a un código
    de etiqueta emitido por balanzas de sección (panadería, carnicería, verdulería),
    extrae el código base del producto, el PLU y el valor fraccionado (monto o peso).

    Convenciones soportadas:
    1. Formato Extra Supermercado / Ñemuha (Balmak Edge / Toledo):
       '2000' + PLU 3 dígitos + 5 dígitos importe/peso + 1 dígito verificador (13 dígitos)
       Ejemplo: '2000988005408' -> Base: '2000988', PLU: 988, Valor: 540 o 5400
    2. Formato Toledo / Systel de 4 dígitos:
       '20' + PLU 4 dígitos + 5 dígitos valor + 1 checksum (13 dígitos)
       Ejemplo: '200988054003' -> Base: '200988', PLU: 988
    3. Formato GS1 estándar peso variable:
       '2' + PLU 5 dígitos + 5 dígitos valor + 1 checksum (13 dígitos)
       Ejemplo: '200988054008' -> Base: '2000988' o '200988', PLU: 988
    """
    code = (raw_code or "").strip()
    if not code:
        return None

    # Solo aplica a códigos numéricos de balanza de 12 o 13 dígitos que comienzan con '2'
    if not (len(code) in (12, 13) and code.isdigit() and code.startswith("2")):
        return None

    # Si el código tiene 12 o 13 dígitos
    # 1. Formato '2000' + PLU (3 dígitos) + valor
    if code.startswith("2000"):
        base_bc = code[:7]  # '2000988'
        plu_str = code[4:7]  # '988'
        plu = int(plu_str) if plu_str.isdigit() else None
        val_str = code[7:12] if len(code) >= 12 else None
        val = float(val_str) if val_str and val_str.isdigit() else None
        return ScaleBarcodeMatch(
            raw_barcode=code,
            base_barcode=base_bc,
            plu=plu,
            importe_o_peso_raw=val_str,
            valor_extraido=val,
        )

    # 2. Formato '20' + PLU (4 dígitos) + valor
    if code.startswith("20"):
        plu_cand = int(code[2:6]) if code[2:6].isdigit() else None
        val_str = code[6:11] if len(code) == 12 else code[6:12]
        val = float(val_str) if val_str and val_str.isdigit() else None
        return ScaleBarcodeMatch(
            raw_barcode=code,
            base_barcode=code[:6],
            plu=plu_cand,
            importe_o_peso_raw=val_str,
            valor_extraido=val,
        )

    # 3. Formato genérico '2' + 5 dígitos PLU
    plu_cand = int(code[1:6]) if code[1:6].isdigit() else None
    val_str = code[6:11] if len(code) == 12 else code[6:12]
    val = float(val_str) if val_str and val_str.isdigit() else None
    return ScaleBarcodeMatch(
        raw_barcode=code,
        base_barcode=code[:6],
        plu=plu_cand,
        importe_o_peso_raw=val_str,
        valor_extraido=val,
    )
