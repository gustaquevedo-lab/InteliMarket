"""Tests for taxonomy endpoints and service integration:
Representatives, Product Sections, Product Brands, Supplier Associations, and Product creation/updates.
"""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch, MagicMock
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.src.products.router import router
from api.src.auth.middleware import require_auth
from api.src.db import get_db
from api.src.products.models import (
    Representative,
    ProductSection,
    ProductBrand,
    Product,
    ProductCategory,
)
from api.src.products.schemas import (
    RepresentativeCreate,
    RepresentativeUpdate,
    ProductSectionCreate,
    ProductSectionUpdate,
    ProductBrandCreate,
    ProductBrandUpdate,
    ProductCreate,
    ProductUpdate,
)
from api.src.products import service


COMPANY_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")


@pytest.fixture
def test_client():
    app = FastAPI()
    app.include_router(router)

    # Override auth to provide default test user
    app.dependency_overrides[require_auth] = lambda: {
        "id": "00000000-0000-0000-0000-000000000001",
        "company_id": str(COMPANY_ID),
        "tenant_id": "00000000-0000-0000-0000-000000000001",
        "role": "admin",
    }
    # Mock DB session dependency
    mock_db = AsyncMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    with TestClient(app) as client:
        yield client, mock_db


class TestRepresentativesEndpoints:
    def test_list_representatives(self, test_client):
        client, _ = test_client
        now = datetime.now(timezone.utc)
        rep1 = Representative(
            id=uuid.uuid4(),
            company_id=COMPANY_ID,
            nombre="PARESA",
            contacto="Ventas",
            telefono="021-123456",
            activo=True,
            created_at=now,
        )
        rep1.suppliers = []

        with patch.object(service, "get_representatives", new=AsyncMock(return_value=[rep1])):
            resp = client.get("/api/v1/representatives")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) == 1
            assert data[0]["nombre"] == "PARESA"
            assert data[0]["supplier_ids"] == []

    def test_create_representative(self, test_client):
        client, _ = test_client
        now = datetime.now(timezone.utc)
        rep_id = uuid.uuid4()
        supp_id = uuid.uuid4()

        created_rep = Representative(
            id=rep_id,
            company_id=COMPANY_ID,
            nombre="CERVEPAR",
            contacto="Carlos Gómez",
            telefono="0981999888",
            activo=True,
            created_at=now,
        )
        mock_supp = MagicMock()
        mock_supp.id = supp_id
        created_rep.suppliers = [mock_supp]

        with patch.object(service, "create_representative", new=AsyncMock(return_value=created_rep)) as mock_create:
            payload = {
                "nombre": "CERVEPAR",
                "contacto": "Carlos Gómez",
                "telefono": "0981999888",
                "activo": True,
                "supplier_ids": [str(supp_id)],
            }
            resp = client.post("/api/v1/representatives", json=payload)
            assert resp.status_code == 201
            data = resp.json()
            assert data["id"] == str(rep_id)
            assert data["nombre"] == "CERVEPAR"
            assert str(supp_id) in data["supplier_ids"]
            assert mock_create.called

    def test_update_representative(self, test_client):
        client, _ = test_client
        now = datetime.now(timezone.utc)
        rep_id = uuid.uuid4()

        updated_rep = Representative(
            id=rep_id,
            company_id=COMPANY_ID,
            nombre="UNILEVER MODIFICADO",
            contacto="María",
            telefono="0971111222",
            activo=True,
            created_at=now,
        )
        updated_rep.suppliers = []

        with patch.object(service, "update_representative", new=AsyncMock(return_value=updated_rep)):
            payload = {
                "nombre": "UNILEVER MODIFICADO",
                "telefono": "0971111222",
            }
            resp = client.put(f"/api/v1/representatives/{rep_id}", json=payload)
            assert resp.status_code == 200
            data = resp.json()
            assert data["nombre"] == "UNILEVER MODIFICADO"

    def test_delete_representative(self, test_client):
        client, _ = test_client
        rep_id = uuid.uuid4()

        with patch.object(service, "delete_representative", new=AsyncMock(return_value=True)):
            resp = client.delete(f"/api/v1/representatives/{rep_id}")
            assert resp.status_code == 204


