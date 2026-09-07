import asyncio
import uuid
from decimal import Decimal
from sqlalchemy import select, text, func
from api.src.db import async_session_factory
from api.src.nemuha_connector.service import _fetch, _save_map, _get_mapped_target
from api.src.products.models import Product
from api.src.smart_pricing.models import TieredPrice

COMPANY_ID = "00000000-0000-0000-0000-000000000010"

async def sync_catalog_prices_and_scales(db, company_id: str) -> dict:
    cid = uuid.UUID(company_id)
    print("1. Trayendo productos y precios desde MySQL est_produto...")
    rows_prod = await _fetch("""
        SELECT ID_PRODUTO, DS_PRODUTO, UNIDADE_MEDIDA, QTD_MINIMA_EM_ESTOQUE,
               VL_PRECO_VENDA_VAREJO, VL_PRECO_VENDA_ATACADO, VL_CUSTO_MEDIO_GS,
               BO_ATIVO, DT_MODIFICACAO
        FROM est_produto;
    """)
    print(f"   -> Leídos {len(rows_prod)} productos de MySQL.")

    print("2. Mapeando productos en PostgreSQL...")
    res = await db.execute(select(Product).where(Product.company_id == cid))
    pg_prods = res.scalars().all()
    sku_to_prod = {p.sku.strip(): p for p in pg_prods if p.sku}
    print(f"   -> {len(sku_to_prod)} productos mapeados por SKU en PostgreSQL.")

    updated_prods = 0
    created_prods = 0

    for r in rows_prod:
        sku = str(r["ID_PRODUTO"]).strip()
        p_venta = Decimal(str(r["VL_PRECO_VENDA_VAREJO"] or 0))
        p_costo = Decimal(str(r["VL_CUSTO_MEDIO_GS"] or 0))
        activo = bool(r["BO_ATIVO"])
        stock_min = int(r["QTD_MINIMA_EM_ESTOQUE"] or 0)

        if sku in sku_to_prod:
            prod = sku_to_prod[sku]
            changed = False
            if prod.precio_venta != p_venta:
                prod.precio_venta = p_venta
                changed = True
            if prod.activo != activo:
                prod.activo = activo
                changed = True
            if p_costo > 0 and prod.costo_promedio != p_costo:
                prod.costo_promedio = p_costo
                prod.ultimo_costo = p_costo
                changed = True
            if prod.stock_minimo != stock_min:
                prod.stock_minimo = stock_min
                changed = True
            if changed:
                prod.updated_at = func.now()
                updated_prods += 1
        else:
            # Crear producto nuevo si no existe
            new_prod = Product(
                company_id=cid,
                sku=sku,
                nombre=r["DS_PRODUTO"] or f"Producto {sku}",
                precio_venta=p_venta,
                costo_promedio=p_costo,
                ultimo_costo=p_costo,
                stock_minimo=stock_min,
                activo=activo,
                unidad_medida=r["UNIDADE_MEDIDA"] or "UN",
            )
            db.add(new_prod)
            await db.flush()
            sku_to_prod[sku] = new_prod
            await _save_map(db, company_id, "est_produto", r["ID_PRODUTO"], "products", new_prod.id)
            created_prods += 1

    print(f"3. Productos actualizados: {updated_prods}, Creados: {created_prods}")

    # 4. Sincronizar escalas por cantidad (sp_tiered_prices)
    print("4. Trayendo escalas por cantidad de MySQL ven_preco_quantidade_produto...")
    rows_tiers = await _fetch("""
        SELECT ID_PRODUTO, QTD_PRODUTO, VL_PRECO_VENDA_VAREJO
        FROM ven_preco_quantidade_produto
        WHERE QTD_PRODUTO >= 2;
    """)
    print(f"   -> Leídas {len(rows_tiers)} escalas de MySQL.")

    res_tp = await db.execute(select(TieredPrice).where(
        TieredPrice.company_id == cid,
        TieredPrice.price_list_id == None
    ))
    existing_tiers = {(tp.product_id, tp.min_qty): tp for tp in res_tp.scalars().all()}
    
    updated_tiers = 0
    created_tiers = 0

    for r in rows_tiers:
        sku = str(r["ID_PRODUTO"]).strip()
        if sku not in sku_to_prod:
            continue
        prod = sku_to_prod[sku]
        min_qty = int(r["QTD_PRODUTO"])
        tier_price = Decimal(str(r["VL_PRECO_VENDA_VAREJO"] or 0))

        key = (prod.id, min_qty)
        if key in existing_tiers:
            tp = existing_tiers[key]
            if tp.precio_unitario != tier_price or not tp.activo:
                tp.precio_unitario = tier_price
                tp.activo = True
                tp.updated_at = func.now()
                updated_tiers += 1
        else:
            tp = TieredPrice(
                company_id=cid,
                product_id=prod.id,
                min_qty=min_qty,
                precio_unitario=tier_price,
                moneda="PYG",
                activo=True
            )
            db.add(tp)
            existing_tiers[key] = tp
            created_tiers += 1

    await db.commit()
    print(f"5. Escalas actualizadas: {updated_tiers}, Creadas: {created_tiers}")
    
    return {
        "updated_prods": updated_prods,
        "created_prods": created_prods,
        "updated_tiers": updated_tiers,
        "created_tiers": created_tiers
    }

async def main():
    async with async_session_factory() as db:
        res = await sync_catalog_prices_and_scales(db, COMPANY_ID)
        print("Resultado final:", res)

if __name__ == '__main__':
    asyncio.run(main())
