"""Evaluacion pura de lineas de pago de una venta (pago mixto, Etapa 1).

Sin dependencias de base de datos: recibe el total y las lineas, devuelve
la marca de revision y la diferencia en guaranies.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import or_, update
from sqlalchemy.ext.asyncio import AsyncSession

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


# ---------------------------------------------------------------------------
# Persistencia: enlace de cobros del terminal y registro de lineas de pago
# ---------------------------------------------------------------------------
async def vincular_cobros_terminal(
    db: AsyncSession,
    company_id: UUID,
    sale_id: UUID,
    terminal_ids: Sequence[UUID],
) -> list[UUID]:
    """Enlaza cobros del terminal a la venta. Devuelve los ids NO enlazados.

    Solo enlaza cobros de la misma empresa que esten libres o ya enlazados a
    esta misma venta (idempotente). Nunca pisa el enlace de otra venta.
    """
    from api.src.pos_terminal_transactions.models import PosTerminalTransaction as T

    no_vinculados: list[UUID] = []
    for tid in dict.fromkeys(terminal_ids):
        res = await db.execute(
            update(T)
            .where(
                T.id == tid,
                T.company_id == company_id,
                or_(T.sale_id.is_(None), T.sale_id == sale_id),
            )
            .values(sale_id=sale_id)
        )
        if res.rowcount == 0:
            no_vinculados.append(tid)
    return no_vinculados


async def registrar_pagos_de_venta(
    db: AsyncSession,
    *,
    company_id: UUID,
    sale: Any,
    pagos: Sequence[Any],
    ahora: datetime,
) -> None:
    """Crea las lineas SalePayment, enlaza cobros y fija la marca de revision.

    Nunca lanza por problemas de pagos o enlaces: solo marca la venta.
    """
    from api.src.sales.models import SalePayment

    lineas: list[LineaPago] = []
    for p in pagos:
        moneda = (p.moneda or "PYG").upper()
        cuotas = p.cuotas if p.cuotas is not None and 1 <= p.cuotas <= 32767 else None
        referencia = p.referencia[:60] if p.referencia else p.referencia
        proveedor = p.proveedor[:20] if p.proveedor else p.proveedor
        db.add(SalePayment(
            id=uuid4(),
            company_id=company_id,
            sale_id=sale.id,
            forma_pago=p.forma_pago,
            monto=p.monto,
            moneda=moneda,
            fecha=ahora,
            proveedor=proveedor,
            terminal_transaction_id=p.terminal_transaction_id,
            referencia=referencia,
            cuotas=cuotas,
            monto_pyg=p.monto_pyg,
        ))
        lineas.append(LineaPago(p.forma_pago, p.monto, moneda, p.monto_pyg))

    marca, diferencia = evaluar_pagos(sale.total, lineas)
    terminal_ids = [p.terminal_transaction_id for p in pagos if p.terminal_transaction_id]
    no_vinculados = (
        await vincular_cobros_terminal(db, company_id, sale.id, terminal_ids)
        if terminal_ids else []
    )
    sale.pagos_revision = marca_prevalente(
        "enlace_invalido" if no_vinculados else None, marca
    )
    sale.pagos_diferencia = diferencia
    await db.flush()
