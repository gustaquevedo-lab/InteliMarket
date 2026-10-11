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

from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

TOLERANCIA_PAGOS_PYG = Decimal("50")
# Limites de las columnas: sale_payments.monto NUMERIC(15,2), monto_pyg NUMERIC(15,0).
_LIMITE_MONTO = Decimal("1e13")
_LIMITE_MONTO_PYG = Decimal("1e15")


def _importe_valido(valor: Any, limite: Decimal) -> Decimal | None:
    """Devuelve el importe si es finito, no negativo y cabe en la columna; si no, None."""
    if valor is None:
        return None
    try:
        d = Decimal(valor)
    except (ArithmeticError, TypeError, ValueError):
        return None
    if not d.is_finite() or d < 0 or abs(d) >= limite:
        return None
    return d

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
    distintas = {f.strip().upper() for f in formas_pago}
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


async def _descuadre_contra_cobros(
    db: AsyncSession,
    company_id: UUID,
    sale_id: UUID,
    lineas: Sequence[tuple[UUID, Decimal | None]],
) -> Decimal | None:
    """Suma de (linea - cobro) de las lineas que difieren de su cobro enlazado
    en mas de la tolerancia; None si ninguna difiere. Omite cobros sin monto y
    lineas sin monto comparable."""
    from api.src.pos_terminal_transactions.models import PosTerminalTransaction as T

    comparables = [(tid, m) for tid, m in lineas if m is not None]
    if not comparables:
        return None
    res = await db.execute(
        select(T.id, T.monto).where(
            T.id.in_({tid for tid, _ in comparables}),
            T.company_id == company_id,
            T.sale_id == sale_id,
        )
    )
    montos_cobro = {tid: m for tid, m in res.all()}
    descuadre: Decimal | None = None
    for tid, monto_linea in comparables:
        cobrado = montos_cobro.get(tid)
        if cobrado is None:
            continue
        dif = Decimal(monto_linea) - Decimal(cobrado)
        if abs(dif) > TOLERANCIA_PAGOS_PYG:
            descuadre = (descuadre or Decimal("0")) + dif
    return descuadre


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
    monto_descartado = False
    # (terminal_transaction_id, monto de la linea en PYG o None si no se puede comparar)
    contra_cobro: list[tuple[UUID, Decimal | None]] = []
    for p in pagos:
        moneda = (p.moneda or "PYG").strip().upper()[:3] or "PYG"
        forma_pago = (p.forma_pago or "")[:30]
        cuotas = p.cuotas if p.cuotas is not None and 1 <= p.cuotas <= 32767 else None
        referencia = p.referencia[:60] if p.referencia else p.referencia
        proveedor = p.proveedor[:20] if p.proveedor else p.proveedor
        # Importes fuera de rango nunca llegan a la DB (romperian la venta):
        # monto_pyg invalido -> None (PYG usa monto; extranjera queda no_verificable);
        # monto invalido -> 0 y la venta se marca no_cuadran para revision.
        monto_pyg = _importe_valido(p.monto_pyg, _LIMITE_MONTO_PYG)
        monto = _importe_valido(p.monto, _LIMITE_MONTO)
        if monto is None:
            monto, monto_descartado = Decimal("0"), True
        db.add(SalePayment(
            id=uuid4(),
            company_id=company_id,
            sale_id=sale.id,
            forma_pago=forma_pago,
            monto=monto,
            moneda=moneda,
            fecha=ahora,
            proveedor=proveedor,
            terminal_transaction_id=p.terminal_transaction_id,
            referencia=referencia,
            cuotas=cuotas,
            monto_pyg=monto_pyg,
        ))
        lineas.append(LineaPago(forma_pago, monto, moneda, monto_pyg))
        if p.terminal_transaction_id:
            monto_linea = monto_pyg if monto_pyg is not None else (monto if moneda == "PYG" else None)
            contra_cobro.append((p.terminal_transaction_id, monto_linea))

    marca, diferencia = evaluar_pagos(sale.total, lineas)
    if monto_descartado:
        marca = marca_prevalente(marca, "no_cuadran")
    terminal_ids = [p.terminal_transaction_id for p in pagos if p.terminal_transaction_id]
    no_vinculados = (
        await vincular_cobros_terminal(db, company_id, sale.id, terminal_ids)
        if terminal_ids else []
    )
    # Cada linea enlazada a un cobro del terminal debe coincidir con lo que el
    # terminal cobro (misma tolerancia). Si no, se marca no_cuadran; nunca se
    # rechaza la venta (las ventas offline se reenvian y no pueden trabarse).
    descuadre_cobro = await _descuadre_contra_cobros(
        db, company_id, sale.id,
        [(tid, m) for tid, m in contra_cobro if tid not in no_vinculados],
    )
    if descuadre_cobro is not None and diferencia is None:
        diferencia = descuadre_cobro
    sale.pagos_revision = marca_prevalente(
        "enlace_invalido" if no_vinculados else None,
        marca,
        "no_cuadran" if descuadre_cobro is not None else None,
    )
    sale.pagos_diferencia = diferencia
    await db.flush()
