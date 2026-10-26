from decimal import Decimal
import uuid
import pytest

from api.src.actividades.service import auditar


def test_auditar_igual_pasa():
    celular = [
        {"product_id": "p-1", "actividad_id": "act-1", "descuento_unitario": Decimal("500"), "bonificada": False, "valor": Decimal("5000")}
    ]
    servidor = [
        {"product_id": "p-1", "actividad_id": "act-1", "descuento_unitario": Decimal("500"), "bonificada": False, "valor": Decimal("5000")}
    ]
    saldos = {"act-1": Decimal("100000")}
    diffs = auditar(celular, servidor, saldos)
    assert diffs == []


def test_auditar_descuento_distinto():
    celular = [
        {"product_id": "p-1", "actividad_id": "act-1", "descuento_unitario": Decimal("800"), "bonificada": False, "valor": Decimal("8000")}
    ]
    servidor = [
        {"product_id": "p-1", "actividad_id": "act-1", "descuento_unitario": Decimal("500"), "bonificada": False, "valor": Decimal("5000")}
    ]
    saldos = {"act-1": Decimal("100000")}
    diffs = auditar(celular, servidor, saldos)
    assert len(diffs) == 1
    assert diffs[0]["motivo"] == "descuento_distinto"
    assert diffs[0]["product_id"] == "p-1"


def test_auditar_actividad_vencida():
    celular = [
        {"product_id": "p-1", "actividad_id": "act-vencida", "descuento_unitario": Decimal("500"), "bonificada": False, "valor": Decimal("5000")}
    ]
    servidor = [
        {"product_id": "p-1", "actividad_id": None, "descuento_unitario": Decimal("0"), "bonificada": False, "valor": Decimal("0")}
    ]
    saldos = {}  # servidor no tiene act-vencida en vigentes
    diffs = auditar(celular, servidor, saldos)
    assert len(diffs) == 1
    assert diffs[0]["motivo"] == "actividad_vencida"


def test_auditar_presupuesto_insuficiente():
    celular = [
        {"product_id": "p-1", "actividad_id": "act-1", "descuento_unitario": Decimal("500"), "bonificada": False, "valor": Decimal("15000")}
    ]
    servidor = [
        {"product_id": "p-1", "actividad_id": "act-1", "descuento_unitario": Decimal("500"), "bonificada": False, "valor": Decimal("15000")}
    ]
    saldos = {"act-1": Decimal("10000")}  # saldo menor que 15000
    diffs = auditar(celular, servidor, saldos)
    assert len(diffs) == 1
    assert diffs[0]["motivo"] == "presupuesto_insuficiente"


def test_auditar_bonificada_sin_derecho():
    celular = [
        {"product_id": "p-1", "actividad_id": None, "descuento_unitario": Decimal("0"), "bonificada": False, "valor": Decimal("0")},
        {"product_id": "p-1", "actividad_id": "act-boni", "cantidad": Decimal("5"), "descuento_unitario": Decimal("0"), "bonificada": True, "valor": Decimal("50000")}
    ]
    servidor = [
        {"product_id": "p-1", "actividad_id": None, "descuento_unitario": Decimal("0"), "bonificada": False, "valor": Decimal("0")}
    ]
    saldos = {"act-boni": Decimal("100000")}
    diffs = auditar(celular, servidor, saldos)
    assert len(diffs) == 1
    assert diffs[0]["motivo"] == "bonificada_sin_derecho"


def test_auditar_descuento_sin_actividad():
    celular = [
        {"product_id": "p-1", "actividad_id": None, "descuento_unitario": Decimal("500"), "bonificada": False, "valor": Decimal("5000")}
    ]
    servidor = [
        {"product_id": "p-1", "actividad_id": None, "descuento_unitario": Decimal("0"), "bonificada": False, "valor": Decimal("0")}
    ]
    saldos = {}
    diffs = auditar(celular, servidor, saldos)
    assert len(diffs) == 1
    assert diffs[0]["motivo"] == "descuento_sin_actividad"
