"""Customer API router"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.customers.schemas import CustomerCreate, CustomerUpdate, CustomerResponse
from api.src.customers import service

router = APIRouter(prefix="/api/v1", tags=["customers"])


@router.post("/customers", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(body: CustomerCreate, db: AsyncSession = Depends(get_db)):
    if body.ruc:
        existing = await service.get_customer_by_ruc(db, str(body.company_id), body.ruc)
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un cliente con ese RUC")
    return await service.create_customer(db, body)


@router.get("/companies/{company_id}/customers", response_model=list[CustomerResponse])
async def list_customers(
    company_id: str,
    search: str | None = Query(None),
    activo: bool | None = Query(None),
    tipo: str | None = Query(None),
    exclude_proveedores: bool = Query(False),
    limit: int = Query(10000, le=50000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_customers(db, company_id, search, activo, tipo, exclude_proveedores, limit, offset)


@router.get("/customers/{customer_id}", response_model=CustomerResponse)
async def get_customer(customer_id: str, db: AsyncSession = Depends(get_db)):
    customer = await service.get_customer(db, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return customer


@router.get("/customers/{customer_id}/360")
async def get_customer_360(customer_id: str, db: AsyncSession = Depends(get_db)):
    from api.src.customer360.service import get_customer_profile_360
    customer = await service.get_customer(db, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return await get_customer_profile_360(db, str(customer.company_id), customer_id)


@router.patch("/customers/{customer_id}", response_model=CustomerResponse)
async def update_customer(customer_id: str, body: CustomerUpdate, db: AsyncSession = Depends(get_db)):
    customer = await service.update_customer(db, customer_id, body)
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return customer


@router.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(customer_id: str, db: AsyncSession = Depends(get_db)):
    deleted = await service.delete_customer(db, customer_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")


@router.get("/customers/lookup-ruc/{ruc_or_ci}")
async def lookup_ruc(ruc_or_ci: str, db: AsyncSession = Depends(get_db)):
    """Busca un RUC/CI en base de datos interna y calcula DV oficial SET/DNIT"""
    from sqlalchemy import text
    clean = "".join([c for c in ruc_or_ci if c.isdigit()])
    if not clean:
        raise HTTPException(status_code=400, detail="Documento inválido")

    # 1. Calcular DV oficial SET con Módulo 11
    suma = 0
    factor = 2
    for i in reversed(clean):
        suma += int(i) * factor
        factor = 2 if factor == 11 else factor + 1
    resto = suma % 11
    dv = 11 - resto if resto > 1 else 0
    ruc_completo = f"{clean}-{dv}"

    # 2. Buscar en base de datos local (customers, suppliers, companies)
    query = text("""
        SELECT nombre, razon_social, ruc, telefono, email, 'cliente' as origen
        FROM customers
        WHERE ruc = :ruc OR ruc = :clean OR ci = :clean OR ruc LIKE :prefix
        LIMIT 1
    """)
    r = await db.execute(query, {"ruc": ruc_completo, "clean": clean, "prefix": f"{clean}-%"})
    row = r.fetchone()

    if row:
        return {
            "ruc": row.ruc or ruc_completo,
            "ci": clean,
            "dv": str(dv),
            "nombre": row.nombre or row.razon_social,
            "razon_social": row.razon_social or row.nombre,
            "telefono": row.telefono or "",
            "email": row.email or "",
            "encontrado_en_db": True,
            "fuente": "Base Interna InteliMarket"
        }

    # Buscar en proveedores si no estaba en clientes
    sup_q = text("""
        SELECT nombre, razon_social, ruc, telefono, email
        FROM suppliers
        WHERE ruc = :ruc OR ruc = :clean OR ruc LIKE :prefix
        LIMIT 1
    """)
    sup_r = await db.execute(sup_q, {"ruc": ruc_completo, "clean": clean, "prefix": f"{clean}-%"})
    sup_row = sup_r.fetchone()

    if sup_row:
        return {
            "ruc": sup_row.ruc or ruc_completo,
            "ci": clean,
            "dv": str(dv),
            "nombre": sup_row.nombre or sup_row.razon_social,
            "razon_social": sup_row.razon_social or sup_row.nombre,
            "telefono": sup_row.telefono or "",
            "email": sup_row.email or "",
            "encontrado_en_db": True,
            "fuente": "Padrón Proveedores"
        }

    return {
        "ruc": ruc_completo,
        "ci": clean,
        "dv": str(dv),
        "nombre": "",
        "razon_social": "",
        "encontrado_en_db": False,
        "fuente": "Cálculo Módulo 11 SET"
    }

