"""
Servicio de Perfilado de Clientes con IA Local (Qwen 2.5 en Ollama)
InteliMarket — Extra Supermercado
"""

import os
import json
import logging
import httpx
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select

from api.src.config import settings
from api.src.customers.models import Customer

logger = logging.getLogger("qwen_customer360")

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://100.72.38.119:11434")
OLLAMA_MODEL = getattr(settings, "ollama_model", "qwen2.5:7b") or "qwen2.5:7b"


async def get_customer_consumption_vector(db: AsyncSession, customer: Customer) -> Dict[str, Any]:
    """Extrae el vector de consumo real del cliente usando ventas directas y tickets legacy de cupones."""
    cid_str = str(customer.id)
    clean_doc = "".join([c for c in str(customer.ci or customer.ruc or "") if c.isdigit()])

    # 1. Ventas directas
    direct_stats_q = await db.execute(text("""
        SELECT 
            COUNT(s.id) as total_tickets,
            COALESCE(SUM(s.total), 0) as total_gastado,
            MIN(COALESCE(s.fecha, s.created_at)) as primera_compra,
            MAX(COALESCE(s.fecha, s.created_at)) as ultima_compra
        FROM sales s
        WHERE s.customer_id = :cid AND s.estado = 'confirmado'
    """), {"cid": cid_str})
    direct_row = direct_stats_q.fetchone()

    total_tickets = int(direct_row.total_tickets or 0)
    total_gastado = float(direct_row.total_gastado or 0)
    primera_compra = direct_row.primera_compra
    ultima_compra = direct_row.ultima_compra

    # 2. Si no tiene ventas directas o queremos enriquecer con tickets legacy vinculados a cupones
    if clean_doc:
        legacy_stats_q = await db.execute(text("""
            SELECT 
                COUNT(ct.id) as total_tickets,
                COALESCE(SUM(ct.monto_compra), 0) as total_gastado,
                MIN(COALESCE(ct.fecha_compra, ct.created_at)) as primera_compra,
                MAX(COALESCE(ct.fecha_compra, ct.created_at)) as ultima_compra
            FROM cupon_tickets ct
            JOIN cupones_clientes cc ON ct.cliente_id = cc.id
            WHERE cc.documento = :doc
        """), {"doc": clean_doc})
        legacy_row = legacy_stats_q.fetchone()
        if legacy_row and legacy_row.total_tickets:
            total_tickets += int(legacy_row.total_tickets or 0)
            total_gastado += float(legacy_row.total_gastado or 0)
            if not primera_compra or (legacy_row.primera_compra and legacy_row.primera_compra < primera_compra):
                primera_compra = legacy_row.primera_compra
            if not ultima_compra or (legacy_row.ultima_compra and legacy_row.ultima_compra > ultima_compra):
                ultima_compra = legacy_row.ultima_compra

    ticket_promedio = round(total_gastado / max(1, total_tickets))
    dias_sin_compra = 999
    if ultima_compra:
        now = datetime.now(timezone.utc)
        lp = ultima_compra if ultima_compra.tzinfo else ultima_compra.replace(tzinfo=timezone.utc)
        dias_sin_compra = max(0, (now - lp).days)

    # 3. Productos más comprados (sale_items directo o vía tickets legacy)
    top_products_q = await db.execute(text("""
        WITH customer_sales AS (
            SELECT id FROM sales WHERE customer_id = :cid AND estado = 'confirmado'
            UNION
            SELECT s.id 
            FROM cupon_tickets ct
            JOIN cupones_clientes cc ON ct.cliente_id = cc.id
            JOIN sales s ON s.numero = ct.nro_ticket
            WHERE cc.documento = :doc AND s.estado = 'confirmado'
        )
        SELECT 
            si.product_id,
            COALESCE(p.nombre, 'Producto Desconocido') as producto,
            COALESCE(cat.nombre, 'General') as categoria,
            COALESCE(p.ultimo_costo, p.costo_promedio, 0) as costo,
            COALESCE(p.precio_venta, 0) as precio_normal,
            COUNT(DISTINCT si.sale_id) as veces,
            SUM(si.cantidad) as cantidad,
            SUM(si.total) as monto_total
        FROM customer_sales cs
        JOIN sale_items si ON si.sale_id = cs.id
        LEFT JOIN products p ON si.product_id = p.id
        LEFT JOIN product_categories cat ON p.categoria_id = cat.id
        GROUP BY si.product_id, p.nombre, cat.nombre, p.ultimo_costo, p.costo_promedio, p.precio_venta
        ORDER BY veces DESC, monto_total DESC
        LIMIT 6
    """), {"cid": cid_str, "doc": clean_doc or "NONE"})
    
    top_products = [
        {
            "product_id": str(r.product_id),
            "producto": r.producto,
            "categoria": r.categoria,
            "costo": float(r.costo or 0),
            "precio_normal": float(r.precio_normal or 0),
            "veces": int(r.veces or 0),
            "monto_total": float(r.monto_total or 0),
        }
        for r in top_products_q.fetchall()
    ]

    idioma = getattr(customer, "idioma", "es") or ("pt" if customer.telefono and customer.telefono.startswith("+55") else "es")

    return {
        "cliente_nombre": customer.razon_social,
        "ci_ruc": customer.ci or customer.ruc,
        "telefono": customer.telefono,
        "idioma": idioma,
        "total_tickets": total_tickets,
        "total_gastado": total_gastado,
        "ticket_promedio": ticket_promedio,
        "dias_sin_compra": dias_sin_compra,
        "top_productos": top_products,
        "es_socio_club": bool(customer.extra_club_numero),
    }


