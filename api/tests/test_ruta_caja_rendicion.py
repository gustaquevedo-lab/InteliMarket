"""Rendición de una caja de cobrador: casos reales del legacy de Casa Gonzalito (copia local, jul-2026).

Cada caso trae los componentes medidos en el legacy y el efectivo+cheques que la caja realmente entregó
(tablas efectivo + cheques_recibidos + cheques_al_dia); la diferencia es el faltante/sobrante que el legacy
registra en cta_cte_funcionarios.
"""
import pytest

from api.src.ruta_caja.rendicion import calcular_rendicion

# (idcaja, movimientos, entregado_real_legacy)
CASOS = [
    # Mercado Luz: contado + cobro + saldo a favor se va entero en un depósito bancario -> 0
    (267575, dict(facturas_contado=2_545_086, cobros=50_344, otros_ingresos=4_952, depositos=2_600_382), 0),
    # una factura contado pasó a crédito después de la entrega (ctas_a_cobrar): no es efectivo; hay devoluciones
    (267514, dict(facturas_contado=6_251_631, facturas_credito=278_536, devoluciones=125_864), 6_125_767),
    # devoluciones y depósitos/gastos de la carga; crédito aparte
    (267526, dict(facturas_contado=14_209_161, facturas_credito=406_220, devoluciones=143_967, depositos=2_518_500),
     11_546_694),
    # solo crédito con una nota de crédito sobre factura a crédito: no mueve efectivo
    (267491, dict(facturas_credito=231_096, dev_credito=135_492), 0),
]


@pytest.mark.parametrize("idcaja,mov,entregado", CASOS)
def test_rendicion_iguala_lo_entregado(idcaja, mov, entregado):
    assert calcular_rendicion(mov)["total"] == entregado


def test_componentes_y_signos():
    r = calcular_rendicion(dict(facturas_contado=100, cobros=10, otros_ingresos=5, devoluciones=3, depositos=40, gastos=2))
    assert r["total"] == 100 + 10 + 5 - 3 - 40 - 2
    assert r["facturas_credito"] == 0 and r["dev_credito"] == 0


def test_montos_con_decimales_van_hacia_arriba():
    assert calcular_rendicion(dict(facturas_contado="1567.7"))["total"] == 1568
