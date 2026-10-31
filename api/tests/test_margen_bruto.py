"""Utilidad bruta del resumen de ventas: venta SIN IVA menos costo (el costo se carga sin IVA)."""
from api.src.reports.service import margen_bruto


def test_margen_sobre_venta_sin_iva():
    # octubre 2026 Casa Gonzalito (redondeado): 7.457M con IVA, 691,7M de IVA, costo 6.331,5M
    m = margen_bruto(monto_total=7_457_349_030, iva=691_782_686, costo=6_331_549_525)
    assert m["monto_sin_iva"] == 6_765_566_344
    assert m["margen_bruto_gs"] == 434_016_819
    assert m["margen_bruto_pct"] == 6.42


def test_sin_margen_inventado_si_el_costo_supera_la_venta():
    m = margen_bruto(monto_total=1_100, iva=100, costo=1_200)
    assert m["margen_bruto_gs"] == -200
    assert m["margen_bruto_pct"] == -20.0


def test_costo_con_decimales_se_redondea_hacia_arriba():
    m = margen_bruto(monto_total=1_100, iva=100, costo=500.2)
    assert m["costo_total"] == 501
    assert m["margen_bruto_gs"] == 499


def test_sin_ventas():
    assert margen_bruto(0, 0, 0)["margen_bruto_pct"] == 0.0
