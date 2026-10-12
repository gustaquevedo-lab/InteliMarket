"""Scale bridge service — factory + operations"""

import logging
from decimal import Decimal
from zoneinfo import ZoneInfo
from typing import Optional
from datetime import datetime

from sqlalchemy import select, delete, text, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.integrations.scales.models import (
    ScaleConfig, ScaleWeightLog, ScalePLUSync, ScaleLabelTemplate,
    ScaleBrand, ScaleProtocol, ConnectionType,
)
from api.src.integrations.scales.schemas import (
    ScaleConfigCreate, ScaleConfigUpdate, PrintLabelInput,
    WeightReadResult, ConnectionTestResult, ProtocolDetectResult,
    WeighProductResult,
)
from api.src.integrations.scales.drivers.base import PLUResult, LabelData, ScaleConfig as DriverCfg
from api.src.integrations.scales.drivers import DRIVER_REGISTRY
from api.src.products.models import Product

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# DRIVER FACTORY
# ═══════════════════════════════════════════════════════════════

def _build_driver_config(db_config: ScaleConfig) -> DriverCfg:
    return DriverCfg(
        host=db_config.host,
        puerto_tcp=db_config.puerto_tcp or 9000,
        puerto_com=db_config.puerto_com,
        baudrate=db_config.baudrate or 9600,
        data_bits=db_config.data_bits or 8,
        paridad=db_config.paridad or "N",
        stop_bits=db_config.stop_bits or "1",
        timeout=db_config.timeout_segundos or 5,
        vendor_id=db_config.vendor_id,
        product_id=db_config.product_id,
        ruta_carga=db_config.ruta_carga,
        etiqueta_formato=db_config.etiqueta_formato or "40x30",
    )


def get_driver(db_config: ScaleConfig):
    proto = db_config.protocolo.value if hasattr(db_config.protocolo, "value") else str(db_config.protocolo)
    driver_cls = DRIVER_REGISTRY.get(proto)
    if not driver_cls:
        raise ValueError(f"Unsupported protocol: {proto}. Available: {list(DRIVER_REGISTRY.keys())}")
    return driver_cls(_build_driver_config(db_config))


# ═══════════════════════════════════════════════════════════════
# SCALE CONFIG CRUD
# ═══════════════════════════════════════════════════════════════

async def list_scales(db: AsyncSession, company_id: str) -> list[ScaleConfig]:
    r = await db.execute(
        select(ScaleConfig).where(ScaleConfig.company_id == company_id).order_by(ScaleConfig.nombre)
    )
    return list(r.scalars().all())


async def get_scale(db: AsyncSession, scale_id: str) -> Optional[ScaleConfig]:
    r = await db.execute(select(ScaleConfig).where(ScaleConfig.id == scale_id))
    return r.scalar_one_or_none()


async def create_scale(db: AsyncSession, company_id: str, data: ScaleConfigCreate) -> ScaleConfig:
    s = ScaleConfig(
        company_id=company_id,
        nombre=data.nombre,
        marca=ScaleBrand(data.marca).value,
        modelo=data.modelo,
        protocolo=ScaleProtocol(data.protocolo).value,
        conexion=ConnectionType(data.conexion).value,
        puerto_com=data.puerto_com,
        baudrate=data.baudrate,
        data_bits=data.data_bits,
        paridad=data.paridad,
        stop_bits=data.stop_bits,
        host=data.host,
        puerto_tcp=data.puerto_tcp,
        timeout_segundos=data.timeout_segundos,
        vendor_id=data.vendor_id,
        product_id=data.product_id,
        ruta_carga=data.ruta_carga,
        sync_automatico=data.sync_automatico,
        categorias_ids=data.categorias_ids,
        etiqueta_formato=data.etiqueta_formato,
        etiqueta_cabecera=data.etiqueta_cabecera,
        activa=data.activa,
    )
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return s


