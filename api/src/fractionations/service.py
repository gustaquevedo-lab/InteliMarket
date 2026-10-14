"""Product fractionation service -- lógica de negocio para displays y unidades desglosadas."""

import uuid
from typing import Optional
from uuid import UUID
from fastapi import HTTPException
from sqlalchemy import select, func, text, or_
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.fractionations.models import ProductFractionation
from api.src.fractionations.schemas import (
    FractionationLinkInput,
    FractionationQuickCreateChildInput,
    FractionationExecuteStockInput,
    FractionationInfoResponse,
    FractionationSummaryProduct,
)
from api.src.products.models import Product
from api.src.pack_barcodes.models import ProductPackBarcode
from api.src.variants.models import ProductVariant
from api.src.inventory.models import Stock, Warehouse, InventoryMovement


async def get_fractionation_for_product(
    db: AsyncSession, company_id: str | UUID, product_id: str | UUID
) -> FractionationInfoResponse:
    c_uuid = UUID(str(company_id))
    p_uuid = UUID(str(product_id))

    # Buscar si es display (parent)
    frac_parent = await db.scalar(
        select(ProductFractionation).where(
            ProductFractionation.company_id == c_uuid,
            ProductFractionation.parent_product_id == p_uuid,
            ProductFractionation.activo == True,
        )
    )

    if frac_parent:
        child_prod = await db.get(Product, frac_parent.child_product_id)
        if child_prod:
            # Obtener stock total del child
            stock_res = await db.execute(
                select(func.coalesce(func.sum(Stock.cantidad), 0)).where(
                    Stock.product_id == child_prod.id
                )
            )
            child_stock = float(stock_res.scalar() or 0)

            return FractionationInfoResponse(
                es_display=True,
                es_unidad_fraccionada=False,
                relacion_id=frac_parent.id,
                factor_conversion=frac_parent.factor_conversion,
                unidad_child=FractionationSummaryProduct(
                    id=child_prod.id,
                    codigo_barra=child_prod.codigo_barra,
                    nombre=child_prod.nombre,
                    costo_promedio=float(child_prod.costo_promedio or child_prod.ultimo_costo or 0),
                    precio_promedio=float(child_prod.precio_venta or 0),
                    stock_actual=child_stock,
                ),
            )

    # Buscar si es unidad fraccionada (child)
    frac_child = await db.scalar(
        select(ProductFractionation).where(
            ProductFractionation.company_id == c_uuid,
            ProductFractionation.child_product_id == p_uuid,
            ProductFractionation.activo == True,
        )
    )

    if frac_child:
        parent_prod = await db.get(Product, frac_child.parent_product_id)
        if parent_prod:
            stock_res = await db.execute(
                select(func.coalesce(func.sum(Stock.cantidad), 0)).where(
                    Stock.product_id == parent_prod.id
                )
            )
            parent_stock = float(stock_res.scalar() or 0)

            return FractionationInfoResponse(
                es_display=False,
                es_unidad_fraccionada=True,
                relacion_id=frac_child.id,
                factor_conversion=frac_child.factor_conversion,
                display_parent=FractionationSummaryProduct(
                    id=parent_prod.id,
                    codigo_barra=parent_prod.codigo_barra,
                    nombre=parent_prod.nombre,
                    costo_promedio=float(parent_prod.costo_promedio or parent_prod.ultimo_costo or 0),
                    precio_promedio=float(parent_prod.precio_venta or 0),
                    stock_actual=parent_stock,
                ),
            )

    return FractionationInfoResponse(
        es_display=False,
        es_unidad_fraccionada=False,
        relacion_id=None,
        factor_conversion=None,
        display_parent=None,
        unidad_child=None,
    )


