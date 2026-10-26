from datetime import date
from decimal import Decimal
import uuid
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.actividades.models import Actividad, ActividadTramo, ActividadAplicacion
from api.src.common.money import gs
from api.src.products.models import Product
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


def auditar(celular: list[dict], servidor: list[dict], saldos: dict[str, Decimal]) -> list[dict]:
    """Audita las líneas enviadas por el celular contra lo recalculado por el servidor.

    Motivos de diferencia:
    - descuento_sin_actividad: descuento_unitario > 0 sin actividad_id
    - actividad_vencida: actividad_id no existe en las vigentes (no está en saldos)
    - presupuesto_insuficiente: consumo total de la actividad en el pedido excede su saldo
    - bonificada_sin_derecho: línea bonificada en celular no generada por servidor (o exceso de cantidad)
    - descuento_distinto: descuento_unitario diferente al del servidor
    """
    diferencias = []

    # 1. Chequeo de presupuesto global por actividad en el pedido del celular
    consumo_por_actividad: dict[str, Decimal] = {}
    for c in celular:
        act_id = c.get("actividad_id")
        if act_id:
            val = Decimal(str(c.get("valor") or 0))
            if val == 0 and Decimal(str(c.get("descuento_unitario") or 0)) > 0:
                val = Decimal(str(c.get("descuento_unitario") or 0)) * Decimal(str(c.get("cantidad") or 1))
            consumo_por_actividad[act_id] = consumo_por_actividad.get(act_id, Decimal(0)) + val

    actividades_con_presupuesto_insuficiente = set()
    actividades_vencidas = set()
    for act_id, total_consumo in consumo_por_actividad.items():
        if act_id not in saldos:
            actividades_vencidas.add(act_id)
        elif total_consumo > saldos[act_id]:
            actividades_con_presupuesto_insuficiente.add(act_id)

    # Separar líneas regulares y bonificadas
    cel_regulares = [c for c in celular if not c.get("bonificada")]
    cel_bonificadas = [c for c in celular if c.get("bonificada")]

    srv_regulares = [s for s in servidor if not s.get("bonificada")]
    srv_bonificadas = [s for s in servidor if s.get("bonificada")]

    # 2. Auditar líneas regulares
    for i, c in enumerate(cel_regulares):
        pid = str(c.get("product_id"))
        act_id = c.get("actividad_id")
        desc_u = Decimal(str(c.get("descuento_unitario") or 0))

        s = srv_regulares[i] if i < len(srv_regulares) and str(srv_regulares[i].get("product_id")) == pid else next((x for x in srv_regulares if str(x.get("product_id")) == pid), None)
        srv_desc = Decimal(str(s.get("descuento_unitario") or 0)) if s else Decimal(0)
        srv_act = s.get("actividad_id") if s else None

        if desc_u > Decimal(0) and not act_id:
            diferencias.append({
                "product_id": pid,
                "motivo": "descuento_sin_actividad",
                "celular": c,
                "servidor": s or {},
            })
        elif act_id and act_id in actividades_vencidas:
            diferencias.append({
                "product_id": pid,
                "motivo": "actividad_vencida",
                "celular": c,
                "servidor": s or {},
            })
        elif act_id and act_id in actividades_con_presupuesto_insuficiente:
            diferencias.append({
                "product_id": pid,
                "motivo": "presupuesto_insuficiente",
                "celular": c,
                "servidor": s or {},
            })
        elif desc_u != srv_desc or act_id != srv_act:
            diferencias.append({
                "product_id": pid,
                "motivo": "descuento_distinto",
                "celular": c,
                "servidor": s or {},
            })

    # 3. Auditar líneas bonificadas
    for c in cel_bonificadas:
        pid = str(c.get("product_id"))
        act_id = c.get("actividad_id")
        cant_cel = Decimal(str(c.get("cantidad") or 0))

        s = next((x for x in srv_bonificadas if str(x.get("product_id")) == pid and x.get("actividad_id") == act_id), None)
        cant_srv = Decimal(str(s.get("cantidad") or 0)) if s else Decimal(0)

        if not act_id:
            diferencias.append({
                "product_id": pid,
                "motivo": "descuento_sin_actividad",
                "celular": c,
                "servidor": s or {},
            })
        elif act_id in actividades_vencidas:
            diferencias.append({
                "product_id": pid,
                "motivo": "actividad_vencida",
                "celular": c,
                "servidor": s or {},
            })
        elif act_id in actividades_con_presupuesto_insuficiente:
            diferencias.append({
                "product_id": pid,
                "motivo": "presupuesto_insuficiente",
                "celular": c,
                "servidor": s or {},
            })
        elif not s or cant_cel > cant_srv:
            diferencias.append({
                "product_id": pid,
                "motivo": "bonificada_sin_derecho",
                "celular": c,
                "servidor": s or {},
            })

    return diferencias


async def vigentes(db: AsyncSession, company_id: str | uuid.UUID, hoy: date | None = None) -> list[dict]:
    """Retorna las actividades vigentes hoy para la empresa, con tramos y producto_ids ya resueltos."""
    if hoy is None:
        hoy = date.today()
    if isinstance(company_id, str):
        company_id = uuid.UUID(company_id)

    stmt = (
        select(Actividad)
        .options(selectinload(Actividad.tramos))
        .where(
            Actividad.company_id == company_id,
            Actividad.activa == True,
            Actividad.vigente_desde <= hoy,
            Actividad.vigente_hasta >= hoy,
        )
        .order_by(Actividad.vigente_hasta.asc())
    )
    res = await db.execute(stmt)
    actividades = res.scalars().all()
    if not actividades:
        return []

    # Cacheamos productos de la empresa
    prod_stmt = select(Product.id, Product.supplier_id, Product.division_id).where(
        Product.company_id == company_id,
        Product.activo == True,
    )
    prod_res = await db.execute(prod_stmt)
    prods = prod_res.all()

    resultado = []
    for act in actividades:
        saldo_disp = Decimal(str(act.presupuesto)) - Decimal(str(act.consumido))

        if act.alcance == "productos":
            pids = [str(pid) for pid in (act.alcance_ids or [])]
        elif act.alcance == "proveedor":
            pids = [str(p.id) for p in prods if p.supplier_id == act.supplier_id]
        elif act.alcance == "division":
            div_ids = set(act.alcance_ids or [])
            pids = [str(p.id) for p in prods if p.division_id in div_ids]
        else:
            pids = []

        resultado.append({
            "id": str(act.id),
            "nombre": act.nombre,
            "tipo": act.tipo,
            "producto_ids": pids,
            "vigente_hasta": str(act.vigente_hasta),
            "saldo": saldo_disp,
            "valoriza": act.valoriza_bonificacion,
            "tramos": [
                {
                    "desde": Decimal(str(t.desde_cantidad)),
                    "porcentaje": Decimal(str(t.porcentaje)) if t.porcentaje is not None else None,
                    "cada": Decimal(str(t.cada)) if t.cada is not None else None,
                    "bonifica": Decimal(str(t.bonifica)) if t.bonifica is not None else None,
                    "producto_bonificado_id": str(t.producto_bonificado_id) if t.producto_bonificado_id else None,
                    "tope": Decimal(str(t.tope)) if t.tope is not None else None,
                }
                for t in act.tramos
            ],
        })

    return resultado

