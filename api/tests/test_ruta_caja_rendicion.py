"""Rendición de una caja de cobrador: casos reales del legacy de Casa Gonzalito (copia local, jul-2026).

Cada caso trae los componentes medidos en el legacy y el efectivo+cheques que la caja realmente entregó
(tablas efectivo + cheques_recibidos + cheques_al_dia); la diferencia es el faltante/sobrante que el legacy
registra en cta_cte_funcionarios.
"""
import pytest

from api.src.ruta_caja.rendicion import calcular_rendicion

# (idcaja, movimientos, entregado_real_legacy)
CASOS = [
    # Mercado Luz: contado + cobro de deuda + saldo a favor se va entero en un depósito bancario -> 0
    (267575, dict(facturas=2_545_086, cobros=50_344, otros_ingresos=4_952, depositos=2_600_382), 0),
    # una factura contado pasó a crédito después de la entrega (ctas_a_cobrar) + devoluciones
    (267514, dict(facturas=6_530_167, credito=278_536, devoluciones=125_864), 6_125_767),
    # crédito, devoluciones y depósitos de clientes de la carga
    (267526, dict(facturas=14_615_381, credito=406_220, devoluciones=143_967, depositos=2_518_500), 11_546_694),
    # solo crédito: la nota de crédito sobre esas facturas ya bajó el saldo por cobrar y la caja queda en 0
    (267491, dict(facturas=231_096, credito=95_604, devoluciones=135_492), 0),
    # facturas tipo crédito que se cobraron en el acto (sin saldo en ctas_a_cobrar): entran como efectivo
    (266044, dict(facturas=3_008_814), 3_008_814),
    # contado con un saldo parcial a crédito y todo lo demás depositado: sobran 41.891 (el legacy lo carga como sobrante)
    (267023, dict(facturas=6_523_270, credito=41_891, depositos=6_523_270), -41_891),
    # gasto autorizado: anticipo al funcionario con el efectivo de la caja
    (267422, dict(facturas=321_840, gastos=321_840), 0),
]


@pytest.mark.parametrize("idcaja,mov,entregado", CASOS)
def test_rendicion_iguala_lo_entregado(idcaja, mov, entregado):
    assert calcular_rendicion(mov)["total"] == entregado


def test_componentes_y_signos():
    r = calcular_rendicion(dict(facturas=100, credito=20, cobros=10, otros_ingresos=5, devoluciones=3, depositos=40, gastos=2))
    assert r["total"] == 100 - 20 + 10 + 5 - 3 - 40 - 2
    assert r["credito"] == 20 and r["gastos"] == 2


def test_montos_con_decimales_van_hacia_arriba():
    assert calcular_rendicion(dict(facturas="1567.7"))["total"] == 1568