async def link_fractionation(
    db: AsyncSession, company_id: str | UUID, parent_id: str | UUID, data: FractionationLinkInput
) -> ProductFractionation:
    c_uuid = UUID(str(company_id))
    parent_uuid = UUID(str(parent_id))
    child_uuid = UUID(str(data.child_product_id))

    if parent_uuid == child_uuid:
        raise HTTPException(
            status_code=400,
            detail="Un producto no puede ser su propio display o unidad fraccionada.",
        )

    parent_prod = await db.get(Product, parent_uuid)
    if not parent_prod or parent_prod.company_id != c_uuid:
        raise HTTPException(status_code=404, detail="Producto display no encontrado.")

    child_prod = await db.get(Product, child_uuid)
    if not child_prod or child_prod.company_id != c_uuid:
        raise HTTPException(status_code=404, detail="Producto unitario no encontrado.")

    # Validar que parent no esté ya vinculado
    existing_parent = await db.scalar(
        select(ProductFractionation).where(
            ProductFractionation.company_id == c_uuid,
            ProductFractionation.activo == True,
            or_(
                ProductFractionation.parent_product_id == parent_uuid,
                ProductFractionation.child_product_id == parent_uuid,
            ),
        )
    )
    if existing_parent:
        raise HTTPException(
            status_code=400,
            detail="El producto display ya forma parte de otra relación de fraccionamiento activa.",
        )

    # Validar que child no esté ya vinculado
    existing_child = await db.scalar(
        select(ProductFractionation).where(
            ProductFractionation.company_id == c_uuid,
            ProductFractionation.activo == True,
            or_(
                ProductFractionation.parent_product_id == child_uuid,
                ProductFractionation.child_product_id == child_uuid,
            ),
        )
    )
    if existing_child:
        raise HTTPException(
            status_code=400,
            detail="El producto unitario seleccionado ya forma parte de otra relación de fraccionamiento.",
        )

    frac = ProductFractionation(
        company_id=c_uuid,
        parent_product_id=parent_uuid,
        child_product_id=child_uuid,
        factor_conversion=data.factor_conversion,
        activo=True,
    )
    db.add(frac)
    await db.commit()
    await db.refresh(frac)
    return frac


