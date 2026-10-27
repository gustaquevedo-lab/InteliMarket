"""Fórmula de rendición de una caja de cobrador (una sesión = una caja/salida). Función pura, sin base de datos:
la usan la API (service.py) y el comparador contra el sistema viejo de Casa Gonzalito.

    efectivo y cheques a entregar = facturas de la carga - crédito (lo que quedó por cobrar) + cobros de deudas
                                    + otros ingresos - devoluciones/notas de crédito
                                    - depósitos y transferencias de clientes - gastos autorizados

`credito` es el saldo por cobrar que dejaron esas facturas (ya neto de sus notas de crédito): una factura
a crédito se cobró en el acto si no dejó saldo, y una de contado puede dejar saldo parcial.
"""
from api.src.common.money import gs

COMPONENTES = ("facturas", "credito", "cobros", "otros_ingresos", "devoluciones", "depositos", "gastos")


def calcular_rendicion(mov: dict) -> dict:
    c = {k: int(gs(mov.get(k))) for k in COMPONENTES}
    c["total"] = (c["facturas"] - c["credito"] + c["cobros"] + c["otros_ingresos"]
                  - c["devoluciones"] - c["depositos"] - c["gastos"])
    return c
