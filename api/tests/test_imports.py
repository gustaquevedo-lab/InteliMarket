"""Tests for imports module — schemas"""

import pytest


class TestImportSchemas:
    def test_import_row_success(self):
        from api.src.imports.schemas import ImportRow

        row = ImportRow(
            row=1,
            status="success",
            message="Importado correctamente",
            data={"sku": "PROD-001", "nombre": "Producto 1"},
        )
        assert row.row == 1
        assert row.status == "success"
        assert row.data["sku"] == "PROD-001"

    def test_import_row_error(self):
        from api.src.imports.schemas import ImportRow

        row = ImportRow(row=5, status="error", message="SKU duplicado")
        assert row.status == "error"
        assert row.data is None

    def test_import_row_warning(self):
        from api.src.imports.schemas import ImportRow

        row = ImportRow(row=3, status="warning", message="Precio muy bajo")
        assert row.status == "warning"

    def test_import_result(self):
        from api.src.imports.schemas import ImportResult, ImportRow

        result = ImportResult(
            total_rows=10,
            success=8,
            errors=1,
            warnings=1,
            details=[
                ImportRow(row=1, status="success", message="OK"),
                ImportRow(row=2, status="error", message="Error"),
                ImportRow(row=3, status="warning", message="Warning"),
            ],
        )
        assert result.total_rows == 10
        assert result.success == 8
        assert result.errors == 1
        assert result.warnings == 1
        assert len(result.details) == 3

    def test_import_result_all_ok(self):
        from api.src.imports.schemas import ImportResult

        result = ImportResult(total_rows=5, success=5, errors=0, warnings=0, details=[])
        assert result.total_rows == 5
        assert result.success == 5
        assert result.errors == 0

    def test_import_preview(self):
        from api.src.imports.schemas import ImportPreview

        preview = ImportPreview(
            headers=["sku", "nombre", "precio"],
            rows=[
                {"sku": "P01", "nombre": "Prod 1", "precio": "10000"},
                {"sku": "P02", "nombre": "Prod 2", "precio": "20000"},
            ],
            total_rows=2,
        )
        assert len(preview.headers) == 3
        assert len(preview.rows) == 2
        assert preview.total_rows == 2