async def quick_create_child_and_link(
    db: AsyncSession,
    company_id: str | UUID,
    parent_id: str | UUID,
    data: FractionationQuickCreateChildInput,
    user_id: Optional[UUID] = None,
) -> dict:
    c_uuid = UUID(str(company_id))
    parent_uuid = UUID(str(parent_id))

    parent_prod = await db.get(Product, parent_uuid)
    if not parent_prod or parent_prod.company_id != c_uuid:
        raise HTTPException(status_code=404, detail="Producto display no encontrado.")

    # Validar que parent no esté ya vinculado como display o como unidad
    existing_parent = await db.scalar(
        select(ProductFractionation).where(
            ProductFractionation.company_id == c_uuid,
            ProductFractionation.activo == True,
            or_(
                ProductFractionation.parent_product_id == parent_uuid,
                ProductFractionation.child_product_id == parent_uuid,
            ),
        )
    )
    if existing_parent:
        raise HTTPException(
            status_code=400,
            detail="El producto display ya cuenta con una relación de fraccionamiento activa.",
        )

    codigo_limpio = data.codigo_barra.strip()

    # Validar colisión de código de barras
    prod_exists = await db.scalar(
        select(Product.id).where(
            Product.company_id == c_uuid,
            or_(Product.codigo_barra == codigo_limpio, Product.sku == codigo_limpio),
        )
    )
    if prod_exists:
        raise HTTPException(
            status_code=400,
            detail=f"El código de barras '{codigo_limpio}' ya está registrado en otro producto.",
        )

    var_exists = await db.scalar(
        select(ProductVariant.id).where(
            ProductVariant.company_id == c_uuid,
            ProductVariant.codigo_barra == codigo_limpio,
        )
    )
    if var_exists:
        raise HTTPException(
            status_code=400,
            detail=f"El código de barras '{codigo_limpio}' ya está registrado en una variante.",
        )

    pack_exists = await db.scalar(
        select(ProductPackBarcode.id).where(
            ProductPackBarcode.company_id == c_uuid,
            ProductPackBarcode.codigo_barra == codigo_limpio,
        )
    )
    if pack_exists:
        raise HTTPException(
            status_code=400,
            detail=f"El código de barras '{codigo_limpio}' ya está registrado en un pack o código alternativo.",
        )

    # Costo sugerido prorrateado
    costo_parent = float(parent_prod.costo_promedio or parent_prod.ultimo_costo or 0)
    costo_child = round(costo_parent / data.factor_conversion, 0) if costo_parent > 0 else 0.0

    # Precio unitario definido o sugerido
    if data.precio_unitario is not None and data.precio_unitario > 0:
        precio_child = float(data.precio_unitario)
    else:
        precio_parent = float(parent_prod.precio_venta or 0)
        precio_child = round(precio_parent / data.factor_conversion, 0) if precio_parent > 0 else 0.0

    # SKU único para la unidad
    sku_base = f"{parent_prod.sku or 'SKU'}-UN"
    sku_candidato = sku_base
    cont = 1
    while await db.scalar(select(Product.id).where(Product.company_id == c_uuid, Product.sku == sku_candidato)):
        cont += 1
        sku_candidato = f"{sku_base}-{cont}"

    child_prod = Product(
        company_id=c_uuid,
        sku=sku_candidato,
        nombre=data.nombre.strip(),
        descripcion=f"Unidad individual fraccionada de {parent_prod.nombre}",
        codigo_barra=codigo_limpio,
        unidad_medida="UN",
        tipo="producto",
        tipo_venta="unidad",
        categoria_id=parent_prod.categoria_id,
        supplier_id=getattr(parent_prod, "supplier_id", None),
        costo_promedio=costo_child,
        ultimo_costo=costo_child,
        precio_venta=precio_child,
        precio_regular=precio_child,
        iva_tasa=parent_prod.iva_tasa,
        activo=True,
    )
    db.add(child_prod)
    await db.flush()

    # Vincular fraccionamiento
    frac = ProductFractionation(
        company_id=c_uuid,
        parent_product_id=parent_uuid,
        child_product_id=child_prod.id,
        factor_conversion=data.factor_conversion,
        activo=True,
    )
    db.add(frac)

    await db.commit()
    await db.refresh(child_prod)
    await db.refresh(frac)

    return {
        "relacion_id": str(frac.id),
        "factor_conversion": frac.factor_conversion,
        "child_product": {
            "id": str(child_prod.id),
            "sku": child_prod.sku,
            "nombre": child_prod.nombre,
            "codigo_barra": child_prod.codigo_barra,
            "costo_promedio": costo_child,
            "precio_venta": precio_child,
        },
    }


