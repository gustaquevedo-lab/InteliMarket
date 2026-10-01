"""Customer API router"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.customers.schemas import CustomerCreate, CustomerUpdate, CustomerResponse
from api.src.customers import service

router = APIRouter(prefix="/api/v1", tags=["customers"], dependencies=[Depends(require_auth)])


@router.post("/customers", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(body: CustomerCreate, db: AsyncSession = Depends(get_db)):
    clean_ruc = "".join([c for c in (body.ruc or "").split("-")[0] if c.isdigit()])
    clean_ci = "".join([c for c in (body.ci or "") if c.isdigit()])
    doc_check = clean_ci if len(clean_ci) >= 5 else clean_ruc
    if doc_check and len(doc_check) >= 5:
        existing = await service.get_customer_by_doc(db, str(body.company_id), doc_check)
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un cliente con ese documento o RUC")
    elif body.ruc:
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
    updated_since: datetime | None = Query(None),
    limit: int = Query(50000, le=100000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_customers(db, company_id, search, activo, tipo, exclude_proveedores, limit, offset, updated_since=updated_since)


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
    raw_str = str(ruc_or_ci).strip()
    if "-" in raw_str:
        clean = "".join([c for c in raw_str.split("-")[0] if c.isdigit()])
    else:
        clean = "".join([c for c in raw_str if c.isdigit()])
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
        SELECT razon_social, nombre_fantasia, ruc, ci, tipo, tipo_persona, telefono, email, 'cliente' as origen
        FROM customers
        WHERE ruc = :ruc OR ruc = :clean OR ci = :clean OR ruc LIKE :prefix
        LIMIT 1
    """)
    r = await db.execute(query, {"ruc": ruc_completo, "clean": clean, "prefix": f"{clean}-%"})
    row = r.fetchone()

    if row:
        es_jur = (row.tipo_persona == "juridica" or str(row.ruc).startswith("80"))
        return {
            "ruc": row.ruc or ruc_completo,
            "ci": "" if es_jur else (row.ci or clean),
            "dv": str(row.ruc.split("-")[1]) if (row.ruc and "-" in row.ruc) else str(dv),
            "nombre": row.nombre_fantasia or row.razon_social,
            "razon_social": row.razon_social or row.nombre_fantasia,
            "telefono": row.telefono or "",
            "email": row.email or "",
            "tipo": row.tipo or ("contribuyente" if es_jur else "consumidor_final"),
            "tipo_persona": "juridica" if es_jur else "fisica",
            "encontrado_en_db": True,
            "fuente": "Base Interna InteliMarket"
        }

    # Buscar en proveedores si no estaba en clientes
    sup_q = text("""
        SELECT razon_social, ruc, telefono, email
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
            "nombre": sup_row.razon_social,
            "razon_social": sup_row.razon_social,
            "telefono": sup_row.telefono or "",
            "email": sup_row.email or "",
            "encontrado_en_db": True,
            "fuente": "Padrón Proveedores"
        }

    # 3. Buscar en Padrón Oficial DNIT (ruc_dnit.db - 2.015.147 contribuyentes)
    import sqlite3
    import os
    dnit_paths = [
        "/home/intellihouse/intelimarket/ruc_dnit.db",
        os.path.expanduser("~/Library/CloudStorage/OneDrive-Personal/Dev/Intelimarket/ruc_dnit.db"),
        "ruc_dnit.db"
    ]
    for dnit_path in dnit_paths:
        if os.path.exists(dnit_path):
            try:
                with sqlite3.connect(dnit_path, timeout=1.0) as con_dnit:
                    cur_dnit = con_dnit.cursor()
                    r_dnit = cur_dnit.execute("SELECT ruc, dv, razon_social, estado FROM contribuyentes WHERE ruc = ?", (clean,)).fetchone()
                    clean_root = clean
                    if not r_dnit and len(clean) >= 6:
                        clean_sub = clean[:-1]
                        r_sub = cur_dnit.execute("SELECT ruc, dv, razon_social, estado FROM contribuyentes WHERE ruc = ?", (clean_sub,)).fetchone()
                        if r_sub and str(r_sub[1]) == clean[-1]:
                            r_dnit = r_sub
                            clean_root = clean_sub

                    if r_dnit:
                        es_juridica = clean_root.startswith("80") or any(w in r_dnit[2] for w in [" S.A", " S.R.L", " E.A.S", " SOCIEDAD", " LTDA", " CIA", " S.C."])
                        return {
                            "ruc": f"{clean_root}-{r_dnit[1]}",
                            "ci": "" if es_juridica else clean_root,
                            "dv": str(r_dnit[1]),
                            "nombre": r_dnit[2],
                            "razon_social": r_dnit[2],
                            "telefono": "",
                            "email": "",
                            "tipo": "contribuyente",
                            "tipo_persona": "juridica" if es_juridica else "fisica",
                            "estado_ruc": r_dnit[3],
                            "encontrado_en_db": True,
                            "fuente": "DNIT RUC Oficial"
                        }
            except Exception:
                pass
            break

    # 4. Buscar en Padrón Nacional TSJE (padron.db - 5.056.228 electores)
    padron_paths = [
        "/home/intellihouse/intelimarket/padron.db",
        os.path.expanduser("~/Library/CloudStorage/OneDrive-Personal/Dev/Bingo30k/padron.db"),
        "padron.db"
    ]
    for p_path in padron_paths:
        if os.path.exists(p_path):
            try:
                with sqlite3.connect(p_path, timeout=1.0) as con_p:
                    cur_p = con_p.cursor()
                    r_p = cur_p.execute("SELECT nombre, apellido FROM electors WHERE ci = ?", (clean,)).fetchone()
                    if r_p:
                        full_name = f"{r_p[0]} {r_p[1]}".strip().upper()
                        return {
                            "ruc": ruc_completo,
                            "ci": clean,
                            "dv": str(dv),
                            "nombre": full_name,
                            "razon_social": full_name,
                            "telefono": "",
                            "email": "",
                            "tipo": "consumidor_final",
                            "tipo_persona": "fisica",
                            "encontrado_en_db": True,
                            "fuente": "Padrón Nacional TSJE"
                        }
            except Exception:
                pass
            break

    return {
        "ruc": ruc_completo,
        "ci": clean,
        "dv": str(dv),
        "nombre": "",
        "razon_social": "",
        "tipo": "consumidor_final",
        "tipo_persona": "fisica",
        "encontrado_en_db": False,
        "fuente": "Cálculo Módulo 11 SET"
    }

