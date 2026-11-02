from datetime import date

from api.src.reports.service import _tramo_cache

HOY = date(2026, 11, 2)


def test_historico_usa_meses_cerrados_hasta_10_dias_antes():
    # octubre queda en vivo: la reconciliacion con el legacy todavia puede tocarlo
    assert _tramo_cache(None, None, HOY) == (None, date(2026, 10, 1))


def test_anio_completo_sale_entero_del_resumen():
    assert _tramo_cache(date(2025, 1, 1), date(2025, 12, 31), HOY) == (date(2025, 1, 1), date(2026, 1, 1))


def test_bordes_de_mes_parcial_quedan_afuera():
    assert _tramo_cache(date(2025, 3, 15), date(2025, 6, 10), HOY) == (date(2025, 4, 1), date(2025, 6, 1))


def test_sin_mes_completo_no_usa_resumen():
    assert _tramo_cache(date(2025, 3, 15), date(2025, 3, 20), HOY) is None
    assert _tramo_cache(date(2026, 10, 1), date(2026, 10, 30), HOY) is None


def test_mes_recien_cerrado_entra_pasados_10_dias():
    assert _tramo_cache(None, None, date(2026, 11, 15)) == (None, date(2026, 11, 1))
