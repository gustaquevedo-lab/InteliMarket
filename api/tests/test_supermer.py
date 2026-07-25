"""Smoke tests for supermarket module schemas"""

from api.src.supermer.schemas import (
    RecipeCreate, RecipeItemCreate, RecipeResponse, RecipeItemResponse,
    ProductionOrderCreate, ProductionOrderResponse, ProductionOrderUpdate,
    ProductionBatchResponse, WasteLogCreate, WasteLogResponse,
    PerishableConfigCreate, PerishableConfigResponse,
    MarkdownLogCreate, MarkdownLogResponse,
    PurchaseForecastResponse, PurchaseSuggestionCreate, PurchaseSuggestionResponse,
    DashboardStats, WasteByArea, ProductionByArea,
)
from uuid import UUID
from decimal import Decimal
from datetime import datetime, date


class TestSupermerSchemas:
    def test_recipe_create(self):
        data = RecipeCreate(
            area="carniceria",
            nombre="Milanesa de pollo",
            producto_terminado_id="00000000-0000-0000-0000-000000000001",
            cantidad_esperada=Decimal("10"),
            items=[
                RecipeItemCreate(producto_id="00000000-0000-0000-0000-000000000002", cantidad=Decimal("15")),
            ],
        )
        assert data.area == "carniceria"
        assert data.nombre == "Milanesa de pollo"
        assert len(data.items) == 1

    def test_order_create(self):
        data = ProductionOrderCreate(
            receta_id="00000000-0000-0000-0000-000000000001",
            cantidad_objetivo=Decimal("50"),
            notas="Producción diaria",
        )
        assert data.cantidad_objetivo == Decimal("50")

    def test_order_update(self):
        data = ProductionOrderUpdate(estado="completada", producto_obtenido=Decimal("45"))
        assert data.estado == "completada"
        assert data.producto_obtenido == Decimal("45")

    def test_waste_create(self):
        data = WasteLogCreate(
            area="panaderia", producto_id="00000000-0000-0000-0000-000000000001",
            cantidad=Decimal("2.5"), tipo_merma="produccion",
        )
        assert data.tipo_merma == "produccion"
        assert data.cantidad == Decimal("2.5")

    def test_perishable_config(self):
        data = PerishableConfigCreate(
            producto_id="00000000-0000-0000-0000-000000000001",
            vida_util_dias=7, categoria_perecedera="lacteos",
        )
        assert data.vida_util_dias == 7

    def test_markdown_create(self):
        data = MarkdownLogCreate(
            producto_id="00000000-0000-0000-0000-000000000001",
            descuento_porcentaje=Decimal("20"),
            precio_original=Decimal("10000"),
        )
        assert data.descuento_porcentaje == Decimal("20")

    def test_dashboard_stats(self):
        data = DashboardStats(
            ordenes_activas=5, ordenes_hoy=3, total_producido_hoy=Decimal("100"),
            merma_diaria_total=Decimal("2"), merma_diaria_porcentaje=Decimal("2"),
            productos_en_markdown=3, productos_por_vencer_30d=10,
            alertas_criticas=2, sugerencias_pendientes=8,
        )
        assert data.ordenes_activas == 5

    def test_production_by_area(self):
        data = ProductionByArea(
            area="carniceria", total_producido=Decimal("80"),
            ordenes_completadas=4, rendimiento_promedio=Decimal("85"),
            merma_cantidad=Decimal("5"), merma_costo=Decimal("50000"),
        )
        assert data.area == "carniceria"

    def test_models_have_tablenames(self):
        from api.src.supermer.models import (
            ProductionRecipe, ProductionRecipeItem, ProductionOrder,
            ProductionBatch, WasteLog, PerishableConfig, MarkdownLog,
            PurchaseForecast, PurchaseSuggestion,
        )
        assert ProductionRecipe.__tablename__ == "supermer_recipes"
        assert ProductionRecipeItem.__tablename__ == "supermer_recipe_items"
        assert ProductionOrder.__tablename__ == "supermer_production_orders"
        assert ProductionBatch.__tablename__ == "supermer_production_batches"
        assert WasteLog.__tablename__ == "supermer_waste_logs"
        assert PerishableConfig.__tablename__ == "supermer_perishable_configs"
        assert MarkdownLog.__tablename__ == "supermer_markdown_logs"
        assert PurchaseForecast.__tablename__ == "supermer_purchase_forecasts"
        assert PurchaseSuggestion.__tablename__ == "supermer_purchase_suggestions"

    def test_purchase_suggestion_create(self):
        data = PurchaseSuggestionCreate(
            producto_id="00000000-0000-0000-0000-000000000001",
            cantidad_sugerida=Decimal("100"),
            lead_time_dias=3,
        )
        assert data.cantidad_sugerida == Decimal("100")
