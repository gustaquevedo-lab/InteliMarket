"""Catalogo de integraciones: describe cada proveedor UNA vez (campos, ambientes,
valores por defecto, como probarlo). La consola arma sus formularios a partir
de esto, asi sumar un proveedor o un tenant nuevo es cargar codigos, no
programar pantallas.
"""
import asyncio
import ipaddress
import time
from dataclasses import dataclass, field
from urllib.parse import urlparse

from sqlalchemy import text


@dataclass
class Field_:
    key: str
    label: str
    kind: str = "text"          # text | url | secret
    required: bool = False
    hint: str = ""


@dataclass
class Provider:
    id: str
    label: str
    group: str
    description: str
    fields: list[Field_] = field(default_factory=list)
    environments: tuple = ("sandbox", "production")
    defaults: dict = field(default_factory=dict)      # por ambiente: valores que no son secretos
    terminals_port: int | None = None                  # si es un terminal fisico: puerto TCP a probar
    check_label: str = "Probar conexión"
    check_warning: str | None = None


PROVIDERS: dict[str, Provider] = {p.id: p for p in [
    Provider(
        id="bancard_qr", label="Bancard QR", group="Cobro con QR en pantalla",
        description="La caja pide un QR a Bancard y lo muestra en pantalla; Bancard avisa el pago llamando a nuestro callback.",
        fields=[
            Field_("base_url", "URL de la API de Bancard", "url", True, "Sandbox: desa.infonet.com.py · Producción: comercios.bancard.com.py"),
            Field_("commerce_code", "Código de comercio", "text", True),
            Field_("branch_code", "Código de sucursal", "text", True),
            Field_("public_key", "Clave pública", "text", True, "Se envía con el prefijo apps/ automáticamente."),
            Field_("private_key", "Clave privada", "secret", True),
            Field_("callback_url", "URL de callback (la que llama Bancard)", "url", False, "Debe ser HTTPS público."),
            Field_("callback_user", "Usuario del callback", "text", False),
            Field_("callback_password", "Contraseña del callback", "secret", False),
        ],
        defaults={
            "sandbox": {"base_url": "https://desa.infonet.com.py:8035/external-commerce/api/0.1"},
            "production": {"base_url": "https://comercios.bancard.com.py/external-commerce/api/0.1"},
        },
        check_label="Generar y cancelar un QR de prueba",
        check_warning="Genera un QR real de Gs. 1.000 contra Bancard y lo cancela enseguida. No cobra nada.",
    ),
    Provider(
        id="plugpay", label="PlugPay (PIX Brasil)", group="Cobro PIX / tarjeta Brasil",
        description="Cobro de clientes brasileños por PIX. El ambiente decide la URL de PlugPay.",
        fields=[
            Field_("client_id", "Client ID", "text", True),
            Field_("password", "Contraseña", "secret", True),
            Field_("document_merchant", "Documento del comercio (RUC/CNPJ)", "text", True),
        ],
        check_label="Verificar sesión",
        check_warning="Usa el token guardado; solo inicia sesión si venció (PlugPay limita a 10 logins cada 15 min).",
    ),
    Provider(
        id="bancard", label="Bancard POS (terminal Android)", group="Terminales físicos",
        description="Terminal Bancard conectado por red a cada caja. Las IPs se administran en 'Cajas y terminales'.",
        fields=[], terminals_port=3000, check_label="Probar terminales",
        check_warning="Abre una conexión corta con cada terminal Bancard configurado.",
    ),
    Provider(
        id="dinelco", label="Dinelco POS (terminal Ingenico)", group="Terminales físicos",
        description="Terminal Dinelco conectado por red a cada caja. Las IPs se administran en 'Cajas y terminales'.",
        fields=[], terminals_port=9600, check_label="Probar terminales",
        check_warning="No pruebes durante una venta: el terminal Dinelco atiende una sola conexión a la vez.",
    ),
]}


def spec_public(p: Provider) -> dict:
    return {
        "id": p.id, "label": p.label, "group": p.group, "description": p.description,
        "environments": list(p.environments), "defaults": p.defaults, "terminals": p.terminals_port is not None,
        "terminals_port": p.terminals_port, "check_label": p.check_label, "check_warning": p.check_warning,
        "fields": [{"key": f.key, "label": f.label, "kind": f.kind, "required": f.required, "hint": f.hint} for f in p.fields],
    }


# ── validaciones ─────────────────────────────────────────────────────────────

SANDBOX_HOSTS = ("desa.infonet.com.py", "apisandbox.plugpayapi.com")
PROD_HOSTS = ("comercios.bancard.com.py", "api.plugpayapi.com")


def validate_config(p: Provider, environment: str, values: dict, enabled: bool, existing: dict) -> list[str]:
    """Devuelve errores en castellano; lista vacia = valido."""
    errs = []
    if environment not in p.environments:
        errs.append(f"Ambiente inválido: {environment}")
    known = {f.key: f for f in p.fields}
    for k in values:
        if k not in known:
            errs.append(f"Campo desconocido: {k}")
    merged = {**existing, **{k: v for k, v in values.items() if v not in (None, "")}}
    if enabled:
        for f in p.fields:
            if f.required and not merged.get(f.key):
                errs.append(f"Falta: {f.label}")
    for f in p.fields:
        v = merged.get(f.key)
        if f.kind == "url" and v:
            if not str(v).startswith("https://"):
                errs.append(f"{f.label}: tiene que empezar con https://")
            # nunca mezclar ambientes: es el error que mas caro sale
            host = (urlparse(str(v)).hostname or "").lower()
            if environment == "production" and host in SANDBOX_HOSTS:
                errs.append(f"{f.label}: apunta a un servidor de PRUEBAS pero el ambiente es Producción")
            if environment == "sandbox" and host in PROD_HOSTS:
                errs.append(f"{f.label}: apunta a un servidor de PRODUCCIÓN pero el ambiente es Sandbox")
    if environment == "production":
        for f in p.fields:
            v = merged.get(f.key)
            if f.kind == "url" and v and p.defaults.get("production", {}).get(f.key):
                esperado = urlparse(p.defaults["production"][f.key]).hostname
                if (urlparse(str(v)).hostname or "").lower() != esperado and f.key == "base_url":
                    errs.append(f"{f.label}: en Producción tiene que apuntar a {esperado}")
    return errs


