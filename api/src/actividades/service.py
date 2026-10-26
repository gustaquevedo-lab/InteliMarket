"""Servicio de gestión de presupuesto y aplicaciones de actividades de proveedor."""

from decimal import Decimal
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.actividades.models import Actividad, ActividadAplicacion
from api.src.common.money import gs
from api.src.sales.models import SaleItem


async def saldo(db: AsyncSession, actividad_id: str | uuid.UUID) -> Decimal:
    """Calcula el saldo disponible de una actividad (presupuesto - consumido)."""
    if isinstance(actividad_id, str):
        actividad_id = uuid.UUID(actividad_id)
    res = await db.execute(select(Actividad).where(Actividad.id == actividad_id))
    act = res.scalar_one_or_none()
    if not act:
        return Decimal(0)
    return Decimal(str(act.presupuesto)) - Decimal(str(act.consumido))


async def consumir(db: AsyncSession, sale) -> None:
    """Registra las aplicaciones de actividades de los items de la venta y descuenta
    del presupuesto acumulado de cada actividad usando SELECT ... FOR UPDATE.
    Idempotente: si ya existen aplicaciones para sale_id, no hace nada.
    """
    sale_id = sale.id if isinstance(sale.id, uuid.UUID) else uuid.UUID(str(sale.id))

    # [RF3] Idempotencia: si ya hay aplicaciones para este sale_id, no duplicar
    apps_existentes = (
        await db.execute(
            select(ActividadAplicacion.id).where(ActividadAplicacion.sale_id == sale_id).limit(1)
        )
    ).scalars().all()
    if apps_existentes:
        return

    company_id = sale.company_id if isinstance(sale.company_id, uuid.UUID) else uuid.UUID(str(sale.company_id))

    # Buscar items con actividad_id
    items_stmt = select(SaleItem).where(
        SaleItem.sale_id == sale_id,
        SaleItem.actividad_id.isnot(None),
    )
    items = (await db.execute(items_stmt)).scalars().all()
    if not items:
        return

    for item in items:
        # [RF4] SELECT ... FOR UPDATE sobre la actividad
        act_stmt = select(Actividad).where(Actividad.id == item.actividad_id).with_for_update()
        act = (await db.execute(act_stmt)).scalar_one_or_none()
        if not act:
            continue

        cant = Decimal(str(item.cantidad))
        desc_monto = Decimal(str(item.descuento_monto or 0))
        precio_u = Decimal(str(item.precio_unitario or 0))
        costo_u = Decimal(str(item.costo_unitario or 0))
        tot = Decimal(str(item.total or 0))

        # Determinar valor y unidades bonificadas
        if tot == Decimal(0) and desc_monto == Decimal(0):
            # Línea bonificada
            unidades_boni = cant
            if act.valoriza_bonificacion == "costo":
                val = gs(cant * costo_u)
            else:
                val = gs(cant * precio_u)
        else:
            unidades_boni = Decimal(0)
            val = desc_monto

        app = ActividadAplicacion(
            company_id=company_id,
            actividad_id=act.id,
            sale_id=sale_id,
            sale_item_id=item.id,
            descuento_monto=desc_monto,
            unidades_bonificadas=unidades_boni,
            valor=val,
        )
        db.add(app)
        act.consumido = Decimal(str(act.consumido)) + val


async def liberar(db: AsyncSession, sale_id: str | uuid.UUID) -> None:
    """Devuelve el consumo del presupuesto y borra las aplicaciones de la venta anulada."""
    if isinstance(sale_id, str):
        sale_id = uuid.UUID(sale_id)

    # [RF5] Buscar aplicaciones de la venta
    apps_stmt = select(ActividadAplicacion).where(ActividadAplicacion.sale_id == sale_id)
    apps = (await db.execute(apps_stmt)).scalars().all()
    if not apps:
        return

    for app in apps:
        act_stmt = select(Actividad).where(Actividad.id == app.actividad_id).with_for_update()
        act = (await db.execute(act_stmt)).scalar_one_or_none()
        if act:
            act.consumido = max(Decimal(0), Decimal(str(act.consumido)) - Decimal(str(app.valor)))
        await db.delete(app)