async def profile_customer_with_qwen(db: AsyncSession, customer_id: str) -> Dict[str, Any]:
    """Ejecuta el perfilado de un cliente invocando el modelo local Qwen 2.5 en Ollama."""
    import uuid
    cid = uuid.UUID(customer_id) if isinstance(customer_id, str) else customer_id
    
    res = await db.execute(select(Customer).where(Customer.id == cid))
    customer = res.scalar_one_or_none()
    if not customer:
        raise ValueError("Cliente no encontrado para perfilado")

    vector = await get_customer_consumption_vector(db, customer)
    idioma = vector["idioma"]

    # Construir prompt especializado para Retail de Supermercado
    system_prompt = (
        "Eres el Director de Inteligencia de Clientes y Fidelización de Extra Supermercado, un gran supermercado en la frontera Pedro Juan Caballero (Paraguay) y Ponta Porã (Brasil).\n"
        "Tu misión es analizar el vector de compras de un cliente y generar un perfil conductual fresco, moderno y certero, descartando arquetipos genéricos antiguos.\n"
        "Debes responder ÚNICAMENTE un objeto JSON bien formado sin texto adicional ni bloques de markdown."
    )

    productos_str = "\n".join([
        f"- {p['producto']} (Categoría: {p['categoria']}, Comprado {p['veces']} veces, Total: Gs. {p['monto_total']:,.0f})"
        for p in vector["top_productos"]
    ]) or "Sin historial de productos detallado aún (compras generales)."

    lang_instr = (
        "El cliente es de BRASIL. Redacta la 'esencia', los 'tags' y el 'gancho_mensaje' en PORTUGUÊS (Brasil)."
        if idioma == "pt" else
        "El cliente es de PARAGUAY. Redacta la 'esencia', los 'tags' y el 'gancho_mensaje' en ESPAÑOL."
    )

    user_prompt = f"""
DATOS DEL CLIENTE:
- Nombre: {vector['cliente_nombre']}
- Documento: {vector['ci_ruc']}
- Idioma de Comunicación: {'Portugués (Brasil)' if idioma == 'pt' else 'Español (Paraguay)'}
- Total Compras Registradas: {vector['total_tickets']}
- Total Gastado: Gs. {vector['total_gastado']:,.0f}
- Ticket Promedio: Gs. {vector['ticket_promedio']:,.0f}
- Días desde su última compra: {vector['dias_sin_compra']} días
- ¿Socio ExtraClub?: {'Sí' if vector['es_socio_club'] else 'No'}

TOP PRODUCTOS COMPRADOS:
{productos_str}

INSTRUCCIONES DE FORMATO JSON:
{lang_instr}
Genera un JSON con esta estructura exacta:
{{
  "arquetipo": "Título de arquetipo único e intuitivo (ej: 'Comprador Familiar Gourmet', 'Abastecedor Mayorista de Frontera', 'Cazador de Ofertas Frescos', 'Cliente Bimonetario Fronterizo', 'Comprador Express de Al Paso')",
  "tags": ["3 a 5 tags concisos en minúsculas con guiones bajos, ej: 'frecuente_finde', 'amante_carnes', 'sensible_precio', 'bimonetario_reales', 'ticket_alto'"],
  "esencia": "2 a 3 frases fluidas describiendo quién es, qué valora en Extra Supermercado y cuál es su motivación de compra.",
  "categorias_gancho": ["2 a 3 nombres de categorías que más le interesan"],
  "producto_sugerido_promo": "Nombre exacto del producto ideal para ofrecerle un descuento especial de recuperación 'Te Extrañamos'",
  "gancho_mensaje": "Texto de mensaje cálido y convincente para WhatsApp, mencionando que pensamos en él/ella y que le tenemos un precio especial exclusivo en su producto preferido directamente en caja al dar su cédula."
}}
"""

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": f"{system_prompt}\n\n{user_prompt}",
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.3,
            "top_p": 0.9,
        }
    }

    ai_result = {}
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(f"{OLLAMA_URL}/api/generate", json=payload)
            if resp.status_code == 200:
                raw_json = resp.json().get("response", "{}")
                ai_result = json.loads(raw_json)
            else:
                logger.warning(f"Ollama respondió con código {resp.status_code}: {resp.text}")
    except Exception as e:
        logger.error(f"Error llamando a Ollama ({OLLAMA_MODEL}): {e}")

    # Fallback inteligente si Ollama no estuviese disponible momentáneamente
    if not ai_result or "arquetipo" not in ai_result:
        is_pt = idioma == "pt"
        fav_prod_name = vector["top_productos"][0]["producto"] if vector["top_productos"] else ("produtos favoritos" if is_pt else "productos favoritos")
        if vector["dias_sin_compra"] > 45:
            default_arquetipo = "Cliente em Risco de Fuga" if is_pt else "Cliente en Riesgo de Fuga"
            default_tags = ["inactivo_recuperable", "sensible_precio", "potencial_retencion"]
        elif vector["total_gastado"] >= 3000000:
            default_arquetipo = "Cliente VIP Alto Consumo" if is_pt else "Cliente VIP Alto Consumo"
            default_tags = ["alto_ticket", "frecuente", "prioridad_atencion"]
        else:
            default_arquetipo = "Consumidor Habitual de Fronteira" if is_pt else "Consumidor Habitual de Frontera"
            default_tags = ["consumo_regular", "compra_diaria"]

        ai_result = {
            "arquetipo": default_arquetipo,
            "tags": default_tags,
            "esencia": (
                f"Cliente com histórico de {vector['total_tickets']} compras no Extra Supermercado. Preferência destacada em {fav_prod_name}."
                if is_pt else
                f"Cliente con historial de {vector['total_tickets']} compras en Extra Supermercado. Preferencia destacada en {fav_prod_name}."
            ),
            "categorias_gancho": [p["categoria"] for p in vector["top_productos"][:2]] or ["Almacén"],
            "producto_sugerido_promo": fav_prod_name,
            "gancho_mensaje": (
                f"Olá {vector['cliente_nombre'].split()[0]}! No Extra Supermercado estamos com saudades. Preparamos uma oferta irresistível no seu produto preferido {fav_prod_name}. Passe no caixa e informe seu documento!"
                if is_pt else
                f"¡Hola {vector['cliente_nombre'].split()[0]}! En Extra Supermercado te extrañamos. Te preparamos un descuento especial en tu producto preferido {fav_prod_name}. ¡Pedilo en caja con tu cédula!"
            )
        }

    # Guardar en base de datos
    customer.arquetipo = ai_result.get("arquetipo")
    customer.tags = ai_result.get("tags", [])
    
    analysis_blob = {
        "fecha_analisis": datetime.now(timezone.utc).isoformat(),
        "modelo": OLLAMA_MODEL,
        "vector_origen": {
            "total_tickets": vector["total_tickets"],
            "total_gastado": vector["total_gastado"],
            "ticket_promedio": vector["ticket_promedio"],
            "dias_sin_compra": vector["dias_sin_compra"],
        },
        "esencia": ai_result.get("esencia"),
        "categorias_gancho": ai_result.get("categorias_gancho", []),
        "producto_sugerido_promo": ai_result.get("producto_sugerido_promo"),
        "gancho_mensaje": ai_result.get("gancho_mensaje"),
    }
    customer.ia_analisis = analysis_blob

    await db.commit()
    await db.refresh(customer)

    return {
        "customer_id": str(customer.id),
        "razon_social": customer.razon_social,
        "arquetipo": customer.arquetipo,
        "tags": customer.tags,
        "ia_analisis": customer.ia_analisis,
        "vector": vector,
    }