async def execute_stock_fractionation(
    db: AsyncSession,
    company_id: str | UUID,
    parent_id: str | UUID,
    data: FractionationExecuteStockInput,
    user_id: Optional[UUID] = None,
) -> dict:
    c_uuid = UUID(str(company_id))
    parent_uuid = UUID(str(parent_id))

    frac = await db.scalar(
        select(ProductFractionation).where(
            ProductFractionation.company_id == c_uuid,
            ProductFractionation.parent_product_id == parent_uuid,
            ProductFractionation.activo == True,
        )
    )
    if not frac:
        raise HTTPException(
            status_code=400,
            detail="El producto no está configurado como Display con unidades fraccionables.",
        )

    parent_prod = await db.get(Product, parent_uuid)
    child_prod = await db.get(Product, frac.child_product_id)
    if not parent_prod or not child_prod:
        raise HTTPException(status_code=404, detail="Productos de la relación no encontrados.")

    # Obtener depósito
    if data.sucursal_id:
        s_uuid = UUID(str(data.sucursal_id))
        warehouse = await db.scalar(
            select(Warehouse).where(
                Warehouse.company_id == c_uuid,
                Warehouse.activo == True,
                or_(Warehouse.id == s_uuid, Warehouse.branch_id == s_uuid),
            )
        )
    else:
        warehouse = await db.scalar(
            select(Warehouse).where(
                Warehouse.company_id == c_uuid,
                Warehouse.activo == True,
            ).order_by(Warehouse.tipo == "principal", Warehouse.created_at.asc())
        )

    if not warehouse:
        raise HTTPException(status_code=400, detail="No se encontró un depósito activo en la empresa.")

    cant_displays = data.cantidad_displays
    cant_unidades = cant_displays * frac.factor_conversion

    # Obtener stock display
    stock_display = await db.scalar(
        select(Stock).where(
            Stock.warehouse_id == warehouse.id,
            Stock.product_id == parent_uuid,
        )
    )
    if not stock_display:
        stock_display = Stock(
            warehouse_id=warehouse.id,
            product_id=parent_uuid,
            cantidad=0,
            costo_unitario=int(parent_prod.costo_promedio or parent_prod.ultimo_costo or 0),
        )
        db.add(stock_display)
        await db.flush()

    if stock_display.cantidad < cant_displays:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Stock insuficiente en '{warehouse.nombre}': "
                f"Hay {stock_display.cantidad} display(s) disponible(s) y se solicitó fraccionar {cant_displays}."
            ),
        )

    # Obtener o crear stock child
    stock_child = await db.scalar(
        select(Stock).where(
            Stock.warehouse_id == warehouse.id,
            Stock.product_id == child_prod.id,
        )
    )
    costo_unitario_child = int(
        round(float(stock_display.costo_unitario or parent_prod.costo_promedio or 0) / frac.factor_conversion, 0)
    )
    if not stock_child:
        stock_child = Stock(
            warehouse_id=warehouse.id,
            product_id=child_prod.id,
            cantidad=0,
            costo_unitario=costo_unitario_child,
        )
        db.add(stock_child)
        await db.flush()

    # Actualizar cantidades
    stock_display.cantidad -= cant_displays
    stock_child.cantidad += cant_unidades

    # Movimiento 1: Salida de Display
    mov_salida = InventoryMovement(
        company_id=c_uuid,
        warehouse_id=warehouse.id,
        product_id=parent_uuid,
        tipo="fraccionamiento_salida",
        cantidad=-cant_displays,
        costo_unitario=stock_display.costo_unitario,
        referencia_type="fractionation",
        referencia_id=frac.id,
        motivo=f"{data.motivo} — Salida de {cant_displays} display(s) -> Ingreso de {cant_unidades} unid. ({child_prod.nombre})",
        user_id=user_id,
    )
    db.add(mov_salida)

    # Movimiento 2: Entrada de Unidad
    mov_entrada = InventoryMovement(
        company_id=c_uuid,
        warehouse_id=warehouse.id,
        product_id=child_prod.id,
        tipo="fraccionamiento_entrada",
        cantidad=cant_unidades,
        costo_unitario=costo_unitario_child,
        referencia_type="fractionation",
        referencia_id=frac.id,
        motivo=f"{data.motivo} — Ingreso de {cant_unidades} unid. por fraccionamiento de {cant_displays} display(s) ({parent_prod.nombre})",
        user_id=user_id,
    )
    db.add(mov_entrada)

    await db.commit()
    await db.refresh(stock_display)
    await db.refresh(stock_child)

    return {
        "success": True,
        "displays_fraccionados": cant_displays,
        "unidades_ingresadas": cant_unidades,
        "factor_conversion": frac.factor_conversion,
        "deposito": warehouse.nombre,
        "nuevo_stock_display": stock_display.cantidad,
        "nuevo_stock_unidad": stock_child.cantidad,
    }


async def unlink_fractionation(
    db: AsyncSession, company_id: str | UUID, fractionation_id: str | UUID
) -> dict:
    c_uuid = UUID(str(company_id))
    frac_uuid = UUID(str(fractionation_id))

    frac = await db.get(ProductFractionation, frac_uuid)
    if not frac or frac.company_id != c_uuid:
        raise HTTPException(status_code=404, detail="Relación de fraccionamiento no encontrada.")

    await db.delete(frac)
    await db.commit()
    return {"message": "Relación de fraccionamiento eliminada exitosamente"}