class TestSupplierRepresentativeAssociations:
    def test_get_supplier_representatives(self, test_client):
        client, _ = test_client
        supplier_id = uuid.uuid4()
        now = datetime.now(timezone.utc)
        rep = Representative(
            id=uuid.uuid4(),
            company_id=COMPANY_ID,
            nombre="BEBIDAS DEL PARAGUAY",
            activo=True,
            created_at=now,
        )
        rep.suppliers = []

        with patch.object(service, "get_supplier_representatives", new=AsyncMock(return_value=[rep])):
            resp = client.get(f"/api/v1/suppliers/{supplier_id}/representatives")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) == 1
            assert data[0]["nombre"] == "BEBIDAS DEL PARAGUAY"

    def test_assign_supplier_representatives(self, test_client):
        client, _ = test_client
        supplier_id = uuid.uuid4()
        rep_id = uuid.uuid4()
        now = datetime.now(timezone.utc)
        rep = Representative(
            id=rep_id,
            company_id=COMPANY_ID,
            nombre="VIERCI",
            activo=True,
            created_at=now,
        )
        rep.suppliers = []

        with patch.object(service, "assign_supplier_representatives", new=AsyncMock(return_value=[rep])):
            # Assigning via array
            resp = client.post(
                f"/api/v1/suppliers/{supplier_id}/representatives",
                json=[str(rep_id)],
            )
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) == 1
            assert data[0]["id"] == str(rep_id)

    def test_remove_supplier_representative(self, test_client):
        client, _ = test_client
        supplier_id = uuid.uuid4()
        rep_id = uuid.uuid4()

        with patch.object(service, "remove_supplier_representative", new=AsyncMock(return_value=True)):
            resp = client.delete(f"/api/v1/suppliers/{supplier_id}/representatives/{rep_id}")
            assert resp.status_code == 204


class TestProductSectionsEndpoints:
    def test_list_product_sections(self, test_client):
        client, _ = test_client
        sec1 = ProductSection(
            id=uuid.uuid4(),
            company_id=COMPANY_ID,
            nombre="Bebidas",
            orden=1,
            activo=True,
        )
        sec2 = ProductSection(
            id=uuid.uuid4(),
            company_id=COMPANY_ID,
            nombre="Lácteos y Quesos",
            orden=2,
            activo=True,
        )

        with patch.object(service, "get_sections", new=AsyncMock(return_value=[sec1, sec2])):
            resp = client.get("/api/v1/product-sections")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) == 2
            assert data[0]["nombre"] == "Bebidas"
            assert data[1]["nombre"] == "Lácteos y Quesos"

    def test_create_product_section(self, test_client):
        client, _ = test_client
        sec_id = uuid.uuid4()
        created = ProductSection(
            id=sec_id,
            company_id=COMPANY_ID,
            nombre="Panadería y Confitería",
            orden=5,
            activo=True,
        )

        with patch.object(service, "create_section", new=AsyncMock(return_value=created)):
            resp = client.post(
                "/api/v1/product-sections",
                json={"nombre": "Panadería y Confitería", "orden": 5},
            )
            assert resp.status_code == 201
            data = resp.json()
            assert data["id"] == str(sec_id)
            assert data["nombre"] == "Panadería y Confitería"

    def test_update_product_section(self, test_client):
        client, _ = test_client
        sec_id = uuid.uuid4()
        updated = ProductSection(
            id=sec_id,
            company_id=COMPANY_ID,
            nombre="Verdulería y Frutería",
            orden=3,
            activo=True,
        )

        with patch.object(service, "update_section", new=AsyncMock(return_value=updated)):
            resp = client.put(
                f"/api/v1/product-sections/{sec_id}",
                json={"nombre": "Verdulería y Frutería"},
            )
            assert resp.status_code == 200
            assert resp.json()["nombre"] == "Verdulería y Frutería"

    def test_delete_product_section(self, test_client):
        client, _ = test_client
        sec_id = uuid.uuid4()

        with patch.object(service, "delete_section", new=AsyncMock(return_value=True)):
            resp = client.delete(f"/api/v1/product-sections/{sec_id}")
            assert resp.status_code == 204


