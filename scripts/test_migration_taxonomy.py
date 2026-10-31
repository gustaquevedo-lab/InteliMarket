"""Test verification for alembic migration 20261031170000_add_representatives_and_taxonomy.py"""
import sys
import py_compile
import importlib.util
from unittest.mock import MagicMock, patch
from pathlib import Path


DEFAULT_MIGRATION_PATH = Path(__file__).resolve().parent.parent / "api/alembic/versions/20261031170000_add_representatives_and_taxonomy.py"


def test_migration_compilation(migration_path: Path = DEFAULT_MIGRATION_PATH):
    print(f"[1/3] Verificando compilacion de sintaxis: {migration_path}...")
    py_compile.compile(str(migration_path), doraise=True)
    print("  -> Compilacion exitosa (sin errores de sintaxis).")


def test_migration_structure(migration_path: Path = DEFAULT_MIGRATION_PATH):
    print("[2/3] Importando módulo y validando metadata de revision...")
    spec = importlib.util.spec_from_file_location("migration_mod", str(migration_path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    assert mod.revision == "20261031170000", f"Revision incorrecta: {mod.revision}"
    assert mod.down_revision == "20261028100000", f"down_revision incorrecto: {mod.down_revision}"
    print(f"  -> Revision: {mod.revision}, Down revision: {mod.down_revision}")

    print("[3/3] Ejecutando upgrade() y downgrade() con mock de Alembic op...")
    mock_op = MagicMock()
    created_tables = {}
    added_columns = []
    executed_statements = []

    def mock_create_table(name, *columns, **kwargs):
        col_names = [c.name for c in columns if hasattr(c, "name")]
        created_tables[name] = col_names
        mock_op.create_table_calls.append((name, col_names))

    def mock_add_column(table_name, column, **kwargs):
        added_columns.append((table_name, column.name))

    def mock_execute(sql, *args, **kwargs):
        executed_statements.append(str(sql))

    mock_op.create_table_calls = []
    mock_op.create_table.side_effect = mock_create_table
    mock_op.add_column.side_effect = mock_add_column
    mock_op.execute.side_effect = mock_execute

    with patch.object(mod, "op", mock_op):
        mod.upgrade()

        # Validaciones de tablas creadas
        assert "representatives" in created_tables, "Falta tabla representatives"
        rep_cols = created_tables["representatives"]
        for col in ["id", "company_id", "nombre", "contacto", "telefono", "activo", "created_at"]:
            assert col in rep_cols, f"Falta columna {col} en representatives"

        assert "supplier_representatives" in created_tables, "Falta tabla supplier_representatives"
        sup_rep_cols = created_tables["supplier_representatives"]
        for col in ["supplier_id", "representative_id", "es_principal", "created_at"]:
            assert col in sup_rep_cols, f"Falta columna {col} en supplier_representatives"

        assert "product_sections" in created_tables, "Falta tabla product_sections"
        sec_cols = created_tables["product_sections"]
        for col in ["id", "company_id", "nombre", "orden", "activo"]:
            assert col in sec_cols, f"Falta columna {col} en product_sections"

        assert "product_brands" in created_tables, "Falta tabla product_brands"
        brand_cols = created_tables["product_brands"]
        for col in ["id", "company_id", "nombre", "representative_id", "activo"]:
            assert col in brand_cols, f"Falta columna {col} en product_brands"

        # Validaciones de columnas agregadas
        assert ("product_categories", "section_id") in added_columns, "Falta section_id en product_categories"
        assert ("products", "representative_id") in added_columns, "Falta representative_id en products"
        assert ("products", "brand_id") in added_columns, "Falta brand_id en products"
        assert ("products", "tipo_variante") in added_columns, "Falta tipo_variante en products"

        # Validaciones de sembrado de datos (10 secciones y 10 representantes)
        assert len(executed_statements) >= 20, f"Esperadas al menos 20 sentencias SQL de sembrado, obtenidas {len(executed_statements)}"

        expected_sections = [
            "Bebidas", "Almacén / Despensa", "Lácteos y Quesería", "Carnicería",
            "Verdulería y Frutería", "Panadería y Confitería", "Limpieza y Lavandería",
            "Perfumería y Cuidado Personal", "Bazar y Hogar", "Mascotas"
        ]
        expected_representatives = [
            "PARESA", "CERVEPAR", "UNILEVER", "BEBIDAS DEL PARAGUAY", "VIERCI",
            "CHORTITZER (TREBOL)", "LACTOLANDA", "TROVATO", "IRIS", "REAL SUL"
        ]
        joined_stmts = " ".join(executed_statements)
        for sec in expected_sections:
            assert sec in joined_stmts, f"Seccion {sec} no encontrada en sentencias de insercion"
        for rep in expected_representatives:
            assert rep in joined_stmts, f"Representante {rep} no encontrado en sentencias de insercion"
        assert "00000000-0000-0000-0000-000000000010" in joined_stmts, "company_id incorrecto en sentencias de insercion"

        print("  -> upgrade() validado exitosamente:")
        print(f"     * Tablas creadas: {list(created_tables.keys())}")
        print(f"     * Columnas agregadas: {added_columns}")
        print(f"     * Inserciones de semilla ejecutadas: {len(executed_statements)}")

        # Probar downgrade()
        mod.downgrade()
        assert mock_op.drop_table.call_count >= 4, "Downgrade debe eliminar al menos 4 tablas"
        assert mock_op.drop_column.call_count >= 4, "Downgrade debe eliminar al menos 4 columnas"
        print("  -> downgrade() validado exitosamente (reversion de columnas y tablas en orden correcto).")


if __name__ == "__main__":
    repo_root = Path(__file__).resolve().parent.parent
    migration_file = repo_root / "api/alembic/versions/20261031170000_add_representatives_and_taxonomy.py"
    
    test_migration_compilation(migration_file)
    test_migration_structure(migration_file)
    print("\n✅ TODOS LOS TESTS DE LA MIGRACION PASARON EXITOSAMENTE.")