async def update_scale(db: AsyncSession, scale_id: str, data: ScaleConfigUpdate) -> Optional[ScaleConfig]:
    s = await get_scale(db, scale_id)
    if not s:
        return None
    for field, val in data.model_dump(exclude_unset=True).items():
        if val is not None:
            if field == "marca":
                setattr(s, field, ScaleBrand(val).value)
            elif field == "protocolo":
                setattr(s, field, ScaleProtocol(val).value)
            elif field == "conexion":
                setattr(s, field, ConnectionType(val).value)
            else:
                setattr(s, field, val)
    await db.commit()
    await db.refresh(s)
    return s


async def delete_scale(db: AsyncSession, scale_id: str) -> bool:
    s = await get_scale(db, scale_id)
    if not s:
        return False
    await db.delete(s)
    await db.commit()
    return True


# ═══════════════════════════════════════════════════════════════
# WEIGHT OPERATIONS
# ═══════════════════════════════════════════════════════════════

async def read_weight(db: AsyncSession, company_id: str, scale_id: str) -> WeightReadResult:
    s = await get_scale(db, scale_id)
    if not s or s.company_id != company_id:
        raise ValueError("Scale not found")
    driver = get_driver(s)
    w = await driver.read_weight()
    log = ScaleWeightLog(
        company_id=company_id,
        scale_id=s.id,
        peso_bruto=w.peso_bruto,
        peso_neto=w.peso_neto or w.peso_bruto,
        tara=w.tara,
        unidad=w.unidad,
        estable=w.estable,
    )
    db.add(log)
    await db.commit()
    return WeightReadResult(
        scale_id=str(s.id),
        scale_nombre=s.nombre,
        protocolo=s.protocolo.value if hasattr(s.protocolo, "value") else str(s.protocolo),
        peso_bruto=w.peso_bruto,
        peso_neto=w.peso_neto,
        tara=w.tara,
        unidad=w.unidad,
        estable=w.estable,
        raw_response=w.raw_response,
        timestamp=datetime.utcnow().isoformat(),
    )


async def tare_scale(db: AsyncSession, company_id: str, scale_id: str) -> dict:
    s = await get_scale(db, scale_id)
    if not s or s.company_id != company_id:
        raise ValueError("Scale not found")
    driver = get_driver(s)
    tara_val = await driver.tare()
    return {"scale_id": str(s.id), "tara": tara_val or Decimal("0")}


async def zero_scale(db: AsyncSession, company_id: str, scale_id: str) -> dict:
    s = await get_scale(db, scale_id)
    if not s or s.company_id != company_id:
        raise ValueError("Scale not found")
    driver = get_driver(s)
    ok = await driver.zero()
    return {"scale_id": str(s.id), "zeroed": ok}


# ═══════════════════════════════════════════════════════════════
# WEIGH PRODUCT (POS BRIDGE)
# ═══════════════════════════════════════════════════════════════

async def weigh_product(db: AsyncSession, company_id: str, scale_id: str, producto_id: str, precio_unitario: Optional[Decimal] = None) -> WeighProductResult:
    s = await get_scale(db, scale_id)
    if not s or s.company_id != company_id:
        raise ValueError("Scale not found")

    r = await db.execute(select(Product).where(Product.id == producto_id, Product.company_id == company_id))
    p = r.scalar_one_or_none()
    if not p:
        raise ValueError("Product not found")

    driver = get_driver(s)
    w = await driver.read_weight()

    log = ScaleWeightLog(
        company_id=company_id,
        scale_id=s.id,
        producto_id=p.id,
        peso_bruto=w.peso_bruto,
        peso_neto=w.peso_neto or w.peso_bruto,
        tara=w.tara,
        unidad=w.unidad,
        estable=w.estable,
        origen="checkout",
    )
    db.add(log)
    await db.commit()

    peso = w.peso_neto or w.peso_bruto
    if precio_unitario is None:
        precio_unitario = getattr(p, "precio_venta", None) or Decimal("0")
    subtotal = (peso * precio_unitario).quantize(Decimal("0"))

    return WeighProductResult(
        escala_id=str(s.id),
        escala_nombre=s.nombre,
        peso_kg=peso,
        unidad=w.unidad,
        estable=w.estable,
        producto_id=str(p.id),
        producto_nombre=p.nombre,
        precio_unitario=precio_unitario,
        subtotal=subtotal,
    )


