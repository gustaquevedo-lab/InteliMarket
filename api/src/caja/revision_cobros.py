"""Panel "Revision de cobros": ventas cuyos pagos no cuadran, cobros del terminal
huerfanos (sin venta) y ventas con mas de un proveedor de cobro.

Solo SQL portable: la antiguedad de 15 minutos se calcula en Python."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.inteliaudit.service import record_audit_event
from api.src.pos_terminal_transactions.models import PosTerminalTransaction as Cobro
from api.src.rbac.deps import require_permission
from api.src.sales.models import Sale, SalePayment

TIPOS_REVISION = ("no_cuadran", "huerfanos", "multi_proveedor")
MINUTOS_HUERFANO = 15


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

    if tipo == "huerfanos":
        corte = ahora - timedelta(minutes=MINUTOS_HUERFANO)
        q = select(Cobro).where(
            Cobro.company_id == company_id,
            Cobro.sale_id.is_(None),
            Cobro.revisado_at.is_(None),
        )
        if desde is not None:
            q = q.where(Cobro.created_at >= desde)
        if hasta is not None:
            q = q.where(Cobro.created_at <= hasta)
        filas = (await db.execute(q.order_by(Cobro.created_at.desc()))).scalars().all()
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

    q = select(Sale).where(Sale.company_id == company_id, Sale.pagos_revisado_at.is_(None))
    if tipo == "no_cuadran":
        q = q.where(Sale.pagos_revision == "no_cuadran")
    if desde is not None:
        q = q.where(Sale.fecha >= desde)
    if hasta is not None:
        q = q.where(Sale.fecha <= hasta)
    ventas = (await db.execute(q.order_by(Sale.fecha.desc()))).scalars().all()

    if tipo == "no_cuadran":
        return [{
            "id": v.id, "numero": v.numero, "fecha": v.fecha, "total": v.total,
            "pagos_revision": v.pagos_revision, "pagos_diferencia": v.pagos_diferencia,
        } for v in ventas]

    if not ventas:
        return []
    ids = [v.id for v in ventas]
    pagos = (await db.execute(
        select(SalePayment.sale_id, SalePayment.proveedor).where(
            SalePayment.sale_id.in_(ids), SalePayment.proveedor.is_not(None)
        )
    )).all()
    por_venta: dict = {}
    for sale_id, proveedor in pagos:
        por_venta.setdefault(sale_id, set()).add(proveedor)
    return [{
        "id": v.id, "numero": v.numero, "fecha": v.fecha, "total": v.total,
        "proveedores": sorted(por_venta[v.id]),
    } for v in ventas if len(por_venta.get(v.id, ())) >= 2]


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
    return await listar_revision(db, UUID(str(user["company_id"])), tipo, desde, hasta)


@router.post("/revision-cobros/{tipo}/{item_id}/revisar")
async def revisar(
    tipo: str,
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_permission("caja:revision_cobros")),
):
    if tipo not in TIPOS_REVISION:
        raise HTTPException(status_code=400, detail="tipo invalido")
    if not await marcar_revisado(db, UUID(str(user["company_id"])), tipo, item_id, user):
        raise HTTPException(status_code=404, detail="no encontrado")
    await db.commit()
    return {"ok": True}
