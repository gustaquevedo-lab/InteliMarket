"""Router de Actividades y Rendiciones de Proveedores"""

import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.actividades.models import Actividad, ActividadTramo, ActividadRendicion, ActividadAplicacion
from api.src.actividades.rendicion import (
    obtener_previa_rendicion,
    cerrar_rendicion,
    generar_excel_rendicion,
)
from api.src.purchases.models import Supplier


router = APIRouter(prefix="/api/v1/actividades", tags=["actividades"], dependencies=[Depends(require_auth)])


class CerrarRendicionRequest(BaseModel):
    supplier_id: str
    ciclo: str


def _get_cid(user: dict) -> uuid.UUID:
    cid_str = user.get("company_id") if isinstance(user, dict) else None
    return uuid.UUID(str(cid_str)) if cid_str else uuid.UUID("00000000-0000-0000-0000-000000000010")


def _get_uid(user: dict) -> Optional[uuid.UUID]:
    if isinstance(user, dict):
        uid_str = user.get("id") or user.get("user_id")
        if uid_str:
            try:
                return uuid.UUID(str(uid_str))
            except ValueError:
                return None
    return None


@router.get("")
async def list_actividades(
    supplier_id: Optional[str] = None,
    ciclo: Optional[str] = None,
    tipo: Optional[str] = None,
    activa: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    cid = _get_cid(user)
    stmt = (
        select(Actividad, Supplier.razon_social.label("supplier_nombre"))
        .outerjoin(Supplier, Supplier.id == Actividad.supplier_id)
        .where(Actividad.company_id == cid)
        .options(selectinload(Actividad.tramos))
    )

    if supplier_id:
        try:
            stmt = stmt.where(Actividad.supplier_id == uuid.UUID(supplier_id))
        except ValueError:
            return []
    if ciclo:
        stmt = stmt.where(Actividad.ciclo == ciclo)
    if tipo:
        stmt = stmt.where(Actividad.tipo == tipo)
    if activa is not None:
        stmt = stmt.where(Actividad.activa == activa)

    stmt = stmt.order_by(desc(Actividad.created_at))
    res = await db.execute(stmt)
    rows = res.all()

    result = []
    for act, sup_nom in rows:
        result.append({
            "id": str(act.id),
            "company_id": str(act.company_id),
            "legacy_id": act.legacy_id,
            "nombre": act.nombre,
            "supplier_id": str(act.supplier_id),
            "supplier_nombre": sup_nom or "",
            "ciclo": act.ciclo,
            "vigente_desde": act.vigente_desde.isoformat() if act.vigente_desde else None,
            "vigente_hasta": act.vigente_hasta.isoformat() if act.vigente_hasta else None,
            "tipo": act.tipo,
            "alcance": act.alcance,
            "alcance_ids": [str(i) for i in (act.alcance_ids or [])],
            "presupuesto": float(act.presupuesto or 0),
            "consumido": float(act.consumido or 0),
            "saldo": float((act.presupuesto or 0) - (act.consumido or 0)),
            "pacing_pct": round(float(act.consumido / act.presupuesto * 100), 1) if act.presupuesto and act.presupuesto > 0 else 0.0,
            "valoriza_bonificacion": act.valoriza_bonificacion,
            "cuenta_contable": act.cuenta_contable,
            "activa": act.activa,
            "tramos": [
                {
                    "id": str(t.id),
                    "desde_cantidad": float(t.desde_cantidad or 0),
                    "porcentaje": float(t.porcentaje) if t.porcentaje is not None else None,
                    "cada": float(t.cada) if t.cada is not None else None,
                    "bonifica": float(t.bonifica) if t.bonifica is not None else None,
                    "producto_bonificado_id": str(t.producto_bonificado_id) if t.producto_bonificado_id else None,
                    "tope": float(t.tope) if t.tope is not None else None,
                }
                for t in (act.tramos or [])
            ],
            "created_at": act.created_at.isoformat() if act.created_at else None,
        })
    return result


@router.get("/rendiciones")
async def list_rendiciones(
    supplier_id: Optional[str] = None,
    ciclo: Optional[str] = None,
    estado: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    cid = _get_cid(user)
    stmt = (
        select(ActividadRendicion, Supplier.razon_social.label("supplier_nombre"))
        .outerjoin(Supplier, Supplier.id == ActividadRendicion.supplier_id)
        .where(ActividadRendicion.company_id == cid)
    )

    if supplier_id:
        try:
            stmt = stmt.where(ActividadRendicion.supplier_id == uuid.UUID(supplier_id))
        except ValueError:
            return []
    if ciclo:
        stmt = stmt.where(ActividadRendicion.ciclo == ciclo)
    if estado:
        stmt = stmt.where(ActividadRendicion.estado == estado)

    stmt = stmt.order_by(desc(ActividadRendicion.created_at))
    res = await db.execute(stmt)
    rows = res.all()

    return [
        {
            "id": str(r.id),
            "company_id": str(r.company_id),
            "supplier_id": str(r.supplier_id),
            "supplier_nombre": sup_nom or "",
            "ciclo": r.ciclo,
            "total_descuentos": float(r.total_descuentos or 0),
            "total_bonificaciones": float(r.total_bonificaciones or 0),
            "total_rendicion": float(r.total_rendicion or r.monto or 0),
            "cobrado": float(r.cobrado or 0),
            "saldo_pendiente": float((r.total_rendicion or r.monto or 0) - (r.cobrado or 0)),
            "estado": r.estado,
            "asiento_id": str(r.asiento_id) if r.asiento_id else None,
            "cerrada_at": r.cerrada_at.isoformat() if r.cerrada_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r, sup_nom in rows
    ]


@router.get("/rendiciones/previa")
async def previa_rendicion(
    supplier_id: str = Query(..., description="UUID del proveedor"),
    ciclo: str = Query(..., description="Ciclo en formato AAAAMM"),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    cid = _get_cid(user)
    return await obtener_previa_rendicion(db, cid, supplier_id, ciclo)


@router.post("/rendiciones/cerrar")
async def cerrar_rendicion_endpoint(
    data: CerrarRendicionRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    cid = _get_cid(user)
    uid = _get_uid(user)
    return await cerrar_rendicion(db, cid, data.supplier_id, data.ciclo, uid)


@router.get("/rendiciones/{rendicion_id}/excel")
async def exportar_excel_rendicion(
    rendicion_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    excel_bytes = await generar_excel_rendicion(db, rendicion_id)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="Rendicion_{rendicion_id}.xlsx"'
        },
    )


@router.get("/{actividad_id}")
async def get_actividad(
    actividad_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    cid = _get_cid(user)
    try:
        aid = uuid.UUID(actividad_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID de actividad inválido")

    stmt = (
        select(Actividad, Supplier.razon_social.label("supplier_nombre"))
        .outerjoin(Supplier, Supplier.id == Actividad.supplier_id)
        .where(Actividad.id == aid, Actividad.company_id == cid)
        .options(selectinload(Actividad.tramos))
    )
    res = await db.execute(stmt)
    row = res.first()
    if not row:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")

    act, sup_nom = row
    return {
        "id": str(act.id),
        "company_id": str(act.company_id),
        "legacy_id": act.legacy_id,
        "nombre": act.nombre,
        "supplier_id": str(act.supplier_id),
        "supplier_nombre": sup_nom or "",
        "ciclo": act.ciclo,
        "vigente_desde": act.vigente_desde.isoformat() if act.vigente_desde else None,
        "vigente_hasta": act.vigente_hasta.isoformat() if act.vigente_hasta else None,
        "tipo": act.tipo,
        "alcance": act.alcance,
        "alcance_ids": [str(i) for i in (act.alcance_ids or [])],
        "presupuesto": float(act.presupuesto or 0),
        "consumido": float(act.consumido or 0),
        "saldo": float((act.presupuesto or 0) - (act.consumido or 0)),
        "valoriza_bonificacion": act.valoriza_bonificacion,
        "cuenta_contable": act.cuenta_contable,
        "activa": act.activa,
        "tramos": [
            {
                "id": str(t.id),
                "desde_cantidad": float(t.desde_cantidad or 0),
                "porcentaje": float(t.porcentaje) if t.porcentaje is not None else None,
                "cada": float(t.cada) if t.cada is not None else None,
                "bonifica": float(t.bonifica) if t.bonifica is not None else None,
                "producto_bonificado_id": str(t.producto_bonificado_id) if t.producto_bonificado_id else None,
                "tope": float(t.tope) if t.tope is not None else None,
            }
            for t in (act.tramos or [])
        ],
        "created_at": act.created_at.isoformat() if act.created_at else None,
    }
