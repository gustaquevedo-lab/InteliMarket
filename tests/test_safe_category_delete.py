"""Tests for Safe Category Deletion with Mandatory Product Reassignment.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from api.src.products.router import router
from api.src.auth.middleware import require_auth
from api.src.db import get_db
from api.src.products.models import ProductCategory, Product
from api.src.products import service


COMPANY_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")


@pytest.fixture
def test_client():
    app = FastAPI()
    app.include_router(router)

    app.dependency_overrides[require_auth] = lambda: {
        "id": "00000000-0000-0000-0000-000000000001",
        "company_id": str(COMPANY_ID),
        "tenant_id": "00000000-0000-0000-0000-000000000001",
        "role": "admin",
    }
    mock_db = AsyncMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    with TestClient(app) as client:
        yield client, mock_db


class TestSafeCategoryDeleteService:
    @pytest.mark.asyncio
    async def test_safe_delete_category_with_zero_products(self):
        """Category with 0 products -> safe direct delete."""
        cat_id = uuid.uuid4()
        cat = ProductCategory(
            id=cat_id,
            company_id=COMPANY_ID,
            nombre="Categoría Vacía",
            codigo="CAT-VAC",
            activo=True,
        )

        mock_db = AsyncMock()
        # 1. select category -> found
        mock_cat_res = MagicMock()
        mock_cat_res.scalar_one_or_none.return_value = cat

        # 2. count query -> 0
        mock_count_res = MagicMock()
        mock_count_res.scalar.return_value = 0

        # 3. reparent update execution
        mock_update_res = MagicMock()

        mock_db.execute.side_effect = [mock_cat_res, mock_count_res, mock_update_res]

        res = await service.safe_delete_category(
            db=mock_db,
            category_id=cat_id,
            company_id=COMPANY_ID,
            reassign_to_id=None,
        )

        assert res["deleted_id"] == str(cat_id)
        assert res["reassigned_products"] == 0
        mock_db.delete.assert_called_once_with(cat)
        mock_db.flush.assert_called_once()

    @pytest.mark.asyncio
    async def test_safe_delete_category_with_products_no_reassign_raises_409(self):
        """Category with products and no reassign_to_id -> raises 409 Conflict with product_count."""
        cat_id = uuid.uuid4()
        cat = ProductCategory(
            id=cat_id,
            company_id=COMPANY_ID,
            nombre="Lácteos",
            codigo="CAT-LAC",
            activo=True,
        )

        mock_db = AsyncMock()
        mock_cat_res = MagicMock()
        mock_cat_res.scalar_one_or_none.return_value = cat

        mock_count_res = MagicMock()
        mock_count_res.scalar.return_value = 15

        mock_db.execute.side_effect = [mock_cat_res, mock_count_res]

        with pytest.raises(HTTPException) as exc_info:
            await service.safe_delete_category(
                db=mock_db,
                category_id=cat_id,
                company_id=COMPANY_ID,
                reassign_to_id=None,
            )

        assert exc_info.value.status_code == 409
        assert isinstance(exc_info.value.detail, dict)
        assert exc_info.value.detail["product_count"] == 15
        assert "Reassignment required" in exc_info.value.detail["message"]
        mock_db.delete.assert_not_called()

    @pytest.mark.asyncio
    async def test_safe_delete_category_same_reassign_raises_400(self):
        """Category with products and reassign_to_id == category_id -> raises 400 Bad Request."""
        cat_id = uuid.uuid4()
        cat = ProductCategory(
            id=cat_id,
            company_id=COMPANY_ID,
            nombre="Bebidas",
            codigo="CAT-BEB",
            activo=True,
        )

        mock_db = AsyncMock()
        mock_cat_res = MagicMock()
        mock_cat_res.scalar_one_or_none.return_value = cat

        mock_count_res = MagicMock()
        mock_count_res.scalar.return_value = 5

        mock_db.execute.side_effect = [mock_cat_res, mock_count_res]

        with pytest.raises(HTTPException) as exc_info:
            await service.safe_delete_category(
                db=mock_db,
                category_id=cat_id,
                company_id=COMPANY_ID,
                reassign_to_id=cat_id,
            )

        assert exc_info.value.status_code == 400
        assert "Cannot reassign to the same category" in exc_info.value.detail
        mock_db.delete.assert_not_called()

    @pytest.mark.asyncio
    async def test_safe_delete_category_with_products_and_valid_reassign(self):
        """Category with products and valid reassign_to_id -> products atomically updated to target category, original category deleted."""
        cat_id = uuid.uuid4()
        target_id = uuid.uuid4()

        cat = ProductCategory(
            id=cat_id,
            company_id=COMPANY_ID,
            nombre="Lácteos Antiguos",
            codigo="CAT-OLD",
            activo=True,
        )
        target = ProductCategory(
            id=target_id,
            company_id=COMPANY_ID,
            nombre="Lácteos Nuevos",
            codigo="CAT-NEW",
            activo=True,
        )

        mock_db = AsyncMock()
        # 1. select cat -> found
        mock_cat_res = MagicMock()
        mock_cat_res.scalar_one_or_none.return_value = cat

        # 2. count products -> 12
        mock_count_res = MagicMock()
        mock_count_res.scalar.return_value = 12

        # 3. select target -> found
        mock_target_res = MagicMock()
        mock_target_res.scalar_one_or_none.return_value = target

        # 4. update products
        mock_update_prods_res = MagicMock()
        # 5. update child categories
        mock_update_children_res = MagicMock()

        mock_db.execute.side_effect = [
            mock_cat_res,
            mock_count_res,
            mock_target_res,
            mock_update_prods_res,
            mock_update_children_res,
        ]

        res = await service.safe_delete_category(
            db=mock_db,
            category_id=cat_id,
            company_id=COMPANY_ID,
            reassign_to_id=target_id,
        )

        assert res["deleted_id"] == str(cat_id)
        assert res["reassigned_to_id"] == str(target_id)
        assert res["reassigned_products"] == 12

        # Verify DB calls
        assert mock_db.execute.call_count == 5
        mock_db.delete.assert_called_once_with(cat)
        mock_db.flush.assert_called_once()

    @pytest.mark.asyncio
    async def test_safe_delete_category_not_found_raises_404(self):
        """Non-existent category raises 404."""
        cat_id = uuid.uuid4()
        mock_db = AsyncMock()
        mock_cat_res = MagicMock()
        mock_cat_res.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_cat_res

        with pytest.raises(HTTPException) as exc_info:
            await service.safe_delete_category(
                db=mock_db,
                category_id=cat_id,
                company_id=COMPANY_ID,
            )

        assert exc_info.value.status_code == 404
        assert "Category not found" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_safe_delete_category_target_not_found_raises_404(self):
        """Target category not found or different company raises 404."""
        cat_id = uuid.uuid4()
        target_id = uuid.uuid4()
        cat = ProductCategory(id=cat_id, company_id=COMPANY_ID, nombre="Cat A", codigo="C-A")

        mock_db = AsyncMock()
        mock_cat_res = MagicMock()
        mock_cat_res.scalar_one_or_none.return_value = cat

        mock_count_res = MagicMock()
        mock_count_res.scalar.return_value = 3

        mock_target_res = MagicMock()
        mock_target_res.scalar_one_or_none.return_value = None

        mock_db.execute.side_effect = [mock_cat_res, mock_count_res, mock_target_res]

        with pytest.raises(HTTPException) as exc_info:
            await service.safe_delete_category(
                db=mock_db,
                category_id=cat_id,
                company_id=COMPANY_ID,
                reassign_to_id=target_id,
            )

        assert exc_info.value.status_code == 404
        assert "Target category for reassignment not found" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_safe_delete_category_target_was_child_prevents_cycle(self):
        """If target category was a child of the deleted category, reparent target to deleted category's parent."""
        cat_id = uuid.uuid4()
        target_id = uuid.uuid4()
        parent_parent_id = uuid.uuid4()

        cat = ProductCategory(
            id=cat_id,
            company_id=COMPANY_ID,
            parent_id=parent_parent_id,
            nombre="Parent Cat",
            codigo="P-CAT",
        )
        target = ProductCategory(
            id=target_id,
            company_id=COMPANY_ID,
            parent_id=cat_id,  # Target is currently a child of cat!
            nombre="Child Cat Becoming Target",
            codigo="C-CAT",
        )

        mock_db = AsyncMock()
        mock_cat_res = MagicMock()
        mock_cat_res.scalar_one_or_none.return_value = cat
        mock_count_res = MagicMock()
        mock_count_res.scalar.return_value = 4
        mock_target_res = MagicMock()
        mock_target_res.scalar_one_or_none.return_value = target

        mock_db.execute.side_effect = [
            mock_cat_res,
            mock_count_res,
            mock_target_res,
            MagicMock(),  # update products
            MagicMock(),  # update child categories
        ]

        res = await service.safe_delete_category(
            db=mock_db,
            category_id=cat_id,
            company_id=COMPANY_ID,
            reassign_to_id=target_id,
        )

        assert res["deleted_id"] == str(cat_id)
        assert res["reassigned_to_id"] == str(target_id)
        # Verify target's parent_id was updated to cat's parent_id (preventing cycle)
        assert target.parent_id == parent_parent_id


