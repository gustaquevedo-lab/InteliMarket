"""Unit tests for Butchery Desposte stock feeding and TV Digital schemas / services"""

from decimal import Decimal
from uuid import uuid4
from datetime import datetime, timezone
import pytest

from api.src.supermer.schemas import (
    DesposteInput, DesposteResponse,
    TvCutItem, TvCutsResponse, TvCutsVisibilityUpdate,
)


class TestButcheryAndTvSchemas:
    def test_desposte_input_extended(self):
        tmpl_id = str(uuid4())
        raw_id = str(uuid4())
        wh_id = str(uuid4())
        corte_id = str(uuid4())

        inp = DesposteInput(
            template_id=tmpl_id,
            peso_entrada_kg=Decimal("250.50"),
            costo_total_gs=Decimal("7750000"),
            insumo_producto_id=raw_id,
            deposito_origen_id=wh_id,
            deposito_destino_id=wh_id,
            ajustes_cortes={corte_id: Decimal("32.50")},
            notas="Desposte de novillo prueba",
        )

        assert inp.template_id == tmpl_id
        assert inp.peso_entrada_kg == Decimal("250.50")
        assert inp.insumo_producto_id == raw_id
        assert inp.ajustes_cortes[corte_id] == Decimal("32.50")

    def test_tv_cut_item_schema(self):
        item = TvCutItem(
            producto_id=str(uuid4()),
            nombre="Costilla de Primera",
            sku="120093",
            plu=7,
            categoria="Vacuno",
            precio=Decimal("34777"),
            precio_anterior=Decimal("38777"),
            en_promo=True,
            badge_promo="OFERTA",
            porcentaje_descuento=Decimal("10.3"),
            visible_en_tv=True,
            orden=1,
            stock_kg=Decimal("150.0"),
        )

        assert item.nombre == "Costilla de Primera"
        assert item.en_promo is True
        assert item.plu == 7
        assert item.badge_promo == "OFERTA"

    def test_tv_cuts_response_schema(self):
        item = TvCutItem(
            producto_id=str(uuid4()),
            nombre="Tapa Cuadril / Picaña",
            plu=1,
            categoria="Vacuno",
            precio=Decimal("103100"),
            en_promo=False,
            visible_en_tv=True,
            orden=2,
        )

        resp = TvCutsResponse(
            titulo="EXTRA SUPERMERCADO · CARNICERÍA",
            subtitulo="Precios y Ofertas de Salón",
            updated_at=datetime.now(timezone.utc),
            cuts=[item],
        )

        assert len(resp.cuts) == 1
        assert resp.cuts[0].precio == Decimal("103100")

    def test_tv_cuts_visibility_update(self):
        id1 = str(uuid4())
        id2 = str(uuid4())
        upd = TvCutsVisibilityUpdate(
            visible_product_ids=[id1, id2],
            order_ids=[id2, id1],
        )
        assert len(upd.visible_product_ids) == 2
        assert upd.order_ids[0] == id2

    def test_bakery_quick_batch_schemas(self):
        from api.src.supermer.schemas import BakeryQuickBatchInput, BakeryQuickBatchResponse

        pan_id = str(uuid4())
        harina_id = str(uuid4())

        inp = BakeryQuickBatchInput(
            producto_pan_id=pan_id,
            kilos_producidos=65.0,
            insumo_harina_id=harina_id,
            kilos_harina_usada=50.0,
            notas="Horneada de la mañana",
        )
        assert inp.producto_pan_id == pan_id
        assert inp.kilos_producidos == 65.0
        assert inp.kilos_harina_usada == 50.0

        resp = BakeryQuickBatchResponse(
            success=True,
            order_id=str(uuid4()),
            producto_pan_nombre="PAN FRANCES KG",
            kilos_producidos=65.0,
            kilos_harina_descontada=50.0,
            nuevo_stock_pan=42.0,
            nuevo_stock_harina=350.0,
            lote_codigo="PAN-20261020-0001",
            detail="Horneada registrada",
        )
        assert resp.success is True
        assert resp.kilos_producidos == 65.0
        assert resp.nuevo_stock_pan == 42.0

    def test_kiosk_scale_barcode_and_lookup_schema(self):
        from api.src.products.scale_parser import parse_scale_barcode
        from api.src.kiosk.schemas import ProductLookupResponse

        # Balmak Edge / Toledo prefijo 2000 (PLU 98 pan francés, peso 0.540 kg)
        match1 = parse_scale_barcode("2000098005408")
        assert match1 is not None
        assert match1.plu == 98
        assert match1.valor_extraido == 540.0
        peso_kg = round(match1.valor_extraido / 1000.0, 3)
        assert peso_kg == 0.540

        # Balmak Edge formato 20 (PLU 4 dígitos 0100 pan felipe, peso 1.250 kg)
        match2 = parse_scale_barcode("200100012501")
        assert match2 is not None
        assert match2.plu == 100
        assert match2.valor_extraido == 1250.0

        # Validar ProductLookupResponse con campos pesables
        prod_id = uuid4()
        lookup_resp = ProductLookupResponse(
            id=prod_id,
            nombre="PAN FRANCES KG",
            sku="PAN-098",
            codigo_barra="2000098000000",
            precio_venta=10500.0,
            es_pesable=True,
            peso_leido_kg=peso_kg,
            importe_etiqueta_gs=round(peso_kg * 10500.0, 0),
            plu_balanza=98,
        )
        assert lookup_resp.es_pesable is True
        assert lookup_resp.peso_leido_kg == 0.540
        assert lookup_resp.importe_etiqueta_gs == 5670.0
        assert lookup_resp.plu_balanza == 98