# ═══════════════════════════════════════════════════════════════
# CONNECTION TEST
# ═══════════════════════════════════════════════════════════════

async def test_connection(db: AsyncSession, company_id: str, scale_id: str) -> ConnectionTestResult:
    s = await get_scale(db, scale_id)
    if not s or s.company_id != company_id:
        raise ValueError("Scale not found")
    driver = get_driver(s)
    status = await driver.test_connection()
    return ConnectionTestResult(
        scale_id=str(s.id),
        scale_nombre=s.nombre,
        conectada=status.conectada,
        protocolo_detectado=status.protocolo_detectado or s.protocolo.value if hasattr(s.protocolo, "value") else str(s.protocolo),
        mensaje=status.mensaje,
        latencia_ms=status.latencia_ms,
        peso_actual=status.peso_actual,
    )


async def detect_protocol(data) -> ProtocolDetectResult:
    """Auto-detect scale protocol by trying each driver."""
    results = []
    detected = None
    last_peso = None
    connected = False

    for proto_name, driver_cls in DRIVER_REGISTRY.items():
        cfg = DriverCfg(
            host=data.host,
            puerto_tcp=data.puerto_tcp or 9000,
            puerto_com=data.puerto_com,
            baudrate=data.baudrate or 9600,
            timeout=data.timeout or 3,
        )
        try:
            d = driver_cls(cfg)
            status = await d.test_connection()
            results.append({
                "protocolo": proto_name,
                "conectada": status.conectada,
                "mensaje": status.mensaje,
                "latencia_ms": status.latencia_ms,
                "peso": float(status.peso_actual) if status.peso_actual else None,
            })
            if status.conectada and not detected:
                detected = proto_name
                last_peso = status.peso_actual
                connected = True
            await d.disconnect()
        except Exception as e:
            results.append({
                "protocolo": proto_name,
                "conectada": False,
                "mensaje": str(e)[:100],
            })

    return ProtocolDetectResult(
        protocolos_probados=results,
        protocolo_detectado=detected,
        conectada=connected,
        peso_leido=last_peso,
    )


# ═══════════════════════════════════════════════════════════════
# PLU SYNC
# ═══════════════════════════════════════════════════════════════

# Promos que se pueden expresar como precio unitario por kg en la etiqueta/visor de la
# balanza. Las de cantidad (2x1, 3x2, nxm, segunda unidad, combos) dependen del carrito
# y no tienen un "precio por kg" -- esas solo las aplica la caja.
TIPOS_PROMO_PRECIO_UNITARIO = ("precio_fijo_oferta", "porcentaje", "monto_fijo")
PY_TZ = ZoneInfo("America/Asuncion")


