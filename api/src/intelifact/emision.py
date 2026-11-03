"""Emisión de facturas electrónicas por el servicio Intelifact (POST /v1/documents).

Contrato del servicio: InteliFact-Library/service/INTEGRACION.md. El servicio numera,
firma, arma el QR y habla con SIFEN; acá solo se arma el documento desde la venta y se
guarda el resultado en la venta (cdc, factura_numero, link_qr, sifen_estado).

Estados que quedan en sales.sifen_estado:
  aprobado     SIFEN aprobó.
  rechazado    SIFEN rechazó (motivo en sifen_xml_response). Hay que corregir y emitir de nuevo.
  pendiente    SIFEN no respondió; el XML firmado quedó en Intelifact. Se reintenta solo.
  error_envio  No llegamos a Intelifact (red, caída). Se reintenta solo con la misma clave.
  error_datos  Intelifact rechazó los datos (400/422...). No se reintenta solo.
"""

import json
import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger("intelimarket.intelifact.emision")

TZ = ZoneInfo("America/Asuncion")
TIMEOUT = 45.0
RUC_GENERICO = "44444401"  # "consumidor final" del legacy: no es un receptor real
PLAZO_DEFAULT = 30
REINTENTABLES = ("pendiente", "error_envio")

_ESTADOS = {"APPROVED": "aprobado", "REJECTED": "rechazado", "PENDING": "pendiente"}
_INNOMINADO = {"name": "Sin Nombre", "document": "0", "idType": 5}


def _num(v):
    """Decimal de la base → int si es entero, si no float (cantidades en kg)."""
    if isinstance(v, Decimal):
        v = int(v) if v == v.to_integral_value() else float(v)
    return v


def _digitos(s) -> str:
    return re.sub(r"\D", "", str(s or ""))


# ── Armado del documento (sin base ni red) ─────────────────────────────────

def receptor(cliente: dict | None) -> dict:
    if not cliente:
        return dict(_INNOMINADO)
    nombre = (cliente.get("razon_social") or cliente.get("nombre") or "").strip()
    base = _digitos((cliente.get("ruc") or "").split("-")[0])
    if base and base != RUC_GENERICO and int(base) > 0:
        tipo = 2 if len(base) == 8 and base.startswith("80") else 1  # 80xxxxxx = persona jurídica
        return {"ruc": base, "name": nombre, "taxpayerType": tipo}
    ci = _digitos(cliente.get("ci"))
    if ci and int(ci) > 0:
        return {"name": nombre or "Sin Nombre", "document": ci, "idType": 1}
    return dict(_INNOMINADO)


def punto_de_sucursal(puntos: dict | None, branch_id, est_default: str, pto_default: str) -> tuple[str, str]:
    valor = (puntos or {}).get(str(branch_id)) if branch_id else None
    if not valor:
        return est_default, pto_default
    m = re.fullmatch(r"(\d{3})-(\d{3})", str(valor).strip())
    if not m:
        raise ValueError(f"Punto de expedición mal cargado para la sucursal {branch_id}: {valor!r} (se espera 001-002)")
    return m.group(1), m.group(2)


def _entero_o_float(x):
    return int(x) if float(x).is_integer() else x


def _item(i: dict) -> dict:
    """El total de la línea es lo cobrado y manda: en ventas migradas precio_unitario es el
    de lista y el descuento no siempre quedó en descuento_monto (venta 3004400: lista 5418,
    cobrado 4168, descuento_monto 0). La diferencia sale como descuento por unidad."""
    cantidad = _num(i["cantidad"])
    precio = _num(i["precio_unitario"])
    total = _num(i["total"])
    tasa = int(_num(i["iva_tasa"]) or 0)
    out = {"code": i.get("codigo") or None, "description": i.get("descripcion") or "Item",
           "quantity": cantidad, "unitPrice": precio, "taxPercent": tasa}
    if out["code"] is None:
        out.pop("code")
    if tasa == 0:
        out["ivaType"] = 3  # exento
    bruto = precio * cantidad
    if total > bruto:
        out["unitPrice"] = _entero_o_float(total / cantidad)
    elif total < bruto:
        out["discountAmount"] = _entero_o_float((bruto - total) / cantidad)
    return out


def total_documento(doc: dict) -> int:
    return sum(round(i["quantity"] * (i["unitPrice"] - i.get("discountAmount", 0))) for i in doc["items"])


