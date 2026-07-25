"""Customer portal router — public access for customers"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.sales.models import Sale, SaleItem
from api.src.customers.models import Customer
from api.src.credit_accounts.service import get_credit_account_by_customer, get_movements

router = APIRouter(prefix="/api/public/portal", tags=["portal"])


@router.get("/customer/{customer_id}/sales")
async def customer_sales(
    customer_id: str,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Sale)
        .where(Sale.customer_id == customer_id)
        .order_by(Sale.fecha.desc())
        .limit(limit)
    )
    sales = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "numero": s.numero,
            "fecha": s.fecha.isoformat(),
            "estado": s.estado,
            "total": int(s.total),
            "saldo": int(s.saldo) if s.saldo else 0,
            "total_pagado": int(s.total_pagado) if s.total_pagado else 0,
        }
        for s in sales
    ]


@router.get("/customer/{customer_id}/credit")
async def customer_credit(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
):
    account = await get_credit_account_by_customer(db, "00000000-0000-0000-0000-000000000010", customer_id)
    if not account:
        return {"has_account": False}
    
    movements = await get_movements(db, str(account.id), limit=20)
    
    return {
        "has_account": True,
        "limite_credito": float(account.limite_credito),
        "saldo_disponible": float(account.saldo_disponible),
        "saldo_utilizado": float(account.saldo_utilizado),
        "activo": account.activo,
        "movements": [
            {
                "id": str(m.id),
                "tipo": m.tipo,
                "monto": float(m.monto),
                "saldo_nuevo": float(m.saldo_nuevo),
                "fecha": m.created_at.isoformat(),
                "observaciones": m.observaciones,
            }
            for m in movements
        ],
    }


@router.get("/customer/{customer_id}")
async def customer_info(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {
        "id": str(customer.id),
        "razon_social": customer.razon_social,
        "ruc": customer.ruc,
        "ci": customer.ci,
        "direccion": customer.direccion,
        "telefono": customer.telefono,
        "email": customer.email,
    }