class TestProductBrandsEndpoints:
    def test_list_product_brands(self, test_client):
        client, _ = test_client
        brand_id = uuid.uuid4()
        brand = ProductBrand(
            id=brand_id,
            company_id=COMPANY_ID,
            nombre="Coca-Cola",
            activo=True,
        )
        brand.representative = None

        with patch.object(service, "get_brands", new=AsyncMock(return_value=[brand])):
            resp = client.get("/api/v1/product-brands")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data) == 1
            assert data[0]["nombre"] == "Coca-Cola"

    def test_create_product_brand(self, test_client):
        client, _ = test_client
        brand_id = uuid.uuid4()
        rep_id = uuid.uuid4()
        brand = ProductBrand(
            id=brand_id,
            company_id=COMPANY_ID,
            nombre="Trebol",
            representative_id=rep_id,
            activo=True,
        )
        brand.representative = None

        with patch.object(service, "create_brand", new=AsyncMock(return_value=brand)):
            resp = client.post(
                "/api/v1/product-brands",
                json={"nombre": "Trebol", "representative_id": str(rep_id)},
            )
            assert resp.status_code == 201
            data = resp.json()
            assert data["id"] == str(brand_id)
            assert data["nombre"] == "Trebol"
            assert data["representative_id"] == str(rep_id)

    def test_update_product_brand(self, test_client):
        client, _ = test_client
        brand_id = uuid.uuid4()
        updated = ProductBrand(
            id=brand_id,
            company_id=COMPANY_ID,
            nombre="Pepsi",
            activo=True,
        )
        updated.representative = None

        with patch.object(service, "update_brand", new=AsyncMock(return_value=updated)):
            resp = client.put(
                f"/api/v1/product-brands/{brand_id}",
                json={"nombre": "Pepsi"},
            )
            assert resp.status_code == 200
            assert resp.json()["nombre"] == "Pepsi"

    def test_delete_product_brand(self, test_client):
        client, _ = test_client
        brand_id = uuid.uuid4()

        with patch.object(service, "delete_brand", new=AsyncMock(return_value=True)):
            resp = client.delete(f"/api/v1/product-brands/{brand_id}")
            assert resp.status_code == 204


