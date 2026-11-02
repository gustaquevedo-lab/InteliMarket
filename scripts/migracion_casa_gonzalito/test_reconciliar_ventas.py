"""Reconciliacion de ventas: que facturas hay que volver a traer del legacy."""
from sync_incremental import ventas_a_reparar


def test_venta_sin_items_en_intelimarket():
    legacy = {101: (3, 30000, 24000, 30000)}   # lineas, importe, costo, total factura
    im = {101: (0, 0, 0, 30000)}
    assert ventas_a_reparar(legacy, im) == {101}


def test_venta_identica_no_se_toca():
    legacy = {101: (3, 30000, 24000, 30000)}
    assert ventas_a_reparar(legacy, dict(legacy)) == set()


def test_diferencia_en_importe_costo_o_total_de_factura():
    legacy = {1: (2, 100, 80, 100), 2: (2, 100, 80, 100), 3: (2, 100, 80, 100)}
    im = {1: (2, 90, 80, 100), 2: (2, 100, 70, 100), 3: (2, 100, 80, 120)}
    assert ventas_a_reparar(legacy, im) == {1, 2, 3}


def test_redondeo_de_un_guarani_no_cuenta():
    legacy = {1: (2, 100, 80, 100)}
    im = {1: (2, 101, 79, 100)}
    assert ventas_a_reparar(legacy, im) == set()


def test_venta_que_no_existe_en_el_legacy_no_se_toca():
    assert ventas_a_reparar({}, {7: (1, 10, 5, 10)}) == set()


def test_fecha_con_hora_usa_dia_de_factura_y_hora_de_carga():
    from datetime import date, datetime
    from sync_incremental import fecha_con_hora
    assert fecha_con_hora(date(2016, 6, 14), datetime(2016, 6, 15, 10, 35, 49)) == datetime(2016, 6, 14, 10, 35, 49)
    assert fecha_con_hora(date(2014, 2, 20), None) == datetime(2014, 2, 20)
    assert fecha_con_hora(date(2014, 2, 20), "0000-00-00 00:00:00") == datetime(2014, 2, 20)
    assert fecha_con_hora(date(2014, 2, 20), datetime(1899, 12, 30, 0, 0)) == datetime(2014, 2, 20)
    assert fecha_con_hora(None, datetime(2016, 6, 15, 10, 0)) is None
