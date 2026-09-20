from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features.deps import require_feature
from api.src.customer360 import service
from api.src.customer360.schemas import (
    Customer360DashboardResponse,
)

router = APIRouter(
    prefix="/api/v1/customer360",
    tags=["customer360"],
    dependencies=[Depends(require_feature("customer360")), Depends(require_auth)],
)


@router.get("/dashboard")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_dashboard(db, user["company_id"])


@router.get("/profile/{customer_id}")
async def get_customer_profile(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.get_customer_profile_360(db, user["company_id"], customer_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al calcular perfil 360: {str(e)}")


@router.post("/basket/compute/{customer_id}")
async def compute_basket(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.compute_basket_analysis(db, user["company_id"], customer_id)


@router.get("/basket/{customer_id}")
async def get_basket(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_basket_analysis(db, user["company_id"], customer_id)
    if not result:
        raise HTTPException(status_code=404, detail="Basket analysis not found — run compute first")
    return result


@router.post("/penetration/compute/{customer_id}")
async def compute_penetration(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.compute_penetration(db, user["company_id"], customer_id)


@router.get("/penetration/{customer_id}")
async def get_penetration(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_penetration(db, user["company_id"], customer_id)


@router.post("/churn/predict/{customer_id}")
async def predict_churn(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.predict_churn(db, user["company_id"], customer_id)


@router.get("/churn/{customer_id}")
async def get_churn(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_churn_prediction(db, user["company_id"], customer_id)
    if not result:
        raise HTTPException(status_code=404, detail="Churn prediction not found — run predict first")
    return result


@router.get("/churn/high-risk")
async def list_high_risk(
    min_score: float = Query(50),
    limit: int = Query(50),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_high_risk_churn(db, user["company_id"], min_score, limit)


@router.post("/lifecycle/compute/{customer_id}")
async def compute_lifecycle(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.compute_lifecycle(db, user["company_id"], customer_id)


@router.get("/lifecycle/{customer_id}")
async def get_lifecycle(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_lifecycle(db, user["company_id"], customer_id)
    if not result:
        raise HTTPException(status_code=404, detail="Lifecycle not found — run compute first")
    return result


@router.get("/recovery")
async def list_recovery(
    status: Optional[str] = Query(None),
    limit: int = Query(50),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_recovery_campaigns(db, user["company_id"], status, limit)


@router.post("/recovery/{campaign_id}/notify")
async def notify_recovery(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.notify_recovery(db, user["company_id"], campaign_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/recovery/{campaign_id}/redeem")
async def redeem_recovery(
    campaign_id: str,
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.redeem_recovery(
            db, user["company_id"], campaign_id,
            data.get("sale_id", ""), data.get("amount", 0),
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/bulk-compute")
async def bulk_compute(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    from api.src.customers.models import Partner
    from sqlalchemy import select

    r = await db.execute(select(Partner).where(Partner.company_id == user["company_id"]))
    customers = r.scalars().all()

    results = {"basket": 0, "penetration": 0, "churn": 0, "lifecycle": 0}
    for c in customers:
        cid = str(c.id)
        try:
            await service.compute_basket_analysis(db, user["company_id"], cid)
            results["basket"] += 1
        except: pass
        try:
            await service.compute_penetration(db, user["company_id"], cid)
            results["penetration"] += 1
        except: pass
        try:
            await service.predict_churn(db, user["company_id"], cid)
            results["churn"] += 1
        except: pass
        try:
            await service.compute_lifecycle(db, user["company_id"], cid)
            results["lifecycle"] += 1
        except: pass

    await db.flush()
    return results


# ── IA LOCAL QWEN 2.5: PERFILADO Y EDICIÓN INTERACTIVA DE CONDUCTA ──

@router.post("/profile/{customer_id}/reanalyze")
async def reanalyze_customer_with_qwen(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Re-analiza al cliente invocando el modelo local Qwen 2.5 en Ollama y actualiza su expediente."""
    from api.src.customer360.qwen_service import profile_customer_with_qwen
    try:
        profile_res = await profile_customer_with_qwen(db, customer_id)
        return profile_res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error durante el re-análisis con Qwen IA: {str(e)}")


@router.patch("/customers/{customer_id}/tags")
async def update_customer_tags(
    customer_id: str,
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Actualiza interactivamente los tags de comportamiento del cliente."""
    from api.src.customers.models import Customer
    import uuid

    cid = uuid.UUID(customer_id) if isinstance(customer_id, str) else customer_id
    res = await db.execute(select(Customer).where(Customer.id == cid))
    customer = res.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    new_tags = data.get("tags", [])
    if not isinstance(new_tags, list):
        raise HTTPException(status_code=400, detail="'tags' debe ser una lista de strings")

    customer.tags = [str(t).strip() for t in new_tags if str(t).strip()]
    await db.commit()
    await db.refresh(customer)
    return {"customer_id": str(customer.id), "tags": customer.tags}


@router.patch("/customers/{customer_id}/archetype")
async def update_customer_archetype(
    customer_id: str,
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Modifica el arquetipo asignado al cliente."""
    from api.src.customers.models import Customer
    import uuid

    cid = uuid.UUID(customer_id) if isinstance(customer_id, str) else customer_id
    res = await db.execute(select(Customer).where(Customer.id == cid))
    customer = res.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    new_arch = str(data.get("arquetipo", "")).strip()
    customer.arquetipo = new_arch
    await db.commit()
    await db.refresh(customer)
    return {"customer_id": str(customer.id), "arquetipo": customer.arquetipo}


# ── OFERTAS 1-A-1 CON BLINDAJE DE COSTO "TE EXTRAÑAMOS" ──

@router.post("/offers/create")
async def create_offer(
    data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Crea una oferta dirigida y personalizada para el cliente con validación estricta de costo."""
    customer_id = data.get("customer_id")
    product_id = data.get("product_id")
    titulo = data.get("titulo", "Oferta Especial Personalizada")
    descripcion = data.get("descripcion", "")
    tipo = data.get("tipo", "precio_fijo")
    valor = float(data.get("valor", 0))
    dias_validez = int(data.get("dias_validez", 7))

    if not customer_id or not product_id or valor <= 0:
        raise HTTPException(status_code=400, detail="Faltan parámetros requeridos (customer_id, product_id, valor)")

    try:
        offer = await service.create_personalized_offer(
            db=db,
            company_id=str(user["company_id"]),
            customer_id=customer_id,
            product_id=product_id,
            titulo=titulo,
            descripcion=descripcion,
            tipo=tipo,
            valor=valor,
            dias_validez=dias_validez,
        )
        return offer
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creando oferta personalizada: {str(e)}")


@router.get("/customers/{customer_id}/offers")
async def list_customer_offers(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Lista las ofertas personalizadas generadas para un cliente."""
    try:
        return await service.get_customer_offers(db, str(user["company_id"]), customer_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener ofertas: {str(e)}")