@pytest.mark.asyncio
class TestProductCreationAndUpdateHandling:
    async def test_create_product_pops_section_id_safely(self):
        """Verifies that create_product strips section_id from model_dump without TypeError on Product(**dump)."""
        rep_id = uuid.uuid4()
        brand_id = uuid.uuid4()
        section_id = uuid.uuid4()
        cat_id = uuid.uuid4()

        data = ProductCreate(
            company_id=COMPANY_ID,
            sku="AUTO",
            nombre="Arroz Supremo 1kg",
            categoria_id=cat_id,
            section_id=section_id,
            representative_id=rep_id,
            brand_id=brand_id,
            tipo_variante="1 Kilogramo",
            precio_venta=8500,
        )

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        # Mock get_next_sku result
        mock_res_sku = MagicMock()
        mock_res_sku.scalar.return_value = 126600
        mock_db.execute.side_effect = [
            mock_res_sku,  # For get_next_sku query
            MagicMock(scalar_one=MagicMock(return_value=Product(
                id=uuid.uuid4(),
                company_id=COMPANY_ID,
                sku="126601",
                nombre="Arroz Supremo 1kg",
                representative_id=rep_id,
                brand_id=brand_id,
                tipo_variante="1 Kilogramo",
            ))) # For eager loading select(Product)
        ]

        # Call service.create_product
        prod = await service.create_product(mock_db, data)
        assert prod is not None
        assert prod.nombre == "Arroz Supremo 1kg"
        assert prod.representative_id == rep_id
        assert prod.brand_id == brand_id
        assert prod.tipo_variante == "1 Kilogramo"

    async def test_update_product_pops_section_id_and_sets_taxonomy_fields(self):
        """Verifies that update_product safely ignores section_id and updates representative_id, brand_id, tipo_variante."""
        prod_id = uuid.uuid4()
        rep_id = uuid.uuid4()
        brand_id = uuid.uuid4()
        section_id = uuid.uuid4()

        existing_prod = Product(
            id=prod_id,
            company_id=COMPANY_ID,
            sku="126601",
            nombre="Arroz Supremo",
            precio_venta=8000,
        )

        mock_db = AsyncMock()
        # Initial select returns existing_prod
        mock_first_sel = MagicMock()
        mock_first_sel.scalar_one_or_none.return_value = existing_prod

        # Final select returns refreshed prod
        refreshed_prod = Product(
            id=prod_id,
            company_id=COMPANY_ID,
            sku="126601",
            nombre="Arroz Supremo Especial",
            representative_id=rep_id,
            brand_id=brand_id,
            tipo_variante="Especial 1kg",
        )
        mock_final_sel = MagicMock()
        mock_final_sel.scalar_one.return_value = refreshed_prod

        mock_db.execute.side_effect = [mock_first_sel, mock_final_sel]

        update_data = ProductUpdate(
            nombre="Arroz Supremo Especial",
            section_id=section_id,
            representative_id=rep_id,
            brand_id=brand_id,
            tipo_variante="Especial 1kg",
        )

        res = await service.update_product(mock_db, str(prod_id), update_data)
        assert res is not None
        assert res.nombre == "Arroz Supremo Especial"
        assert res.representative_id == rep_id
        assert res.brand_id == brand_id
        assert res.tipo_variante == "Especial 1kg"


