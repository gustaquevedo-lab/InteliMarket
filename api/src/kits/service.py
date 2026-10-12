"""Kit service - Gestión Integral de Kits y Combos para Supermercado"""

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from decimal import Decimal
import uuid
import random
import time

from api.src.kits.models import ProductKit, KitItem
from api.src.kits.schemas import KitCreate, KitUpdate
from api.src.products.models import Product


def _generate_kit_barcode() -> str:
    """Genera un código de barras interno retail con prefijo 28 (artículos de confección interna)."""
    # Prefijo 28 + 10 dígitos basados en timestamp y aleatoriedad
    core = f"28{int(time.time()) % 100000000:08d}{random.randint(10, 99):02d}"
    # Dígito verificador EAN-13
    sum_even = sum(int(core[i]) * 3 for i in range(1, len(core), 2))
    sum_odd = sum(int(core[i]) for i in range(0, len(core), 2))
    check = (10 - ((sum_odd + sum_even) % 10)) % 10
    return f"{core}{check}"


def _generate_kit_sku() -> str:
    """Genera un SKU interno único para el combo."""
    return f"KIT-{random.randint(1000, 9999)}"


async def create_kit(db: AsyncSession, data: KitCreate) -> ProductKit:
    """Crea un Kit / Combo y lo sincroniza automáticamente como producto oficial en el catálogo."""
    company_id = data.company_id or uuid.UUID("00000000-0000-0000-0000-000000000010")
    modalidad = data.modalidad_facturacion or "item_unico"

    # 1. Resolver o crear el Producto Padre (para código de barra en POS y facturación)
    target_product_id = data.product_id
    codigo_barra = data.codigo_barra
    sku = data.sku

    # Si no se pasó product_id, crear un producto tipo 'kit' en el catálogo
    if not target_product_id:
        if not codigo_barra:
            codigo_barra = _generate_kit_barcode()
        if not sku:
            sku = _generate_kit_sku()

        # IVA: Si es ítem único tributa 10% fija según la DNIT; si es desglosado 10% nominal en cabecera
        iva_tasa = 10.0

        new_product = Product(
            company_id=company_id,
            nombre=data.nombre,
            sku=sku,
            codigo_barra=codigo_barra,
            descripcion=data.descripcion or f"Combo promocional: {data.nombre}",
            tipo="kit",
            tipo_producto="producto",
            modalidad_abastecimiento="propio",
            unidad_medida="UN",
            iva_tasa=Decimal(str(iva_tasa)),
            precio_venta=Decimal(str(data.precio_venta or 0)),
            costo_promedio=Decimal("0"),
            activo=True
        )
        db.add(new_product)
        await db.flush()
        target_product_id = new_product.id
    else:
        # Si ya existe un producto vinculado, sincronizar su nombre, tipo y precio
        prod = await db.get(Product, target_product_id)
        if prod:
            prod.tipo = "kit"
            if data.precio_venta:
                prod.precio_venta = Decimal(str(data.precio_venta))
            if not codigo_barra:
                codigo_barra = prod.codigo_barra
            if not sku:
                sku = prod.sku

    # 2. Crear el ProductKit
    kit = ProductKit(
        company_id=company_id,
        product_id=target_product_id,
        nombre=data.nombre,
        descripcion=data.descripcion,
        precio_venta=Decimal(str(data.precio_venta or 0)),
        modalidad_facturacion=modalidad,
        codigo_barra=codigo_barra,
        sku=sku,
        activo=True
    )
    db.add(kit)
    await db.flush()

    # 3. Insertar componentes (kit_items) y acumular costo para el producto padre
    total_costo = Decimal("0")
    for item_data in data.items:
        item = KitItem(
            kit_id=kit.id,
            product_id=item_data.product_id,
            variant_id=item_data.variant_id,
            cantidad=Decimal(str(item_data.cantidad)),
        )
        db.add(item)
        p = await db.get(Product, item_data.product_id)
        if p:
            c = Decimal(str(p.costo_promedio or p.ultimo_costo or 0))
            total_costo += c * Decimal(str(item_data.cantidad))

    # Actualizar costo acumulado en el producto padre
    parent_prod = await db.get(Product, target_product_id)
    if parent_prod:
        parent_prod.costo_promedio = total_costo

    await db.commit()
    await db.refresh(kit)
    return kit