# ── pruebas de conexion ──────────────────────────────────────────────────────

def private_ip(ip: str | None) -> bool:
    try:
        return bool(ip) and ipaddress.ip_address(ip).is_private
    except ValueError:
        return False


async def tcp_probe(ip: str, port: int, timeout: float = 2.5, greet: bool = False) -> dict:
    """Conecta y cierra. Solo IPs privadas (la consola nunca debe servir de puente hacia internet)."""
    if not private_ip(ip):
        return {"ok": False, "error": "IP no privada"}
    t0 = time.perf_counter()
    try:
        r, w = await asyncio.wait_for(asyncio.open_connection(ip, port), timeout)
        saludo = None
        if greet:
            try:
                saludo = (await asyncio.wait_for(r.read(64), 0.8)).decode(errors="ignore").strip()
            except Exception:  # noqa: BLE001
                saludo = None
        w.close()
        try:
            await w.wait_closed()
        except Exception:  # noqa: BLE001
            pass
        return {"ok": True, "ms": int((time.perf_counter() - t0) * 1000), "greeting": saludo}
    except asyncio.TimeoutError:
        return {"ok": False, "error": "sin respuesta (timeout)"}
    except OSError as e:
        return {"ok": False, "error": e.strerror or type(e).__name__}


async def run_check(provider: Provider, db, company_id: str) -> dict:
    t0 = time.perf_counter()
    ms = lambda: int((time.perf_counter() - t0) * 1000)  # noqa: E731
    try:
        if provider.id == "bancard_qr":
            from api.src.bancard_qr import service as qr
            txn = await qr.generate_qr(db, company_id, 1000, "Prueba de conexión desde la consola (se cancela)", None, None)
            try:
                await qr.revert_qr(db, company_id, txn.hook_alias)
            except Exception as e:  # noqa: BLE001
                return {"ok": False, "latency_ms": ms(), "detail": f"Generó el QR {txn.hook_alias} pero no pudo cancelarlo: {e}"}
            return {"ok": True, "latency_ms": ms(), "detail": f"Generó y canceló el QR de prueba {txn.hook_alias}."}

        if provider.id == "plugpay":
            from api.src.plugpay import service as pp
            _, row = await pp.get_valid_token(db, company_id)
            exp = (row.config or {}).get("cached_token_expires_at")
            hasta = f" (el token vence {exp[:16].replace('T', ' ')} UTC)" if exp else ""
            return {"ok": True, "latency_ms": ms(), "detail": f"Sesión con PlugPay activa{hasta}."}

        if provider.terminals_port:
            rows = (await db.execute(text(
                "SELECT a.caja_nombre, a.punto_emision, a.ip_pos_bancard, a.ip_pos_dinelco, "
                "(EXISTS (SELECT 1 FROM pos_terminal_transactions t WHERE t.company_id = a.company_id AND t.punto_emision LIKE '%' || a.punto_emision "
                "AND t.created_at > now() - interval '14 days') OR EXISTS (SELECT 1 FROM mon_heartbeats h WHERE upper(h.hostname) = upper(a.hostname) AND h.last_seen > now() - interval '14 days')) AS con_actividad "
                "FROM pos_terminal_assignments a WHERE a.company_id = :c AND a.activo ORDER BY a.punto_emision"),
                {"c": company_id})).all()
            col = 2 if provider.id == "bancard" else 3
            activos = [(r[0], r[1], r[col]) for r in rows if r[col] and r[4]]
            sin_uso = [r[0] for r in rows if r[col] and not r[4]]
            targets = activos
            if not targets:
                return {"ok": False, "latency_ms": ms(), "detail": "No hay ninguna caja con terminal configurado y actividad reciente.", "meta": {"terminales": [], "sin_uso": sin_uso}}
            res = await asyncio.gather(*[tcp_probe(ip, provider.terminals_port, greet=provider.id == "dinelco") for _, _, ip in targets])
            det = [{"caja": n, "punto": p, "ip": ip, **r} for (n, p, ip), r in zip(targets, res)]
            up = sum(1 for d in det if d["ok"])
            caidos = ", ".join(f"{d['caja']} ({d['ip']})" for d in det if not d["ok"])
            extra = f" ({len(sin_uso)} cajas sin actividad reciente no se probaron)" if sin_uso else ""
            return {"ok": up == len(det), "latency_ms": ms(), "detail": f"{up} de {len(det)} terminales responden{extra}." + (f" No responden: {caidos}." if caidos else ""),
                    "meta": {"terminales": det, "sin_uso": sin_uso}}
    except Exception as e:  # noqa: BLE001
        msg = getattr(e, "message", None) or str(e)
        return {"ok": False, "latency_ms": ms(), "detail": msg[:400]}
    return {"ok": False, "detail": "Este proveedor no tiene prueba automática."}
