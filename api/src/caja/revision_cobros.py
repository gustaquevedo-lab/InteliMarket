"""Panel "Revision de cobros": ventas cuyos pagos no cuadran, cobros del terminal
huerfanos (sin venta) y ventas con mas de un proveedor de cobro.

Solo SQL portable: la antiguedad de 15 minutos se calcula en Python.
Sin limites de fecha, los listados miran los ultimos DIAS_VENTANA_DEFECTO dias."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.inteliaudit.service import record_audit_event
from api.src.pos_terminal_transactions.models import PosTerminalTransaction as Cobro
from api.src.rbac.deps import require_permission
from api.src.sales.models import Sale, SalePayment

TIPOS_REVISION = ("no_cuadran", "huerfanos", "multi_proveedor")
MINUTOS_HUERFANO = 15
DIAS_VENTANA_DEFECTO = 7
# Fecha de despliegue del pago mixto: los cobros anteriores nunca se enlazaron a
# su venta, asi que no se listan como huerfanos (inundarian el panel).
HUERFANOS_DESDE = datetime(2026, 10, 12, 0, 0, tzinfo=timezone.utc)


def _validar_tipo(tipo: str) -> None:
    if tipo not in TIPOS_REVISION:
        raise ValueError(f"tipo de revision invalido: {tipo}")


async def listar_revision(
    db: AsyncSession,
    company_id: UUID,
    tipo: str,
    desde: datetime | None = None,
    hasta: datetime | None = None,
    ahora: datetime | None = None,
) -> list[dict]:
    _validar_tipo(tipo)
    ahora = ahora or datetime.now(timezone.utc)
    if desde is None and hasta is None:
        desde = ahora - timedelta(days=DIAS_VENTANA_DEFECTO)

    if tipo == "huerfanos":
        corte = ahora - timedelta(minutes=MINUTOS_HUERFANO)
        desde = HUERFANOS_DESDE if desde is None else max(desde, HUERFANOS_DESDE)
        q = select(
            Cobro.id, Cobro.created_at, Cobro.tipo_operacion, Cobro.monto,
            Cobro.punto_emision, Cobro.exitosa, Cobro.requiere_conciliacion,
            Cobro.nombre_tarjeta, Cobro.codigo_autorizacion,
        ).where(
            Cobro.company_id == company_id,
            Cobro.sale_id.is_(None),
            Cobro.revisado_at.is_(None),
            Cobro.created_at >= desde,
        )
        if hasta is not None:
            q = q.where(Cobro.created_at <= hasta)
        filas = (await db.execute(q.order_by(Cobro.created_at.desc()))).all()
        resultado = []
        for c in filas:
            creado = c.created_at
            if creado is not None and creado.tzinfo is None:
                creado = creado.replace(tzinfo=timezone.utc)
            vieja = bool(c.exitosa) and creado is not None and creado <= corte
            if not (vieja or c.requiere_conciliacion):
                continue
            resultado.append({
                "id": c.id, "fecha": c.created_at, "tipo_operacion": c.tipo_operacion,
                "monto": c.monto, "punto_emision": c.punto_emision, "exitosa": c.exitosa,
                "requiere_conciliacion": c.requiere_conciliacion,
                "nombre_tarjeta": c.nombre_tarjeta, "codigo_autorizacion": c.codigo_autorizacion,
            })
        return resultado

    filtros = [Sale.company_id == company_id, Sale.pagos_revisado_at.is_(None)]
    if desde is not None:
        filtros.append(Sale.fecha >= desde)
    if hasta is not None:
        filtros.append(Sale.fecha <= hasta)

    if tipo == "no_cuadran":
        q = select(
            Sale.id, Sale.numero, Sale.fecha, Sale.total,
            Sale.pagos_revision, Sale.pagos_diferencia,
        ).where(*filtros, Sale.pagos_revision == "no_cuadran")
        filas = (await db.execute(q.order_by(Sale.fecha.desc()))).all()
        return [{
            "id": v.id, "numero": v.numero, "fecha": v.fecha, "total": v.total,
            "pagos_revision": v.pagos_revision, "pagos_diferencia": v.pagos_diferencia,
        } for v in filas]

    # multi_proveedor: una sola consulta. La subconsulta elige las ventas con
    # 2+ proveedores distintos; la externa trae (venta, proveedor) distintos.
    con_varios = (
        select(Sale.id)
        .join(SalePayment, SalePayment.sale_id == Sale.id)
        .where(*filtros, SalePayment.proveedor.is_not(None))
        .group_by(Sale.id)
        .having(func.count(distinct(SalePayment.proveedor)) >= 2)
    )
    q = (
        select(Sale.id, Sale.numero, Sale.fecha, Sale.total, SalePayment.proveedor)
        .distinct()
        .join(SalePayment, SalePayment.sale_id == Sale.id)
        .where(
            Sale.company_id == company_id,
            Sale.id.in_(con_varios),
            SalePayment.proveedor.is_not(None),
        )
        .order_by(Sale.fecha.desc(), Sale.id)
    )
    resultado: dict = {}
    for fila in (await db.execute(q)).all():
        item = resultado.setdefault(fila.id, {
            "id": fila.id, "numero": fila.numero, "fecha": fila.fecha,
            "total": fila.total, "proveedores": [],
        })
        item["proveedores"].append(fila.proveedor)
    for item in resultado.values():
        item["proveedores"] = sorted(set(item["proveedores"]))
    return list(resultado.values())


async def marcar_revisado(
    db: AsyncSession, company_id: UUID, tipo: str, item_id: UUID, user: dict
) -> bool:
    _validar_tipo(tipo)
    ahora = datetime.now(timezone.utc)
    uid = UUID(str(user["id"]))
    if tipo == "huerfanos":
        obj = (await db.execute(
            select(Cobro).where(Cobro.id == item_id, Cobro.company_id == company_id)
        )).scalar_one_or_none()
        entidad = "cobro_terminal"
        if obj is not None:
            obj.revisado_por, obj.revisado_at = uid, ahora
    else:
        obj = (await db.execute(
            select(Sale).where(Sale.id == item_id, Sale.company_id == company_id)
        )).scalar_one_or_none()
        entidad = "venta"
        if obj is not None:
            obj.pagos_revisado_por, obj.pagos_revisado_at = uid, ahora
    if obj is None:
        return False
    await db.flush()
    await record_audit_event(db, {
        "company_id": company_id,
        "user_id": user["id"],
        "accion": "cobro_revisado",
        "entidad": entidad,
        "entidad_id": item_id,
        "datos_nuevos": {"tipo": tipo},
    })
    return True


router = APIRouter(prefix="/api/v1/caja", tags=["caja-revision-cobros"])


def _empresa_del_usuario(user: dict) -> UUID:
    company_id = user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=400, detail="el usuario no tiene empresa seleccionada")
    try:
        return UUID(str(company_id))
    except ValueError:
        raise HTTPException(status_code=400, detail="empresa invalida")


@router.get("/revision-cobros")
async def listar(
    tipo: str = Query(..., description="no_cuadran | huerfanos | multi_proveedor"),
    desde: datetime | None = None,
    hasta: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("caja:revision_cobros")),
):
    if tipo not in TIPOS_REVISION:
        raise HTTPException(status_code=400, detail="tipo invalido")
    return await listar_revision(db, _empresa_del_usuario(user), tipo, desde, hasta)


@router.post("/revision-cobros/{tipo}/{item_id}/revisar")
async def revisar(
    tipo: str,
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("caja:revision_cobros")),
):
    if tipo not in TIPOS_REVISION:
        raise HTTPException(status_code=400, detail="tipo invalido")
    if not await marcar_revisado(db, _empresa_del_usuario(user), tipo, item_id, user):
        raise HTTPException(status_code=404, detail="no encontrado")
    await db.commit()
    return {"ok": True}