async def _kit_to_dict(db: AsyncSession, kit: ProductKit) -> dict:
    """Arma la respuesta completa de un kit con análisis de componentes, IVA, stock y rentabilidad."""
    items_result = await db.execute(select(KitItem).where(KitItem.kit_id == kit.id))
    items = list(items_result.scalars().all())

    total_costo = Decimal("0")
    total_precio_individual = Decimal("0")
    components = []
    potenciales = []
    cuello_botella_nombre = None
    min_potencial = 999999

    for item in items:
        p = await db.get(Product, item.product_id)
        p_costo = Decimal(str(p.costo_promedio or p.ultimo_costo or 0)) if p else Decimal("0")
        p_precio = Decimal(str(p.precio_venta or 0)) if p else Decimal("0")
        qty = Decimal(str(item.cantidad))
        total_costo += p_costo * qty
        total_precio_individual += p_precio * qty

        # Consultar stock actual real en depósito / tienda
        stock_q = text("SELECT COALESCE(SUM(cantidad), 0) FROM stock WHERE product_id = :pid")
        stock_r = (await db.execute(stock_q, {"pid": item.product_id})).scalar()
        stock_actual = float(stock_r or 0)

        # Potencial de armado para este componente
        item_qty = float(qty) if float(qty) > 0 else 1.0
        potencial_item = int(stock_actual // item_qty)
        potenciales.append(potencial_item)
        if potencial_item < min_potencial:
            min_potencial = potencial_item
            cuello_botella_nombre = p.nombre if p else "Producto"

        iva_tasa = float(p.iva_tasa if p and p.iva_tasa is not None else 10.0)

        components.append({
            "id": str(item.id),
            "kit_id": str(item.kit_id),
            "product_id": str(item.product_id),
            "variant_id": str(item.variant_id) if item.variant_id else None,
            "nombre": p.nombre if p else "Producto",
            "sku": p.sku if p else "—",
            "codigo_barra": p.codigo_barra if p else None,
            "iva_tasa": iva_tasa,
            "stock_actual": stock_actual,
            "cantidad": float(item.cantidad),
            "costo_unitario": float(p_costo),
            "precio_unitario": float(p_precio),
            "subtotal_costo": float(p_costo * qty),
            "subtotal_precio": float(p_precio * qty),
            "precio_con_descuento": float(p_precio),  # Se calcula abajo con el factor global
            "descuento_prorrateado_pct": 0.0,
        })

    precio_kit = Decimal(str(kit.precio_venta or total_precio_individual))
    margen_monto = precio_kit - total_costo
    margen_pct = float(round((margen_monto / precio_kit * 100), 1)) if precio_kit > 0 else 0.0
    ahorro_cliente = float(max(Decimal("0"), total_precio_individual - precio_kit))

    # Calcular precio prorrateado con descuento por componente para modalidad desglosada
    if total_precio_individual > 0 and precio_kit < total_precio_individual:
        factor_desc = float(precio_kit / total_precio_individual)
        desc_global_pct = round((1.0 - factor_desc) * 100, 1)
        for comp in components:
            comp["descuento_prorrateado_pct"] = desc_global_pct
            comp["precio_con_descuento"] = round(comp["precio_unitario"] * factor_desc)

    stock_potencial_kits = min_potencial if potenciales and min_potencial < 999999 else 0

    # Obtener código de barra y SKU (del kit o del producto vinculado)
    codigo_barra = kit.codigo_barra
    sku = kit.sku
    if not codigo_barra and kit.product_id:
        parent_p = await db.get(Product, kit.product_id)
        if parent_p:
            codigo_barra = parent_p.codigo_barra
            sku = parent_p.sku

    return {
        "id": str(kit.id),
        "company_id": str(kit.company_id),
        "product_id": str(kit.product_id) if kit.product_id else None,
        "nombre": kit.nombre,
        "descripcion": kit.descripcion,
        "precio_venta": float(precio_kit),
        "modalidad_facturacion": getattr(kit, "modalidad_facturacion", "item_unico") or "item_unico",
        "codigo_barra": codigo_barra,
        "sku": sku,
        "costo_total": float(total_costo),
        "precio_individual_total": float(total_precio_individual),
        "margen_monto": float(margen_monto),
        "margen_pct": margen_pct,
        "ahorro_cliente_monto": ahorro_cliente,
        "stock_potencial_kits": stock_potencial_kits,
        "producto_cuello_botella": cuello_botella_nombre if stock_potencial_kits > 0 else (cuello_botella_nombre or "Sin stock"),
        "activo": kit.activo,
        "created_at": kit.created_at,
        "updated_at": kit.updated_at,
        "items": components,
    }


async def list_kits(
    db: AsyncSession,
    company_id: str,
    activo: Optional[bool] = None,
) -> list[dict]:
    comp_uuid = uuid.UUID(company_id) if isinstance(company_id, str) else company_id
    query = select(ProductKit).where(ProductKit.company_id == comp_uuid)
    if activo is not None:
        query = query.where(ProductKit.activo == activo)
    query = query.order_by(ProductKit.nombre)
    result = await db.execute(query)
    kits = list(result.scalars().all())
    return [await _kit_to_dict(db, kit) for kit in kits]


async def _get_kit_orm(db: AsyncSession, kit_id: str) -> ProductKit | None:
    result = await db.execute(select(ProductKit).where(ProductKit.id == uuid.UUID(kit_id)))
    return result.scalar_one_or_none()



async def get_kit_by_barcode(db: AsyncSession, company_id: str, barcode: str) -> dict | None:
    """Busca un kit activo por código de barras o SKU propio o de su producto asociado."""
    comp_uuid = uuid.UUID(company_id) if isinstance(company_id, str) else company_id
    clean_code = barcode.strip()

    # 1. Búsqueda directa en product_kits
    q = select(ProductKit).where(
        ProductKit.company_id == comp_uuid,
        ProductKit.activo == True,
        (ProductKit.codigo_barra == clean_code) | (ProductKit.sku == clean_code)
    )
    result = await db.execute(q)
    kit = result.scalar_one_or_none()
    if kit:
        return await _kit_to_dict(db, kit)

    # 2. Búsqueda por producto vinculado
    pq = select(Product).where(
        Product.company_id == comp_uuid,
        (Product.codigo_barra == clean_code) | (Product.sku == clean_code)
    )
    pres = await db.execute(pq)
    prod = pres.scalar_one_or_none()
    if prod:
        kq = select(ProductKit).where(ProductKit.product_id == prod.id, ProductKit.activo == True)
        kres = await db.execute(kq)
        kit = kres.scalar_one_or_none()
        if kit:
            return await _kit_to_dict(db, kit)

    return None


async def get_kit(db: AsyncSession, kit_id: str) -> dict | None:
    kit = await _get_kit_orm(db, kit_id)
    if not kit:
        return None
    return await _kit_to_dict(db, kit)


async def update_kit(db: AsyncSession, kit_id: str, data: KitUpdate) -> dict | None:
    kit = await _get_kit_orm(db, kit_id)
    if not kit:
        return None

    update_data = data.model_dump(exclude_unset=True, exclude={"items"})
    for key, value in update_data.items():
        if hasattr(kit, key):
            setattr(kit, key, value)

    # Sincronizar en el producto padre si cambió precio o nombre
    if kit.product_id:
        prod = await db.get(Product, kit.product_id)
        if prod:
            if data.nombre:
                prod.nombre = data.nombre
            if data.precio_venta:
                prod.precio_venta = Decimal(str(data.precio_venta))
            if data.codigo_barra:
                prod.codigo_barra = data.codigo_barra
            if data.sku:
                prod.sku = data.sku

    if data.items is not None:
        existing = await db.execute(select(KitItem).where(KitItem.kit_id == kit.id))
        for item in existing.scalars().all():
            await db.delete(item)

        total_costo = Decimal("0")
        for item_data in data.items:
            item = KitItem(
                kit_id=kit.id,
                product_id=item_data.product_id,
                variant_id=item_data.variant_id,
                cantidad=Decimal(str(item_data.cantidad)),
            )
            db.add(item)
            p = await db.get(Product, item_data.product_id)
            if p:
                c = Decimal(str(p.costo_promedio or p.ultimo_costo or 0))
                total_costo += c * Decimal(str(item_data.cantidad))

        if kit.product_id:
            parent_p = await db.get(Product, kit.product_id)
            if parent_p:
                parent_p.costo_promedio = total_costo

    await db.commit()
    await db.refresh(kit)
    return await _kit_to_dict(db, kit)


async def delete_kit(db: AsyncSession, kit_id: str) -> bool:
    kit = await _get_kit_orm(db, kit_id)
    if not kit:
        return False
    # Si tiene producto asociado, desactivarlo
    if kit.product_id:
        prod = await db.get(Product, kit.product_id)
        if prod:
            prod.activo = False
    await db.delete(kit)
    await db.commit()
    return True


async def calculate_kit_price(db: AsyncSession, kit_id: str) -> dict:
    kit = await _get_kit_orm(db, kit_id)
    if not kit:
        return {"error": "Kit not found"}

    items_result = await db.execute(select(KitItem).where(KitItem.kit_id == kit.id))
    items = list(items_result.scalars().all())

    total = Decimal("0")
    total_costo = Decimal("0")
    components = []
    for item in items:
        product = await db.get(Product, item.product_id)
        price = Decimal(str(product.precio_venta or 0)) if product else Decimal("0")
        costo = Decimal(str(product.costo_promedio or product.ultimo_costo or 0)) if product else Decimal("0")
        qty = Decimal(str(item.cantidad))
        subtotal = price * qty
        subtotal_costo = costo * qty
        total += subtotal
        total_costo += subtotal_costo
        components.append({
            "product_id": str(item.product_id),
            "nombre": product.nombre if product else "Desconocido",
            "sku": product.sku if product else "—",
            "codigo_barra": product.codigo_barra if product else None,
            "iva_tasa": float(product.iva_tasa or 10.0) if product else 10.0,
            "cantidad": float(item.cantidad),
            "precio_unitario": float(price),
            "costo_unitario": float(costo),
            "subtotal": float(subtotal),
            "subtotal_costo": float(subtotal_costo),
            "subtotal_precio": float(subtotal),
        })

    precio_venta = Decimal(str(kit.precio_venta or total))
    margen_monto = precio_venta - total_costo
    margen_pct = float(round((margen_monto / precio_venta * 100), 1)) if precio_venta > 0 else 0.0

    return {
        "kit_id": str(kit.id),
        "nombre": kit.nombre,
        "precio_venta": float(precio_venta),
        "precio_calculado": float(total),
        "costo_total": float(total_costo),
        "margen_monto": float(margen_monto),
        "margen_pct": margen_pct,
        "diferencia": float(precio_venta - total),
        "items": components,
    }