def armar_documento(venta: dict, items: list[dict], cliente: dict | None, punto: tuple[str, str], plazo_dias: int | None) -> dict:
    fecha = venta.get("fecha") or datetime.now(timezone.utc)
    doc = {
        "establishment": punto[0],
        "emissionPoint": punto[1],
        "documentDate": fecha.astimezone(TZ).isoformat(timespec="seconds"),
        "recipient": receptor(cliente),
        "items": [_item(i) for i in items],
    }
    if (venta.get("condicion") or "contado").lower() == "credito":
        doc["operationCondition"] = 2
        doc["creditTermDays"] = int(plazo_dias or PLAZO_DEFAULT)
    else:
        doc["operationCondition"] = 1
        doc["paymentMethod"] = "01"
    if venta.get("total") is not None and total_documento(doc) != _num(venta["total"]):
        raise ValueError(f"El total de las líneas ({total_documento(doc)}) no coincide con el de la venta ({_num(venta['total'])})")
    return doc


# ── Llamadas al servicio ───────────────────────────────────────────────────

def _resultado(body: dict) -> dict:
    return {
        "sifen_estado": _ESTADOS.get(body.get("status"), "pendiente"),
        "cdc": body.get("cdc"),
        "factura_numero": body.get("documentNumber"),
        "link_qr": body.get("qrUrl"),
        "error": body.get("error"),
    }


def _fallo(estado: str, error: str) -> dict:
    return {"sifen_estado": estado, "cdc": None, "factura_numero": None, "link_qr": None, "error": error}


def _texto_error(resp: httpx.Response) -> str:
    try:
        body = resp.json()
    except ValueError:
        return f"HTTP {resp.status_code}: {resp.text[:300]}"
    partes = [str(body.get("error") or f"HTTP {resp.status_code}")]
    if body.get("details"):
        partes.append(json.dumps(body["details"], ensure_ascii=False))
    return " — ".join(partes)


def _cliente(base_url: str, api_key: str, transport) -> httpx.AsyncClient:
    return httpx.AsyncClient(base_url=base_url.rstrip("/"), headers={"x-api-key": api_key},
                             timeout=TIMEOUT, transport=transport)


async def enviar(base_url: str, api_key: str, documento: dict, clave: str, transport=None) -> dict:
    try:
        async with _cliente(base_url, api_key, transport) as http:
            resp = await http.post("/v1/documents", json=documento, headers={"idempotency-key": clave})
    except httpx.HTTPError as e:
        return _fallo("error_envio", f"No se pudo conectar con Intelifact: {e}")
    if resp.status_code >= 500:
        return _fallo("error_envio", _texto_error(resp))
    if resp.status_code >= 400:
        return _fallo("error_datos", _texto_error(resp))
    return _resultado(resp.json())


async def reintentar(base_url: str, api_key: str, cdc: str, transport=None) -> dict:
    """Para un PENDING: el servicio consulta a SIFEN antes de reenviar. Si ya no está
    pendiente (409), se lee el estado actual."""
    try:
        async with _cliente(base_url, api_key, transport) as http:
            resp = await http.post(f"/v1/documents/{cdc}/retry")
            if resp.status_code == 409:
                resp = await http.get(f"/v1/documents/{cdc}", params={"refresh": "true"})
    except httpx.HTTPError as e:
        return {**_fallo("pendiente", f"No se pudo conectar con Intelifact: {e}"), "cdc": cdc}
    if resp.status_code >= 400:
        return {**_fallo("pendiente", _texto_error(resp)), "cdc": cdc}
    return _resultado(resp.json())


# ── Con la base ───────────────────────────────────────────────────────────

async def config_activa(db: AsyncSession, company_id) -> dict | None:
    from api.src.payment_integrations.crypto import decrypt_value

    row = (await db.execute(text(
        "SELECT service_base_url, api_key, codigo_establecimiento, codigo_punto_expedicion, puntos_por_sucursal, timbrado "
        "FROM intelifact_configs WHERE company_id = :c AND enabled"), {"c": str(company_id)})).mappings().first()
    if not row or not row["api_key"] or not row["service_base_url"]:
        return None
    cfg = dict(row)
    cfg["api_key"] = decrypt_value(cfg["api_key"])
    return cfg


