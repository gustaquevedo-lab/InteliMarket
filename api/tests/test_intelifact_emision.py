"""Emisión de facturas por Intelifact (POST /v1/documents): armado del documento
desde la venta y manejo de las respuestas del servicio."""

import json
from datetime import datetime, timezone

import httpx
import pytest

from api.src.intelifact import emision as em


VENTA = {"id": "11111111-1111-1111-1111-111111111111", "fecha": datetime(2026, 11, 3, 13, 0, tzinfo=timezone.utc),
         "condicion": "contado", "total": 121000}
ITEMS = [
    {"codigo": "A1", "descripcion": "Producto A", "cantidad": 2, "precio_unitario": 50000, "descuento_monto": 0, "iva_tasa": 10, "total": 100000},
    {"codigo": "B1", "descripcion": "Producto B", "cantidad": 1, "precio_unitario": 21000, "descuento_monto": 0, "iva_tasa": 5, "total": 21000},
]


# ── Receptor ──────────────────────────────────────────────────────────────

def test_receptor_contribuyente_juridico_sin_dv():
    r = em.receptor({"razon_social": "Cliente SA", "ruc": "80012345-6", "ci": None})
    assert r == {"ruc": "80012345", "name": "Cliente SA", "taxpayerType": 2}


def test_receptor_contribuyente_persona_fisica():
    r = em.receptor({"razon_social": "Juan Pérez", "ruc": "3552341-0", "ci": "3552341"})
    assert r == {"ruc": "3552341", "name": "Juan Pérez", "taxpayerType": 1}


def test_receptor_ruc_generico_44444401_sale_por_ci_o_innominado():
    con_ci = em.receptor({"razon_social": "María", "ruc": "44444401-7", "ci": "1.234.567"})
    assert con_ci == {"name": "María", "document": "1234567", "idType": 1}
    sin_nada = em.receptor({"razon_social": "CONSUMIDOR FINAL", "ruc": "44444401-7", "ci": None})
    assert sin_nada == {"name": "Sin Nombre", "document": "0", "idType": 5}


def test_receptor_sin_cliente_es_innominado():
    assert em.receptor(None) == {"name": "Sin Nombre", "document": "0", "idType": 5}


# ── Punto de expedición por sucursal ───────────────────────────────────────

def test_punto_de_sucursal_usa_el_mapeo_y_si_no_el_del_alta():
    puntos = {"b-santa-rosa": "001-003"}
    assert em.punto_de_sucursal(puntos, "b-santa-rosa", "001", "001") == ("001", "003")
    assert em.punto_de_sucursal(puntos, "otra", "001", "001") == ("001", "001")
    assert em.punto_de_sucursal(None, None, "001", "002") == ("001", "002")


def test_punto_de_sucursal_mal_cargado_falla():
    with pytest.raises(ValueError):
        em.punto_de_sucursal({"b": "1-3"}, "b", "001", "001")


# ── Documento ─────────────────────────────────────────────────────────────

def test_documento_contado():
    doc = em.armar_documento(VENTA, ITEMS, {"razon_social": "Cliente SA", "ruc": "80012345-6"}, ("001", "003"), None)
    assert doc["establishment"] == "001" and doc["emissionPoint"] == "003"
    assert doc["operationCondition"] == 1
    assert doc["paymentMethod"] == "01"
    assert doc["documentDate"] == "2026-11-03T10:00:00-03:00"  # hora de Asunción
    assert doc["items"][0] == {"code": "A1", "description": "Producto A", "quantity": 2, "unitPrice": 50000, "taxPercent": 10}
    assert doc["items"][1]["taxPercent"] == 5
    assert "creditTermDays" not in doc


def test_documento_credito_con_plazo_del_cliente():
    doc = em.armar_documento({**VENTA, "condicion": "credito"}, ITEMS, None, ("001", "001"), 45)
    assert doc["operationCondition"] == 2
    assert doc["creditTermDays"] == 45
    assert "paymentMethod" not in doc


def test_documento_credito_sin_plazo_usa_30():
    doc = em.armar_documento({**VENTA, "condicion": "credito"}, ITEMS, None, ("001", "001"), None)
    assert doc["creditTermDays"] == 30


def test_item_exento_y_descuento_por_unidad():
    items = [{"codigo": "L", "descripcion": "Libro", "cantidad": 4, "precio_unitario": 10000, "descuento_monto": 2000, "iva_tasa": 0, "total": 38000}]
    doc = em.armar_documento({**VENTA, "total": 38000}, items, None, ("001", "001"), None)
    it = doc["items"][0]
    assert it["ivaType"] == 3 and it["taxPercent"] == 0
    assert it["discountAmount"] == 500  # 2000 en la línea / 4 unidades


