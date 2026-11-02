"""Cada consulta de estos reportes tiene que filtrar por la empresa del usuario."""
import asyncio

import pytest

from api.src.reports import service

C = "00000000-0000-0000-0000-000000000010"


class _Fila(dict):
    def __missing__(self, k):
        return 0


class _Res:
    def mappings(self):
        return self

    def first(self):
        return _Fila()

    def all(self):
        return []

    def __iter__(self):
        return iter([])

    def scalar(self):
        return 0


class _DB:
    def __init__(self):
        self.consultas = []

    async def execute(self, stmt, params=None):
        self.consultas.append((str(stmt), dict(params or {})))
        return _Res()


REPORTES = [
    ("get_sales_by_client", ()),
    ("get_inventory_summary", ()),
    ("get_inventory_detail", ()),
    ("get_inventory_rotation", ()),
    ("get_financial_summary", ()),
    ("get_financial_by_day", ()),
    ("get_inventory_valuation", ()),
    ("get_fifo_costing", ()),
    ("get_lifo_costing", ()),
]


@pytest.mark.parametrize("nombre,args", REPORTES)
def test_cada_consulta_filtra_por_empresa(nombre, args):
    db = _DB()
    asyncio.run(getattr(service, nombre)(db, C, *args))
    assert db.consultas, nombre
    for sql, params in db.consultas:
        assert "company_id" in sql, f"{nombre}: consulta sin filtro de empresa:\n{sql[:300]}"
