import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import configure_mappers
import pytest

from api.src.products.models import (
    Representative,
    SupplierRepresentative,
    ProductSection,
    ProductBrand,
    Product,
    ProductCategory,
)
from api.src.purchases.models import Supplier
from api.src.products.schemas import (
    RepresentativeCreate,
    RepresentativeUpdate,
    RepresentativeResponse,
    ProductBrandCreate,
    ProductBrandUpdate,
    ProductBrandResponse,
    ProductSectionCreate,
    ProductSectionUpdate,
    ProductSectionResponse,
    ProductCreate,
    ProductUpdate,
    ProductResponse,
)


def test_taxonomy_models_instantiation():
    company_id = uuid.uuid4()
    rep_id = uuid.uuid4()
    brand_id = uuid.uuid4()
    section_id = uuid.uuid4()
    supplier_id = uuid.uuid4()

    # 1. ProductSection
    section = ProductSection(
        id=section_id,
        company_id=company_id,
        nombre="Lácteos y Quesos",
        orden=1,
        activo=True,
    )
    assert section.nombre == "Lácteos y Quesos"
    assert section.orden == 1
    assert section.activo is True

    # 2. Representative
    rep = Representative(
        id=rep_id,
        company_id=company_id,
        nombre="Distribuidora Los Laureles",
        contacto="Juan Pérez",
        telefono="0981123456",
        activo=True,
    )
    assert rep.nombre == "Distribuidora Los Laureles"
    assert rep.contacto == "Juan Pérez"
    assert rep.telefono == "0981123456"

    # 3. ProductBrand
    brand = ProductBrand(
        id=brand_id,
        company_id=company_id,
        nombre="Trébol",
        representative_id=rep_id,
        activo=True,
    )
    assert brand.nombre == "Trébol"
    assert brand.representative_id == rep_id

    # 4. SupplierRepresentative
    supp_rep = SupplierRepresentative(
        supplier_id=supplier_id,
        representative_id=rep_id,
        es_principal=True,
    )
    assert supp_rep.supplier_id == supplier_id
    assert supp_rep.representative_id == rep_id
    assert supp_rep.es_principal is True

    # 5. ProductCategory con section_id
    cat = ProductCategory(
        company_id=company_id,
        nombre="Leches Larga Vida",
        section_id=section_id,
    )
    assert cat.section_id == section_id

    # 6. Product con representative_id, brand_id, tipo_variante
    prod = Product(
        company_id=company_id,
        sku="LEC-TRE-001",
        nombre="Leche Entera Trébol 1L",
        representative_id=rep_id,
        brand_id=brand_id,
        tipo_variante="Entera 1L",
    )
    assert prod.representative_id == rep_id
    assert prod.brand_id == brand_id
    assert prod.tipo_variante == "Entera 1L"

    # 7. Supplier relationships check
    supplier = Supplier(
        id=supplier_id,
        company_id=company_id,
        razon_social="Lácteos Trébol S.A.",
    )
    assert hasattr(supplier, "representatives")

    # 8. Configure SQLAlchemy mappers & verify bidirectional relations
    configure_mappers()
    prod.brand = brand
    prod.representative = rep
    assert prod.brand_nombre == "Trébol"
    assert prod.representative_nombre == "Distribuidora Los Laureles"


def test_taxonomy_schemas_validation_and_serialization():
    company_id = uuid.uuid4()
    rep_id = uuid.uuid4()
    brand_id = uuid.uuid4()
    section_id = uuid.uuid4()
    now = datetime.now(timezone.utc)

    # 1. ProductSection schemas
    section_create = ProductSectionCreate(
        company_id=company_id,
        nombre="Bebidas",
        orden=2,
    )
    assert section_create.nombre == "Bebidas"
    assert section_create.orden == 2

    section_resp = ProductSectionResponse(
        id=section_id,
        company_id=company_id,
        nombre="Bebidas",
        orden=2,
        activo=True,
    )
    assert section_resp.id == section_id
    assert section_resp.model_dump()["nombre"] == "Bebidas"

    # 2. Representative schemas
    rep_create = RepresentativeCreate(
        company_id=company_id,
        nombre="Representaciones del Este",
        contacto="Carlos Gómez",
        telefono="0971555666",
    )
    assert rep_create.nombre == "Representaciones del Este"

    rep_resp = RepresentativeResponse(
        id=rep_id,
        company_id=company_id,
        nombre="Representaciones del Este",
        contacto="Carlos Gómez",
        telefono="0971555666",
        activo=True,
        created_at=now,
    )
    assert rep_resp.id == rep_id
    assert rep_resp.activo is True

    # 3. ProductBrand schemas
    brand_create = ProductBrandCreate(
        company_id=company_id,
        nombre="Coca-Cola",
        representative_id=rep_id,
    )
    assert brand_create.nombre == "Coca-Cola"
    assert brand_create.representative_id == rep_id

    brand_resp = ProductBrandResponse(
        id=brand_id,
        company_id=company_id,
        nombre="Coca-Cola",
        representative_id=rep_id,
        activo=True,
        representative=rep_resp,
    )
    assert brand_resp.representative is not None
    assert brand_resp.representative.nombre == "Representaciones del Este"

    # 4. ProductCreate & ProductUpdate extensions
    prod_create = ProductCreate(
        company_id=company_id,
        nombre="Coca Cola 2L",
        representative_id=rep_id,
        brand_id=brand_id,
        tipo_variante="2 Litros",
        section_id=section_id,
    )
    assert prod_create.representative_id == rep_id
    assert prod_create.brand_id == brand_id
    assert prod_create.tipo_variante == "2 Litros"
    assert prod_create.section_id == section_id

    prod_update = ProductUpdate(
        representative_id=rep_id,
        brand_id=brand_id,
        tipo_variante="2.5 Litros",
        section_id=section_id,
    )
    assert prod_update.tipo_variante == "2.5 Litros"

    # 5. ProductResponse extension
    prod_resp = ProductResponse(
        id=uuid.uuid4(),
        company_id=company_id,
        sku="BEB-COC-002",
        nombre="Coca Cola 2L",
        tipo="producto",
        unidad_medida="UN",
        iva_tasa=10,
        metodo_costeo="promedio",
        tiene_lotes=False,
        tiene_vencimiento=False,
        tiene_serial=False,
        stock_minimo=0,
        activo=True,
        created_at=now,
        updated_at=now,
        representative_id=rep_id,
        brand_id=brand_id,
        tipo_variante="2 Litros",
        representative=rep_resp,
        brand=brand_resp,
    )
    assert prod_resp.representative_id == rep_id
    assert prod_resp.brand_id == brand_id
    assert prod_resp.tipo_variante == "2 Litros"
    assert prod_resp.representative.nombre == "Representaciones del Este"
    assert prod_resp.brand.nombre == "Coca-Cola"


if __name__ == "__main__":
    test_taxonomy_models_instantiation()
    test_taxonomy_schemas_validation_and_serialization()
    print("All taxonomy tests passed successfully!")