@pytest.mark.asyncio
class TestTaxonomyServiceDirectLogic:
    async def test_service_representatives_crud(self):
        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        rep_id = uuid.uuid4()
        now = datetime.now(timezone.utc)
        rep = Representative(
            id=rep_id,
            company_id=COMPANY_ID,
            nombre="PARESA",
            contacto="Ventas",
            telefono="021-123",
            activo=True,
            created_at=now,
        )
        rep.suppliers = []

        # 1. create_representative
        mock_scalar = MagicMock()
        mock_scalar.scalar_one.return_value = rep
        mock_db.execute.return_value = mock_scalar

        created = await service.create_representative(
            mock_db,
            COMPANY_ID,
            RepresentativeCreate(nombre="PARESA", contacto="Ventas", telefono="021-123", supplier_ids=[uuid.uuid4()]),
        )
        assert created.nombre == "PARESA"

        # 2. get_representatives
        mock_scalars_all = MagicMock()
        mock_scalars_all.scalars.return_value.all.return_value = [rep]
        mock_db.execute.return_value = mock_scalars_all

        reps = await service.get_representatives(mock_db, COMPANY_ID, supplier_id=uuid.uuid4())
        assert len(reps) == 1
        assert reps[0].id == rep_id

        # 3. update_representative (select rep, delete old supp_reps, select refreshed rep)
        mock_one_or_none = MagicMock()
        mock_one_or_none.scalar_one_or_none.return_value = rep
        mock_delete_res = MagicMock()
        mock_one_final = MagicMock()
        mock_one_final.scalar_one.return_value = rep
        mock_db.execute.side_effect = [mock_one_or_none, mock_delete_res, mock_one_final]

        updated = await service.update_representative(
            mock_db,
            rep_id,
            COMPANY_ID,
            RepresentativeUpdate(nombre="PARESA PY", supplier_ids=[uuid.uuid4()]),
        )
        assert updated.nombre == "PARESA PY"

        # 4. delete_representative
        mock_db.execute.side_effect = None
        mock_del_res = MagicMock()
        mock_del_res.scalar_one_or_none.return_value = rep
        mock_db.execute.return_value = mock_del_res
        assert await service.delete_representative(mock_db, rep_id, COMPANY_ID) is True

    async def test_service_supplier_associations(self):
        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        rep_id = uuid.uuid4()
        supp_id = uuid.uuid4()
        now = datetime.now(timezone.utc)
        rep = Representative(
            id=rep_id,
            company_id=COMPANY_ID,
            nombre="CERVEPAR",
            activo=True,
            created_at=now,
        )
        rep.suppliers = []

        mock_scalars = MagicMock()
        mock_scalars.scalars.return_value.all.return_value = [rep]
        mock_db.execute.return_value = mock_scalars

        # 1. assign_supplier_representatives
        assigned = await service.assign_supplier_representatives(mock_db, supp_id, [rep_id])
        assert len(assigned) == 1
        assert assigned[0].id == rep_id

        # 2. get_supplier_representatives
        reps = await service.get_supplier_representatives(mock_db, supp_id)
        assert len(reps) == 1

        # 3. remove_supplier_representative
        assert await service.remove_supplier_representative(mock_db, supp_id, rep_id) is True

    async def test_service_sections_crud(self):
        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        sec_id = uuid.uuid4()
        sec = ProductSection(
            id=sec_id,
            company_id=COMPANY_ID,
            nombre="Carnicería",
            orden=4,
            activo=True,
        )

        # 1. create_section
        created = await service.create_section(
            mock_db,
            COMPANY_ID,
            ProductSectionCreate(nombre="Carnicería", orden=4),
        )
        assert created.nombre == "Carnicería"

        # 2. get_sections
        mock_scalars = MagicMock()
        mock_scalars.scalars.return_value.all.return_value = [sec]
        mock_db.execute.return_value = mock_scalars

        secs = await service.get_sections(mock_db, COMPANY_ID)
        assert len(secs) == 1
        assert secs[0].nombre == "Carnicería"

        # 3. update_section
        mock_one = MagicMock()
        mock_one.scalar_one_or_none.return_value = sec
        mock_db.execute.return_value = mock_one

        updated = await service.update_section(
            mock_db,
            sec_id,
            COMPANY_ID,
            ProductSectionUpdate(nombre="Carnes Vacunas", orden=10, activo=False),
        )
        assert updated.nombre == "Carnes Vacunas"
        assert updated.orden == 10
        assert updated.activo is False

        # 4. delete_section
        assert await service.delete_section(mock_db, sec_id, COMPANY_ID) is True

    async def test_service_brands_crud(self):
        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        brand_id = uuid.uuid4()
        rep_id = uuid.uuid4()
        brand = ProductBrand(
            id=brand_id,
            company_id=COMPANY_ID,
            nombre="Brahma",
            representative_id=rep_id,
            activo=True,
        )
        brand.representative = None

        # 1. create_brand
        mock_scalar = MagicMock()
        mock_scalar.scalar_one.return_value = brand
        mock_db.execute.return_value = mock_scalar

        created = await service.create_brand(
            mock_db,
            COMPANY_ID,
            ProductBrandCreate(nombre="Brahma", representative_id=rep_id),
        )
        assert created.nombre == "Brahma"

        # 2. get_brands
        mock_scalars = MagicMock()
        mock_scalars.scalars.return_value.all.return_value = [brand]
        mock_db.execute.return_value = mock_scalars

        brands = await service.get_brands(mock_db, COMPANY_ID, representative_id=rep_id)
        assert len(brands) == 1
        assert brands[0].nombre == "Brahma"

        # 3. update_brand
        mock_one_or_none = MagicMock()
        mock_one_or_none.scalar_one_or_none.return_value = brand
        mock_one_final = MagicMock()
        mock_one_final.scalar_one.return_value = brand
        mock_db.execute.side_effect = [mock_one_or_none, mock_one_final]

        updated = await service.update_brand(
            mock_db,
            brand_id,
            COMPANY_ID,
            ProductBrandUpdate(nombre="Brahma Chopp"),
        )
        assert updated.nombre == "Brahma Chopp"

        # 4. delete_brand
        mock_db.execute.side_effect = None
        mock_del = MagicMock()
        mock_del.scalar_one_or_none.return_value = brand
        mock_db.execute.return_value = mock_del
        assert await service.delete_brand(mock_db, brand_id, COMPANY_ID) is True