async def calcular_precios_balanza(db: AsyncSession, company_id, productos: list[Product]) -> dict:
    """Precio que debe mostrar la balanza AHORA para cada producto: el mismo que cobra la caja
    (motor de precio dual de promociones), no solo `products.precio_venta`.

    `precio_venta` solo refleja las promos `precio_fijo_oferta` (las aplica el trigger SQL
    trg_sync_promo_precio_fijo); las de porcentaje / monto fijo y los precios por producto
    se calculan al vuelo en caja y la balanza nunca se enteraba. Se evalua con la hora de
    Paraguay a proposito: los crons corren en UTC y sin esto los dias/horarios quedarian
    corridos."""
    from api.src.promotions.models import Promotion
    from api.src.promotions.service import resolve_product_promotions

    ahora = datetime.now(PY_TZ).replace(tzinfo=None)
    r = await db.execute(select(Promotion).where(
        Promotion.company_id == company_id,
        Promotion.activo == True,  # noqa: E712
        Promotion.estado == "activa",
        Promotion.tipo.in_(TIPOS_PROMO_PRECIO_UNITARIO),
        Promotion.valido_desde <= ahora.date(),
        Promotion.valido_hasta >= ahora.date(),
    ))
    promos = list(r.scalars().all())
    ids_validos = {str(pr.id) for pr in promos}
    pids, cids = set(), set()
    for pr in promos:
        pids.update(pr.producto_ids or [])
        cids.update(pr.categoria_ids or [])

    precios = {}
    for p in productos:
        base = Decimal(str(p.precio_venta or 0))
        precios[p.id] = base
        if base <= 0 or not (p.id in pids or (p.categoria_id and p.categoria_id in cids)):
            continue
        dual = await resolve_product_promotions(db, str(company_id), str(p.id), float(base), current_dt=ahora)
        if dual.en_promocion and dual.promocion_id in ids_validos and dual.precio_promocional > 0:
            precios[p.id] = Decimal(str(dual.precio_promocional))
    return precios


def _product_to_plu_dict(p: Product, precio: Optional[Decimal] = None) -> dict:
    precio_final = float(precio if precio is not None else (p.precio_venta or 0))
    return {
        "id": str(p.id),
        "codigo": p.sku or str(p.id)[:20],
        "sku": p.sku,
        "nombre": p.nombre,
        "precio": precio_final,
        "precio_venta": precio_final,
        "codigo_barras": p.codigo_barra,
        "plu_balanza": p.plu_balanza,
        "tara": 0,
    }


async def registrar_estado_balanza(db: AsyncSession, scale_id, plu_list: list[dict]) -> None:
    """Deja asentado lo ultimo transmitido por PLU, para que el reconciliador
    (scripts/reconcile_balanzas.py) sepa que ya esta enviado y no lo repita."""
    for d in plu_list:
        if not d.get("plu_balanza") or (d.get("precio_venta") or 0) <= 0:
            continue
        await db.execute(text("""
            INSERT INTO scale_plu_state (scale_id, plu, product_id, precio, nombre, pushed_at)
            VALUES (:s, :plu, :pid, :precio, :nombre, NOW())
            ON CONFLICT (scale_id, plu) DO UPDATE SET product_id = :pid, precio = :precio,
                nombre = :nombre, pushed_at = NOW()"""),
            {"s": str(scale_id), "plu": int(d["plu_balanza"]), "pid": d["id"],
             "precio": Decimal(str(d["precio_venta"])).quantize(Decimal("0.01")), "nombre": d["nombre"]})


async def _run_plu_sync(db: AsyncSession, s: ScaleConfig, productos: list[Product], modo: str) -> dict:
    precios = await calcular_precios_balanza(db, s.company_id, [p for p in productos if p.plu_balanza])
    plu_list = [_product_to_plu_dict(p, precios.get(p.id)) for p in productos]

    driver = get_driver(s)
    result = await driver.sync_plu(plu_list)

    if result.exitosos:
        await registrar_estado_balanza(db, s.id, plu_list)

    sync_log = ScalePLUSync(
        company_id=s.company_id,
        scale_id=s.id,
        total_productos=result.total_productos,
        exitosos=result.exitosos,
        fallidos=result.fallidos,
        modo=modo,
        archivo_generado=result.archivo_generado,
        resultado={"detalle": [{"producto": p["nombre"], "estado": "ok"} for p in plu_list[:result.exitosos]]},
    )
    db.add(sync_log)
    await db.commit()
    await db.refresh(sync_log)

    return {
        "sync_id": str(sync_log.id),
        "scale_nombre": s.nombre,
        "total_productos": result.total_productos,
        "exitosos": result.exitosos,
        "fallidos": result.fallidos,
        "archivo_generado": result.archivo_generado,
        "errores": result.errores,
    }


