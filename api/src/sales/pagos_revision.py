"""Evaluacion pura de lineas de pago de una venta (pago mixto, Etapa 1).

Sin dependencias de base de datos: recibe el total y las lineas, devuelve
la marca de revision y la diferencia en guaranies.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal

TOLERANCIA_PAGOS_PYG = Decimal("50")

# Prioridad de marcas: la mas grave gana.
_PRIORIDAD_MARCAS = ("enlace_invalido", "no_cuadran", "no_verificable")


@dataclass(frozen=True)
class LineaPago:
    forma_pago: str
    monto: Decimal
    moneda: str
    monto_pyg: Decimal | None


def evaluar_pagos(
    total: Decimal, lineas: Sequence[LineaPago]
) -> tuple[str | None, Decimal | None]:
    """Devuelve (marca, diferencia_pyg) para la venta.

    - Sin lineas: no se valida (None, None).
    - Linea en moneda extranjera sin monto_pyg: no es verificable (no_verificable, None).
    - Suma en PYG fuera de la tolerancia: (no_cuadran, suma - total).
    - Caso contrario: (None, None).
    """
    if not lineas:
        return None, None

    if any(l.moneda != "PYG" and l.monto_pyg is None for l in lineas):
        return "no_verificable", None

    suma = sum(
        (l.monto_pyg if l.monto_pyg is not None else l.monto for l in lineas),
        Decimal("0"),
    )
    diferencia = suma - total
    if abs(diferencia) > TOLERANCIA_PAGOS_PYG:
        return "no_cuadran", diferencia
    return None, None


def marca_prevalente(*marcas: str | None) -> str | None:
    """Elige la marca mas grave entre las recibidas (ignora None)."""
    presentes = {m for m in marcas if m}
    for marca in _PRIORIDAD_MARCAS:
        if marca in presentes:
            return marca
    return None


def forma_pago_resumen(formas_pago: Sequence[str], condicion: str) -> str:
    """Forma de pago resumen de la venta para el encabezado.

    Sin lineas: EXTRA_CLUB si es credito, EFECTIVO en otro caso.
    Una sola forma distinta: esa forma. Varias formas distintas: MIXTO.
    """
    if not formas_pago:
        return "EXTRA_CLUB" if condicion == "credito" else "EFECTIVO"
    distintas = set(formas_pago)
    if len(distintas) == 1:
        return next(iter(distintas))
    return "MIXTO"