async def _guardar(db: AsyncSession, sale_id, r: dict, timbrado) -> None:
    await db.execute(text(
        "UPDATE sales SET sifen_estado = :estado, cdc = COALESCE(:cdc, cdc), "
        "factura_numero = COALESCE(:num, factura_numero), link_qr = COALESCE(:qr, link_qr), "
        "timbrado = CASE WHEN :cdc IS NOT NULL THEN :timbrado ELSE timbrado END, "
        "sifen_fecha_respuesta = now(), sifen_xml_response = :err, updated_at = now() WHERE id = :id"),
        {"estado": r["sifen_estado"], "cdc": r["cdc"], "num": r["factura_numero"], "qr": r["link_qr"],
         "timbrado": timbrado, "err": r["error"], "id": str(sale_id)})
    await db.commit()


async def emitir_venta(db: AsyncSession, sale_id, transport=None) -> dict:
    venta = (await db.execute(text(
        "SELECT id, company_id, branch_id, customer_id, fecha, condicion, total, sifen_estado, cdc "
        "FROM sales WHERE id = :id"), {"id": str(sale_id)})).mappings().first()
    if not venta:
        raise ValueError("Venta no encontrada")
    if venta["sifen_estado"] == "aprobado":
        return {"sifen_estado": "aprobado", "cdc": venta["cdc"], "error": None}
    cfg = await config_activa(db, venta["company_id"])
    if not cfg:
        raise ValueError("Intelifact no está habilitado o le falta la URL o la clave para esta empresa")

    items = [dict(r) for r in (await db.execute(text(
        "SELECT p.sku AS codigo, COALESCE(NULLIF(i.descripcion, ''), p.nombre) AS descripcion, i.cantidad, i.precio_unitario, i.descuento_monto, i.iva_tasa, i.total "
        "FROM sale_items i LEFT JOIN products p ON p.id = i.product_id WHERE i.sale_id = :id ORDER BY i.created_at"),
        {"id": str(sale_id)})).mappings().all()]
    cliente, plazo = None, None
    if venta["customer_id"]:
        c = (await db.execute(text(
            "SELECT c.razon_social, c.ruc, c.ci, a.dias_plazo FROM customers c "
            "LEFT JOIN customer_accounts a ON a.customer_id = c.id AND a.activo WHERE c.id = :id LIMIT 1"),
            {"id": str(venta["customer_id"])})).mappings().first()
        if c:
            cliente, plazo = dict(c), c["dias_plazo"]

    try:
        punto = punto_de_sucursal(cfg["puntos_por_sucursal"], venta["branch_id"],
                                  cfg["codigo_establecimiento"] or "001", cfg["codigo_punto_expedicion"] or "001")
        documento = armar_documento(dict(venta), items, cliente, punto, plazo)
    except ValueError as e:
        r = _fallo("error_datos", str(e))
    else:
        r = await enviar(cfg["service_base_url"], cfg["api_key"], documento, f"venta-{venta['id']}", transport)
    if r["sifen_estado"] != "aprobado":
        log.warning("Factura electrónica de la venta %s quedó %s: %s", sale_id, r["sifen_estado"], r["error"])
    await _guardar(db, sale_id, r, cfg["timbrado"])
    return r


async def reintentar_pendientes(db: AsyncSession, transport=None, horas: int = 72) -> dict:
    """Tarea periódica: reintenta lo que quedó pendiente o sin enviar (SIFEN solo acepta
    hasta 72 h después de la firma)."""
    filas = (await db.execute(text(
        "SELECT s.id, s.company_id, s.cdc, s.sifen_estado FROM sales s "
        "JOIN intelifact_configs c ON c.company_id = s.company_id AND c.enabled "
        "WHERE s.sifen_estado IN ('pendiente', 'error_envio') AND s.fecha > :desde ORDER BY s.fecha LIMIT 200"),
        {"desde": datetime.now(timezone.utc) - timedelta(hours=horas)})).mappings().all()
    resumen = {"revisadas": len(filas), "aprobadas": 0, "siguen": 0}
    for f in filas:
        try:
            if f["sifen_estado"] == "pendiente" and f["cdc"]:
                cfg = await config_activa(db, f["company_id"])
                if not cfg:
                    continue
                r = await reintentar(cfg["service_base_url"], cfg["api_key"], f["cdc"], transport)
                await _guardar(db, f["id"], r, cfg["timbrado"])
            else:
                r = await emitir_venta(db, f["id"], transport)
        except Exception:
            log.exception("Reintento de factura electrónica falló para la venta %s", f["id"])
            await db.rollback()
            resumen["siguen"] += 1
            continue
        resumen["aprobadas" if r["sifen_estado"] == "aprobado" else "siguen"] += 1
    return resumen
