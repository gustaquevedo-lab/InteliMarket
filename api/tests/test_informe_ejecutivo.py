from api.src.reports.service import _lineas_ejecutivas


def test_lineas_salen_del_resumen_sin_iva_y_no_restan_dos_veces_las_nc():
    resumen = {"total_vendido": 7_000_000_000, "cmv": 6_500_000_000, "utilidad_bruta": 500_000_000,
               "margen_bruto_pct": 7.14, "descuentos_pos": 0, "devoluciones_nc": 140_000_000,
               "resultado_neto": 500_000_000}
    lineas = _lineas_ejecutivas(resumen)
    por_clave = {l["clave"]: l["monto"] for l in lineas}
    assert [l["orden"] for l in lineas] == [1, 2, 3, 4, 5, 6, 7]
    assert por_clave["total_vendido"] - por_clave["cmv"] == por_clave["utilidad_bruta"]
    # las NC ya estan restadas en la linea 1: el resultado no las vuelve a restar
    assert por_clave["resultado_neto"] == por_clave["utilidad_bruta"]
