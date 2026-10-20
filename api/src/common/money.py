"""Única fuente de verdad para montos en guaraníes. Todo cálculo de importes usa estas funciones.

Reglas (Casa Gonzalito / Paraguay):
- Gs. no tiene decimales. Cuando un cálculo da decimales se redondea HACIA ARRIBA al entero en ese
  momento y se guarda el entero: 1567,7 -> 1568; 10 unidades = 15680 (no 15677).
- Única excepción, el IVA: se liquida al MÁS PRÓXIMO (DNIT). 10% = total/11, 5% = total/21.
"""
from decimal import Decimal, ROUND_CEILING, ROUND_HALF_UP


def gs(x) -> Decimal:
    """Monto en Gs.: entero, siempre hacia arriba."""
    return Decimal(str(x or 0)).quantize(Decimal("1"), rounding=ROUND_CEILING)


def iva_incluido(total, tasa) -> Decimal:
    """IVA contenido en un total con IVA incluido, al más próximo. La base es total - IVA."""
    tasa = Decimal(str(tasa or 0))
    if tasa not in (Decimal("5"), Decimal("10")):
        return Decimal("0")
    return (Decimal(str(total)) * tasa / (Decimal("100") + tasa)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def iva_sobre_neto(base, tasa) -> Decimal:
    """IVA a sumar sobre una base neta, al más próximo."""
    return (Decimal(str(base)) * Decimal(str(tasa or 0)) / Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