async def sync_plu(db: AsyncSession, company_id: str, scale_id: str, producto_ids: list[str], modo: str = "incremental") -> dict:
    s = await get_scale(db, scale_id)
    if not s or s.company_id != company_id:
        raise ValueError("Scale not found")

    q = select(Product).where(Product.company_id == company_id)
    if producto_ids:
        q = q.where(Product.id.in_(producto_ids))
    r = await db.execute(q)
    productos = r.scalars().all()

    return await _run_plu_sync(db, s, productos, modo)


async def auto_sync_product(db: AsyncSession, company_id: str, product: Product) -> list[dict]:
    """Ya no transmite nada: de eso se ocupa el vigilante de precios (integrations/scales/watcher.py),
    que escucha los triggers de la base (products / promotions) y cubre CUALQUIER camino que cambie un
    precio, no solo los que llamaban a esta funcion. Se conserva la firma porque hay llamadores
    (edicion de producto, markdown, sync Nemuha, promos) que la invocan; transmitir desde aca abria una
    conexion por producto y por balanza y competia con el vigilante (la balanza acepta una sola sesion)."""
    return []


# ═══════════════════════════════════════════════════════════════
# ESTADO Y REGISTRO DE TRANSMISIONES (vigilante de precios)
# ═══════════════════════════════════════════════════════════════

async def get_sync_status(db: AsyncSession, company_id: str) -> list[dict]:
    """Estado de transmision por balanza: ultimo envio OK, error vigente, ultimo chequeo del vigilante, PLU cargados."""
    r = await db.execute(text("""
        SELECT sc.id::text AS scale_id, sc.nombre, sc.host, sc.puerto_tcp, sc.activa, sc.sync_automatico,
               st.last_ok_at, st.last_error, st.last_error_at, st.last_check_at,
               COALESCE(st.pendiente_completo, false) AS pendiente_completo,
               (SELECT count(*) FROM scale_plu_state ps WHERE ps.scale_id = sc.id) AS plu_cargados,
               (SELECT max(ps.pushed_at) FROM scale_plu_state ps WHERE ps.scale_id = sc.id) AS ultimo_envio_at
        FROM scale_configs sc
        LEFT JOIN scale_sync_status st ON st.scale_id = sc.id
        WHERE sc.company_id = :c AND COALESCE(sc.host, '') <> ''
        ORDER BY sc.nombre"""), {"c": str(company_id)})
    return [dict(row._mapping) for row in r.all()]


async def list_sync_log(db: AsyncSession, company_id: str, scale_id: Optional[str] = None,
                        estado: Optional[str] = None, limit: int = 50, offset: int = 0) -> list[dict]:
    r = await db.execute(text("""
        SELECT l.id, l.scale_id::text AS scale_id, sc.nombre AS scale_nombre, l.created_at, l.ultimo_intento,
               l.origen, l.tipo, l.estado, l.total, l.repeticiones, l.detalle, l.error
        FROM scale_sync_log l JOIN scale_configs sc ON sc.id = l.scale_id
        WHERE sc.company_id = :c
          AND (CAST(:sid AS text) IS NULL OR l.scale_id::text = :sid)
          AND (CAST(:est AS text) IS NULL OR l.estado = :est)
        ORDER BY l.ultimo_intento DESC, l.id DESC
        LIMIT :lim OFFSET :off"""),
        {"c": str(company_id), "sid": scale_id or None, "est": estado or None,
         "lim": max(1, min(limit, 200)), "off": max(0, offset)})
    return [dict(row._mapping) for row in r.all()]


# ═══════════════════════════════════════════════════════════════
# LABEL PRINTING
# ═══════════════════════════════════════════════════════════════

