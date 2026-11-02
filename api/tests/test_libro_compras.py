"""Libro IVA de compras: bases e IVA guardados de la factura del proveedor, nunca supuestos."""
from datetime import date

from api.src.common.money import desglose_iva_incluido
from api.src.reports.service import _fila_libro_compras, _sql_libro


def test_desglose_de_factura_mixta_cuadra_con_el_legacy():
    # fac_compras 106728: GRAB5IC=43.466.400, GRAB10IC=1.056.000 -> DGRAB 42.356.571, IVA 2.165.829
    d = desglose_iva_incluido(exenta=0, gravada_5=43466400, gravada_10=1056000)
    assert d == {"base_exenta": 0, "base_gravada_5": 41396571, "iva_5": 2069829,
                 "base_gravada_10": 960000, "iva_10": 96000}
    assert d["base_gravada_5"] + d["base_gravada_10"] == 42356571
    assert d["iva_5"] + d["iva_10"] == 2165829


def test_desglose_nota_de_credito_negativa_y_exenta():
    d = desglose_iva_incluido(exenta=200000, gravada_5=0, gravada_10=-9344422)
    assert d["iva_10"] == -849493 and d["base_gravada_10"] == -8494929
    assert d["base_exenta"] == 200000 and d["iva_5"] == 0


def test_desglose_sin_columnas_queda_sin_desglose():
    # antes de 2016 el legacy no tiene GRAB5IC/GRAB10IC: no se inventa el reparto 5/10
    assert desglose_iva_incluido(exenta=100, gravada_5=None, gravada_10=None) is None


def test_libro_de_compras_usa_bases_guardadas_y_filtra_empresa():
    q, p = _sql_libro("compras", "c1", date(2026, 6, 1), date(2026, 6, 30))
    assert "po.company_id = :company_id" in q and p["company_id"] == "c1"
    for col in ("po.base_gravada_10", "po.base_gravada_5", "po.base_exenta", "po.iva_10", "po.iva_5"):
        assert col in q
    assert "1.1" not in q and "ROUND" not in q.upper()
    assert "AT TIME ZONE 'America/Asuncion'" in q  # el libro muestra el dia de Asuncion, nunca UTC


def test_libro_y_resumen_de_ventas_filtran_empresa():
    for tipo in ("ventas", "compras"):
        q, p = _sql_libro(tipo, "c1", None, None, resumen=True)
        assert "company_id = :company_id" in q and p["company_id"] == "c1"
    q, _ = _sql_libro("compras", "c1", None, None, resumen=True)
    assert "purchase_orders" in q and "sales" not in q


def test_compra_sin_desglose_no_muestra_montos_inventados():
    r = {"fecha": date(2010, 1, 5), "nro_comprobante": "C1", "ruc_emisor": "80000000-1", "ruc_receptor": None,
         "razon_social": "X", "condicion_iva": "Contribuyente", "monto_5": None, "monto_10": None,
         "monto_exento": None, "iva_5": None, "iva_10": None, "total": 5000}
    f = _fila_libro_compras(r)
    assert f["sin_desglose"] is True
    assert f["monto_10"] is None and f["iva_10"] is None and f["total"] == 5000
