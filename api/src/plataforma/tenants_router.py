"""Consola de plataforma -> Empresas (tenants): alta, plan, estado y vencimiento."""
import re
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.common.superadmin import require_superadmin
from api.src.db import get_db
from api.src.plataforma.audit import write_audit
from api.src.tenants.models import Tenant

router = APIRouter(prefix="/api/v1/platform", tags=["platform"])

PLANES = ("starter", "professional", "business", "enterprise")
ESTADOS = ("activo", "prueba", "suspendido", "cancelado")


@router.get("/tenants")
async def list_tenants(_=Depends(require_superadmin), db: AsyncSession = Depends(get_db)):
    ts = (await db.execute(select(Tenant).order_by(Tenant.created_at))).scalars().all()
    users = dict((await db.execute(text("SELECT tenant_id, count(*) FROM user_tenants WHERE activo GROUP BY 1"))).all())
    comps = {}
    for r in (await db.execute(text("SELECT tenant_id, id, razon_social, ruc, activo FROM companies ORDER BY razon_social"))).all():
        comps.setdefault(r[0], []).append({"id": str(r[1]), "razon_social": r[2], "ruc": r[3], "activo": r[4]})
    out = []
    for t in ts:
        cfg = t.config or {}
        out.append({
            "id": str(t.id), "nombre": t.nombre, "slug": t.slug, "schema_name": t.schema_name, "plan": t.plan, "estado": t.estado,
            "fecha_inicio": t.fecha_inicio, "fecha_vencimiento": t.fecha_vencimiento, "contacto_email": t.contacto_email,
            "contacto_phone": t.contacto_phone, "created_at": t.created_at, "usuarios": int(users.get(t.id, 0)),
            "empresas": comps.get(t.id, []), "vertical": cfg.get("vertical") or cfg.get("vertical_slug"),
            "modulos": len(cfg.get("features") or cfg.get("modules") or []),
        })
    return {"planes": list(PLANES), "estados": list(ESTADOS), "items": out}


@router.get("/verticals")
async def list_verticals(_=Depends(require_superadmin)):
    from api.src.verticals.presets import get_all_verticals
    return [{"slug": v.slug, "nombre": getattr(v, "name", None) or getattr(v, "nombre", None) or v.slug,
             "descripcion": getattr(v, "description", None) or getattr(v, "descripcion", None)} for v in get_all_verticals()]


class TenantUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=2, max_length=200)
    plan: str | None = None
    estado: str | None = None
    fecha_vencimiento: date | None = None
    contacto_email: str | None = Field(default=None, max_length=200)
    contacto_phone: str | None = Field(default=None, max_length=20)


@router.put("/tenants/{tenant_id}")
async def update_tenant(tenant_id: str, body: TenantUpdate, request: Request, user=Depends(require_superadmin), db: AsyncSession = Depends(get_db)):
    t = await db.get(Tenant, tenant_id)
    if not t:
        raise HTTPException(404, "Empresa no encontrada")
    if body.plan is not None and body.plan not in PLANES:
        raise HTTPException(422, f"Plan inválido (usá: {', '.join(PLANES)})")
    if body.estado is not None and body.estado not in ESTADOS:
        raise HTTPException(422, f"Estado inválido (usá: {', '.join(ESTADOS)})")
    before, after = {}, {}
    for k in body.model_fields_set:
        v = getattr(body, k)
        old = getattr(t, k)
        if v != old:
            before[k], after[k] = (str(old) if old is not None else None), (str(v) if v is not None else None)
            setattr(t, k, v)
    if after:
        await write_audit(db, user, "tenant_actualizado", target_type="tenant", target_id=str(t.id), target_label=t.nombre, before=before, after=after, request=request)
    return {"ok": True, "changed": sorted(after)}


class TenantCreate(BaseModel):
    nombre: str = Field(min_length=2, max_length=200)
    slug: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{2,60}$")
    plan: str = "starter"
    vertical: str | None = None
    admin_nombre: str = Field(min_length=2, max_length=120)
    admin_email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    admin_password: str = Field(min_length=10, max_length=100)


@router.post("/tenants", status_code=201)
async def create_tenant(body: TenantCreate, request: Request, user=Depends(require_superadmin), db: AsyncSession = Depends(get_db)):
    from api.src.tenants.service import create_tenant_with_schema
    if body.plan not in PLANES:
        raise HTTPException(422, f"Plan inválido (usá: {', '.join(PLANES)})")
    if (await db.execute(select(Tenant).where(Tenant.slug == body.slug))).first():
        raise HTTPException(409, "Ya existe una empresa con ese identificador")
    if (await db.execute(text("SELECT 1 FROM users WHERE lower(email) = lower(:e)"), {"e": body.admin_email})).first():
        raise HTTPException(409, "Ya existe un usuario con ese email")
    try:
        t = await create_tenant_with_schema(db, nombre=body.nombre, slug=body.slug, user_email=body.admin_email, user_password=body.admin_password,
                                            user_nombre=body.admin_nombre, plan=body.plan, vertical_slug=body.vertical)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"No se pudo crear la empresa: {str(e)[:200]}")
    await write_audit(db, user, "tenant_creado", target_type="tenant", target_id=str(t.id), target_label=t.nombre,
                      after={"slug": t.slug, "plan": t.plan, "vertical": body.vertical, "admin": body.admin_email}, request=request)
    return {"id": str(t.id), "schema_name": t.schema_name}