async def print_label(db: AsyncSession, company_id: str, data: PrintLabelInput) -> dict:
    s = await get_scale(db, data.scale_id)
    if not s or s.company_id != company_id:
        raise ValueError("Scale not found")

    r = await db.execute(select(Product).where(Product.id == data.producto_id, Product.company_id == company_id))
    p = r.scalar_one_or_none()
    if not p:
        raise ValueError("Product not found")

    total = (data.precio_unitario * data.peso_kg).quantize(Decimal("0"))

    label_data = LabelData(
        producto_nombre=p.nombre,
        peso_kg=data.peso_kg,
        precio_unitario=data.precio_unitario,
        precio_total=total,
        fecha_vencimiento=data.fecha_vencimiento,
        lote=data.lote,
        codigo_barras=p.codigo_barra,
        formato=s.etiqueta_formato,
    )

    driver = get_driver(s)
    printed = await driver.print_label(label_data)

    return {
        "scale_id": data.scale_id,
        "producto_nombre": p.nombre,
        "peso_kg": float(data.peso_kg),
        "precio_unitario": float(data.precio_unitario),
        "precio_total": float(total),
        "etiqueta_generada": printed,
    }


# ═══════════════════════════════════════════════════════════════
# WEIGHT LOGS
# ═══════════════════════════════════════════════════════════════

async def list_weight_logs(db: AsyncSession, company_id: str, scale_id: Optional[str] = None,
                           limit: int = 50, offset: int = 0) -> list[dict]:
    q = select(ScaleWeightLog).where(ScaleWeightLog.company_id == company_id)
    if scale_id:
        q = q.where(ScaleWeightLog.scale_id == scale_id)
    q = q.order_by(ScaleWeightLog.fecha.desc()).limit(limit).offset(offset)
    r = await db.execute(q)
    logs = r.scalars().all()
    return [
        {
            **{c.name: getattr(l, c.name) for c in l.__table__.columns},
            "scale_nombre": (await db.execute(select(ScaleConfig.nombre).where(ScaleConfig.id == l.scale_id))).scalar_one_or_none(),
        }
        for l in logs
    ]


async def list_plu_syncs(db: AsyncSession, company_id: str, scale_id: Optional[str] = None,
                         limit: int = 20, offset: int = 0) -> list[dict]:
    q = select(ScalePLUSync).where(ScalePLUSync.company_id == company_id)
    if scale_id:
        q = q.where(ScalePLUSync.scale_id == scale_id)
    q = q.order_by(ScalePLUSync.created_at.desc()).limit(limit).offset(offset)
    r = await db.execute(q)
    return [dict(**{c.name: getattr(s, c.name) for c in s.__table__.columns}) for s in r.scalars().all()]


# ═══════════════════════════════════════════════════════════════
# LABEL TEMPLATES
# ═══════════════════════════════════════════════════════════════

async def list_label_templates(db: AsyncSession, company_id: str) -> list[ScaleLabelTemplate]:
    r = await db.execute(
        select(ScaleLabelTemplate).where(ScaleLabelTemplate.company_id == company_id).order_by(ScaleLabelTemplate.nombre)
    )
    return list(r.scalars().all())


async def create_label_template(db: AsyncSession, company_id: str, data) -> ScaleLabelTemplate:
    t = ScaleLabelTemplate(
        company_id=company_id,
        nombre=data.nombre,
        ancho_mm=data.ancho_mm,
        alto_mm=data.alto_mm,
        campos=[c.model_dump() for c in data.campos],
        incluir_barcode=data.incluir_barcode,
        incluir_precio=data.incluir_precio,
        incluir_peso=data.incluir_peso,
        incluir_info_nutricional=data.incluir_info_nutricional,
        incluir_logo=data.incluir_logo,
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return t


async def delete_label_template(db: AsyncSession, template_id: str) -> bool:
    r = await db.execute(select(ScaleLabelTemplate).where(ScaleLabelTemplate.id == template_id))
    t = r.scalar_one_or_none()
    if not t:
        return False
    await db.delete(t)
    await db.commit()
    return True