def test_el_total_de_la_linea_manda_aunque_el_descuento_no_este_guardado():
    # Caso real (venta 3004400): precio de lista 5418, se vendió a 4168 y descuento_monto quedó en 0.
    items = [{"codigo": "7030", "descripcion": "FANTA", "cantidad": 24, "precio_unitario": 5418, "descuento_monto": 0, "iva_tasa": 10, "total": 100032}]
    doc = em.armar_documento({**VENTA, "total": 100032}, items, None, ("001", "001"), None)
    it = doc["items"][0]
    assert it["unitPrice"] == 5418 and it["discountAmount"] == 1250
    assert em.total_documento(doc) == 100032


def test_linea_cobrada_por_encima_del_precio_usa_el_precio_real():
    items = [{"codigo": "X", "descripcion": "X", "cantidad": 3, "precio_unitario": 1000, "descuento_monto": 0, "iva_tasa": 10, "total": 3300}]
    doc = em.armar_documento({**VENTA, "total": 3300}, items, None, ("001", "001"), None)
    assert doc["items"][0]["unitPrice"] == 1100 and "discountAmount" not in doc["items"][0]


def test_no_arma_un_documento_que_no_suma_lo_mismo_que_la_venta():
    with pytest.raises(ValueError, match="no coincide"):
        em.armar_documento({**VENTA, "total": 999}, ITEMS, None, ("001", "001"), None)


# ── Respuestas del servicio ───────────────────────────────────────────────

def _transport(status, body, seen=None):
    def handler(request: httpx.Request):
        if seen is not None:
            seen.append(request)
        return httpx.Response(status, json=body)
    return httpx.MockTransport(handler)


APROBADO = {"cdc": "0" * 44, "documentNumber": "001-003-0000001", "status": "APPROVED",
            "qrUrl": "https://ekuatia.set.gov.py/consultas/qr?x", "error": None}


@pytest.mark.asyncio
async def test_enviar_aprobado_manda_api_key_e_idempotencia():
    seen = []
    r = await em.enviar("https://if.test", "ifk_abc", {"items": []}, "venta-1", transport=_transport(201, APROBADO, seen))
    assert seen[0].url == "https://if.test/v1/documents"
    assert seen[0].headers["x-api-key"] == "ifk_abc"
    assert seen[0].headers["idempotency-key"] == "venta-1"
    assert r == {"sifen_estado": "aprobado", "cdc": "0" * 44, "factura_numero": "001-003-0000001",
                 "link_qr": APROBADO["qrUrl"], "error": None}


@pytest.mark.asyncio
async def test_enviar_rechazado_y_pendiente():
    rech = await em.enviar("https://if.test", "k", {}, "v", transport=_transport(201, {**APROBADO, "status": "REJECTED", "error": "RUC receptor inexistente"}))
    assert rech["sifen_estado"] == "rechazado" and rech["error"] == "RUC receptor inexistente"
    pend = await em.enviar("https://if.test", "k", {}, "v", transport=_transport(201, {**APROBADO, "status": "PENDING", "error": "timeout"}))
    assert pend["sifen_estado"] == "pendiente" and pend["cdc"] == "0" * 44


@pytest.mark.asyncio
async def test_enviar_datos_invalidos_no_se_reintenta_solo():
    r = await em.enviar("https://if.test", "k", {}, "v", transport=_transport(400, {"error": "Datos inválidos", "details": ["items es requerido"]}))
    assert r["sifen_estado"] == "error_datos"
    assert "items es requerido" in r["error"]
    assert r["cdc"] is None


@pytest.mark.asyncio
async def test_enviar_servicio_caido_queda_para_reintentar():
    def handler(request):
        raise httpx.ConnectError("sin red")
    r = await em.enviar("https://if.test", "k", {}, "v", transport=httpx.MockTransport(handler))
    assert r["sifen_estado"] == "error_envio"
    assert r["cdc"] is None
    r5 = await em.enviar("https://if.test", "k", {}, "v", transport=_transport(502, {"error": "x"}))
    assert r5["sifen_estado"] == "error_envio"


@pytest.mark.asyncio
async def test_reintentar_pendiente_usa_retry_y_si_ya_no_esta_pendiente_consulta():
    seen = []
    r = await em.reintentar("https://if.test", "k", "1" * 44, transport=_transport(200, APROBADO, seen))
    assert seen[0].method == "POST" and seen[0].url.path == f"/v1/documents/{'1' * 44}/retry"
    assert r["sifen_estado"] == "aprobado"

    calls = []
    def handler(request):
        calls.append(request)
        if request.url.path.endswith("/retry"):
            return httpx.Response(409, json={"error": "no está PENDING"})
        return httpx.Response(200, json={**APROBADO, "status": "REJECTED", "error": "duplicado"})
    r2 = await em.reintentar("https://if.test", "k", "1" * 44, transport=httpx.MockTransport(handler))
    assert calls[1].method == "GET" and calls[1].url.params["refresh"] == "true"
    assert r2["sifen_estado"] == "rechazado"