class TestSafeCategoryDeleteEndpoints:
    def test_get_category_product_count(self, test_client):
        client, _ = test_client
        cat_id = uuid.uuid4()

        with patch.object(service, "count_category_products", new=AsyncMock(return_value=8)):
            resp = client.get(f"/api/v1/categories/{cat_id}/product-count")
            assert resp.status_code == 200
            data = resp.json()
            assert data["category_id"] == str(cat_id)
            assert data["product_count"] == 8

    def test_delete_category_conflict_when_products_exist(self, test_client):
        client, _ = test_client
        cat_id = uuid.uuid4()

        exc = HTTPException(
            status_code=409,
            detail={"message": "Category has 8 products assigned. Reassignment required.", "product_count": 8},
        )
        with patch.object(service, "safe_delete_category", new=AsyncMock(side_effect=exc)):
            resp = client.delete(f"/api/v1/categories/{cat_id}")
            assert resp.status_code == 409
            data = resp.json()
            assert data["detail"]["product_count"] == 8

    def test_delete_category_success_with_query_param(self, test_client):
        client, _ = test_client
        cat_id = uuid.uuid4()
        target_id = uuid.uuid4()

        return_val = {
            "deleted_id": str(cat_id),
            "reassigned_to_id": str(target_id),
            "reassigned_products": 8,
        }
        with patch.object(service, "safe_delete_category", new=AsyncMock(return_value=return_val)) as mock_del:
            resp = client.delete(f"/api/v1/categories/{cat_id}?reassign_to_id={target_id}")
            assert resp.status_code == 200
            data = resp.json()
            assert data["deleted_id"] == str(cat_id)
            assert data["reassigned_to_id"] == str(target_id)
            assert data["reassigned_products"] == 8
            mock_del.assert_called_once_with(
                pytest.approx(mock_del.call_args[0][0]),
                category_id=cat_id,
                company_id=COMPANY_ID,
                reassign_to_id=target_id,
            )

    def test_safe_delete_category_post_endpoint(self, test_client):
        client, _ = test_client
        cat_id = uuid.uuid4()
        target_id = uuid.uuid4()

        return_val = {
            "deleted_id": str(cat_id),
            "reassigned_to_id": str(target_id),
            "reassigned_products": 8,
        }
        with patch.object(service, "safe_delete_category", new=AsyncMock(return_value=return_val)) as mock_del:
            resp = client.post(
                f"/api/v1/categories/{cat_id}/safe-delete",
                json={"reassign_to_id": str(target_id)},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["deleted_id"] == str(cat_id)
            assert data["reassigned_to_id"] == str(target_id)
            assert data["reassigned_products"] == 8
