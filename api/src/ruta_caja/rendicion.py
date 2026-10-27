"""Fórmula de rendición de una caja de cobrador (una sesión = una caja/salida). Función pura, sin base de datos:
la usan la API (service.py) y el comparador contra el sistema viejo de Casa Gonzalito.

    efectivo y cheques a entregar = facturas CONTADO + cobros de deudas + otros ingresos
                                    - devoluciones (notas de crédito sobre facturas contado)
                                    - depósitos/transferencias de clientes - gastos autorizados

Las facturas a crédito y las notas de crédito sobre ellas no mueven efectivo: se informan, no suman.
"""
from api.src.common.money import gs

COMPONENTES = ("facturas_contado", "facturas_credito", "cobros", "otros_ingresos",
               "devoluciones", "dev_credito", "depositos", "gastos")


def calcular_rendicion(mov: dict) -> dict:
    c = {k: int(gs(mov.get(k))) for k in COMPONENTES}
    c["total"] = (c["facturas_contado"] + c["cobros"] + c["otros_ingresos"]
                  - c["devoluciones"] - c["depositos"] - c["gastos"])
    return c
