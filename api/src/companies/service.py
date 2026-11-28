"""Company service"""

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal
from datetime import date

from api.src.companies.models import Company
from api.src.companies.schemas import CompanyCreate, CompanyUpdate


async def create_company(db: AsyncSession, data: CompanyCreate) -> Company:
    company = Company(**data.model_dump())
    db.add(company)
    await db.flush()
    await db.refresh(company)
    return company


async def get_company(db: AsyncSession, company_id: str) -> Company | None:
    import uuid
    result = await db.execute(select(Company).where(Company.id == uuid.UUID(company_id)))
    return result.scalar_one_or_none()


async def get_company_by_ruc(db: AsyncSession, ruc: str) -> Company | None:
    result = await db.execute(select(Company).where(Company.ruc == ruc))
    return result.scalar_one_or_none()


async def list_companies(db: AsyncSession) -> list[Company]:
    result = await db.execute(select(Company).order_by(Company.created_at.desc()))
    return list(result.scalars().all())


async def update_company(db: AsyncSession, company_id: str, data: CompanyUpdate) -> Company | None:
    import uuid
    company = await get_company(db, company_id)
    if not company:
        return None

    update_data = data.model_dump(exclude_unset=True)
    if "nombre" in update_data and update_data["nombre"]:
        update_data["nombre_fantasia"] = update_data["nombre"]
    if "nombre" in update_data:
        update_data.pop("nombre", None)

    for key, value in update_data.items():
        if hasattr(company, key):
            setattr(company, key, value)

    # ── Sincronización bidireccional automática de cotizaciones en exchange_rates ──
    if "config" in update_data and isinstance(update_data["config"], dict):
        currs = update_data["config"].get("currencies")
        if isinstance(currs, dict):
            today = date.today()
            for c_code, c_vals in currs.items():
                if c_code in ("BRL", "USD", "ARS") and isinstance(c_vals, dict):
                    t_compra = c_vals.get("compra") or c_vals.get("venta")
                    t_venta = c_vals.get("venta") or c_vals.get("compra")
                    if t_compra and t_venta:
                        try:
                            await db.execute(
                                text("""
                                    INSERT INTO exchange_rates (id, company_id, moneda, tasa_compra, tasa_venta, fuente, fecha, created_at)
                                    VALUES (gen_random_uuid(), :cid, :mon, :tc, :tv, 'empresa_config', :f, NOW())
                                """),
                                {
                                    "cid": company.id,
                                    "mon": c_code,
                                    "tc": Decimal(str(t_compra)),
                                    "tv": Decimal(str(t_venta)),
                                    "f": today,
                                }
                            )
                        except Exception:
                            pass

    await db.flush()
    await db.refresh(company)
    return company


async def delete_company(db: AsyncSession, company_id: str) -> bool:
    import uuid
    company = await get_company(db, company_id)
    if not company:
        return False
    await db.delete(company)
    await db.flush()
    return True


async def get_canonical_company_info(db: AsyncSession, company_id: str) -> dict:
    """Fuente canónica única de datos fiscales y corporativos de la empresa desde PostgreSQL.
    Todos los routers, reportes PDF y tickets deben consultar aquí en vez de hardcodear datos."""
    import uuid
    cid = None
    try:
        cid = uuid.UUID(str(company_id))
    except Exception:
        pass

    row = None
    if cid:
        r = await db.execute(
            text("""
                SELECT id, ruc, razon_social, nombre_fantasia, direccion, ciudad,
                       departamento, telefono, email, timbrado_numero, logo_url
                FROM companies
                WHERE id = :cid
            """),
            {"cid": cid},
        )
        row = r.first()

    timbrado = (row.timbrado_numero if row and row.timbrado_numero else None) or ""
    return {
        "id": str(row.id) if row else str(company_id),
        "razon_social": (row.razon_social if row and row.razon_social else None) or "",
        "ruc": (row.ruc if row and row.ruc else None) or "",
        "nombre_fantasia": (row.nombre_fantasia if row and row.nombre_fantasia else None) or "",
        "direccion": (row.direccion if row and row.direccion else None) or "",
        "ciudad": (row.ciudad if row and row.ciudad else None) or "",
        "departamento": (row.departamento if row and row.departamento else None) or "",
        "telefono": (row.telefono if row and row.telefono else None) or "",
        "email": (row.email if row and row.email else None) or "",
        "timbrado": timbrado,
        "timbrado_numero": timbrado,
        "logo_url": row.logo_url if row else None,
    }
