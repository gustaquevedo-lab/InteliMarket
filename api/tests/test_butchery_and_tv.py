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
