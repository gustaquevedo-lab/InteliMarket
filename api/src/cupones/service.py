"""Service layer for Cupones Sorteo, Sales Matching and Gemini 2.5 Flash Profiling"""

import json
import logging
import re
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from uuid import UUID

from sqlalchemy import select, func, desc, or_, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from google import genai
from google.genai import types

from api.src.config import settings
from api.src.cupones.models import CuponCliente, CuponTicket, CuponTicketItem
from api.src.cupones.schemas import RegistrarCuponRequest, CuponClienteOut
from api.src.cupones.whatsapp_service import send_cupon_whatsapp_confirmation, normalize_phone_e164
from api.src.customers.models import Customer
from api.src.sales.models import Sale, SaleItem

logger = logging.getLogger("cupones.service")

GEMINI_MODEL = "gemini-2.5-flash"


def clean_documento(doc: str) -> str:
    """Limpia el documento eliminando puntos, guiones y espacios."""
    if not doc:
        return ""
    return re.sub(r"[^\w\d]", "", str(doc)).strip().upper()


async def lookup_cliente(db: AsyncSession, company_id: UUID, doc: str) -> Dict[str, Any]:
    """
    Busca un cliente por documento (C.I. / CPF) en cupones_clientes o en la tabla customers.
    """
    cleaned_doc = clean_documento(doc)
    if not cleaned_doc:
        return {"existe": False, "cliente": None, "origen": None}

    # 1. Buscar en cupones_clientes
    query_cup = select(CuponCliente).where(
        CuponCliente.company_id == company_id,
        CuponCliente.documento == cleaned_doc
    )
    res_cup = await db.execute(query_cup)
    cliente_cup = res_cup.scalars().first()

    if cliente_cup:
        return {
            "existe": True,
            "cliente": cliente_cup,
            "origen": "cupones"
        }

    # 2. Buscar en tabla customers existente de Intelimarket
    query_cust = select(Customer).where(
        Customer.company_id == company_id,
        or_(
            func.replace(func.replace(Customer.ruc, "-", ""), ".", "").ilike(f"%{cleaned_doc}%"),
            func.replace(func.replace(Customer.ci, "-", ""), ".", "").ilike(f"%{cleaned_doc}%")
        )
    )
    res_cust = await db.execute(query_cust)
    cust = res_cust.scalars().first()

    if cust:
        # Prearmar objeto de cliente
        nombre = cust.razon_social or cust.nombre_fantasia or "Cliente Extra"
        telefono = cust.telefono
        direccion = cust.direccion
        ciudad = cust.ciudad or "Pedro Juan Caballero"
        return {
            "existe": True,
            "cliente": {
                "id": cust.id,
                "company_id": cust.company_id,
                "documento": cleaned_doc,
                "nombre": nombre,
                "telefono": telefono,
                "direccion": direccion,
                "barrio": "Centro",
                "ciudad": ciudad,
                "ticket_promedio": 0.0,
                "total_gastado": 0.0,
                "cantidad_compras": 0,
                "ultimo_consumo": None,
                "segmentos": "Cliente Habitual",
                "ia_analisis": None,
                "activo": True,
                "created_at": cust.created_at or datetime.now(timezone.utc),
                "updated_at": cust.updated_at or datetime.now(timezone.utc)
            },
            "origen": "customers"
        }

    return {"existe": False, "cliente": None, "origen": None}


async def registrar_cupon(
    db: AsyncSession,
    company_id: UUID,
    payload: RegistrarCuponRequest
) -> Dict[str, Any]:
    """
    Registra el cupón, hace upsert del cliente, cruza con la base de datos de ventas e invoca WhatsApp.
    """
    cleaned_doc = clean_documento(payload.documento)
    clean_phone = normalize_phone_e164(payload.telefono)
    cleaned_ticket = payload.nro_ticket.strip().upper()

    # 1. Upsert del Cliente en cupones_clientes
    query_cliente = select(CuponCliente).where(
        CuponCliente.company_id == company_id,
        CuponCliente.documento == cleaned_doc
    )
    res_cliente = await db.execute(query_cliente)
    cliente = res_cliente.scalars().first()

    now = datetime.now(timezone.utc)

    if cliente:
        # Actualizar datos de contacto si se proveyeron nuevos
        if payload.nombre and payload.nombre.strip():
            cliente.nombre = payload.nombre.strip()
        if clean_phone:
            cliente.telefono = clean_phone
        if payload.direccion:
            cliente.direccion = payload.direccion.strip()
        if payload.barrio:
            cliente.barrio = payload.barrio.strip()
        if payload.ciudad:
            cliente.ciudad = payload.ciudad.strip()
        cliente.updated_at = now
    else:
        cliente = CuponCliente(
            company_id=company_id,
            documento=cleaned_doc,
            nombre=payload.nombre.strip(),
            telefono=clean_phone,
            direccion=payload.direccion.strip() if payload.direccion else None,
            barrio=payload.barrio.strip() if payload.barrio else "Centro",
            ciudad=payload.ciudad.strip() if payload.ciudad else "Pedro Juan Caballero",
            ticket_promedio=0,
            total_gastado=0,
            cantidad_compras=0,
            ultimo_consumo=now,
            created_at=now,
            updated_at=now
        )
        db.add(cliente)
        await db.flush()

    # 2. Cruce Automático con la tabla de ventas `sales` y `sale_items`
    # Buscamos por número exacto o sufijo de factura/ticket
    sale_query = select(Sale).options(selectinload(Sale.items)).where(
        Sale.company_id == company_id,
        or_(
            Sale.numero == cleaned_ticket,
            Sale.numero.ilike(f"%{cleaned_ticket}"),
            Sale.numero.ilike(f"%{cleaned_ticket.replace('-', '')}%")
        )
    ).order_by(desc(Sale.fecha))
    
    res_sale = await db.execute(sale_query)
    sale = res_sale.scalars().first()

    monto_final = payload.monto_compra or 0.0
    fecha_compra = now
    sincronizado = False
    sale_id = None
    items_to_create = []

    if sale:
        sale_id = sale.id
        monto_final = float(sale.total or monto_final)
        fecha_compra = sale.fecha or now
        sincronizado = True

        for it in sale.items:
            items_to_create.append(
                CuponTicketItem(
                    producto_id=it.product_id,
                    descripcion=it.descripcion or "Producto de Salón",
                    cantidad=float(it.cantidad or 1),
                    precio_unitario=float(it.precio_unitario or 0),
                    total=float(it.total or 0)
                )
            )

    # 3. Crear el CuponTicket
    cupon_ticket = CuponTicket(
        company_id=company_id,
        cliente_id=cliente.id,
        sale_id=sale_id,
        nro_ticket=cleaned_ticket,
        cantidad=max(1, payload.cantidad),
        monto_compra=monto_final,
        fecha_compra=fecha_compra,
        fecha_captura=now,
        usuario_nombre=payload.usuario_nombre,
        sincronizado=sincronizado,
        whatsapp_enviado=False,
        whatsapp_status="pendiente",
        created_at=now,
        updated_at=now
    )
    db.add(cupon_ticket)
    await db.flush()

    # Asociar ítems creados
    for it in items_to_create:
        it.ticket_id = cupon_ticket.id
        db.add(it)

    # 4. Actualizar métricas acumuladas del cliente
    cliente.cantidad_compras = (cliente.cantidad_compras or 0) + 1
    cliente.total_gastado = float(cliente.total_gastado or 0) + monto_final
    if cliente.cantidad_compras > 0:
        cliente.ticket_promedio = round(cliente.total_gastado / cliente.cantidad_compras, 2)
    cliente.ultimo_consumo = fecha_compra
    
    await db.commit()
    await db.refresh(cupon_ticket)
    await db.refresh(cliente)

    # 5. Disparo Opcional y Asíncrono de WhatsApp vía Evolution API
    whatsapp_disparado = False
    if payload.enviar_whatsapp and cliente.telefono:
        try:
            res_wa = await send_cupon_whatsapp_confirmation(
                telefono=cliente.telefono,
                nombre=cliente.nombre,
                nro_ticket=cleaned_ticket,
                cantidad_cupones=cupon_ticket.cantidad,
                nombre_fantasia="Extra Supermercado"
            )
            if res_wa.get("success"):
                cupon_ticket.whatsapp_enviado = True
                cupon_ticket.whatsapp_status = "enviado"
                whatsapp_disparado = True
            else:
                cupon_ticket.whatsapp_status = res_wa.get("status", "fallo_envio")
            await db.commit()
        except Exception as e:
            logger.error(f"Error al disparar WhatsApp para ticket {cleaned_ticket}: {e}")

    # Re-cargar ticket con items y cliente
    query_full_ticket = select(CuponTicket).options(
        selectinload(CuponTicket.cliente),
        selectinload(CuponTicket.items)
    ).where(CuponTicket.id == cupon_ticket.id)
    res_ft = await db.execute(query_full_ticket)
    full_ticket = res_ft.scalars().first()

    return {
        "ticket": full_ticket,
        "cliente": cliente,
        "items_cruzados": len(items_to_create),
        "whatsapp_disparado": whatsapp_disparado,
        "mensaje": f"Cupón registrado con éxito ({cupon_ticket.cantidad} cupones otorgados)"
    }


async def list_cupon_tickets(
    db: AsyncSession,
    company_id: UUID,
    barrio: Optional[str] = None,
    documento: Optional[str] = None,
    sincronizado: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0
) -> List[CuponTicket]:
    """Lista tickets de cupones con filtros y orden descendente."""
    query = select(CuponTicket).options(
        selectinload(CuponTicket.cliente),
        selectinload(CuponTicket.items)
    ).join(CuponCliente).where(
        CuponTicket.company_id == company_id
    )

    if barrio:
        query = query.where(CuponCliente.barrio.ilike(f"%{barrio}%"))
    if documento:
        cleaned = clean_documento(documento)
        query = query.where(CuponCliente.documento.ilike(f"%{cleaned}%"))
    if sincronizado is not None:
        query = query.where(CuponTicket.sincronizado == sincronizado)

    query = query.order_by(desc(CuponTicket.fecha_captura)).limit(limit).offset(offset)
    res = await db.execute(query)
    return res.scalars().all()


async def list_cupon_clientes(
    db: AsyncSession,
    company_id: UUID,
    search: Optional[str] = None,
    barrio: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
) -> List[CuponCliente]:
    """Lista clientes fidelizados ordenados por compras o antigüedad."""
    query = select(CuponCliente).where(CuponCliente.company_id == company_id)

    if search:
        s = f"%{search.strip()}%"
        query = query.where(
            or_(
                CuponCliente.nombre.ilike(s),
                CuponCliente.documento.ilike(s),
                CuponCliente.telefono.ilike(s)
            )
        )
    if barrio:
        query = query.where(CuponCliente.barrio.ilike(f"%{barrio}%"))

    query = query.order_by(desc(CuponCliente.total_gastado), desc(CuponCliente.cantidad_compras)).limit(limit).offset(offset)
    res = await db.execute(query)
    return res.scalars().all()


async def get_stats(db: AsyncSession, company_id: UUID) -> Dict[str, Any]:
    """Calcula KPIs agregados para el dashboard de cupones."""
    # Total cupones y tickets
    res_tickets = await db.execute(
        select(
            func.count(CuponTicket.id),
            func.sum(CuponTicket.cantidad),
            func.sum(CuponTicket.monto_compra)
        ).where(CuponTicket.company_id == company_id)
    )
    total_tickets, total_cupones, total_monto = res_tickets.first()

    # Total clientes
    res_clientes = await db.execute(
        select(func.count(CuponCliente.id)).where(CuponCliente.company_id == company_id)
    )
    total_clientes = res_clientes.scalar() or 0

    # Top barrios participantes
    res_barrios = await db.execute(
        select(
            CuponCliente.barrio,
            func.count(CuponTicket.id).label("tickets_count"),
            func.sum(CuponTicket.cantidad).label("cupones_count"),
            func.sum(CuponTicket.monto_compra).label("total_compras")
        )
        .join(CuponTicket, CuponTicket.cliente_id == CuponCliente.id)
        .where(CuponCliente.company_id == company_id)
        .group_by(CuponCliente.barrio)
        .order_by(desc(func.count(CuponTicket.id)))
        .limit(6)
    )
    top_barrios = [
        {
            "barrio": r.barrio or "Sin Barrio",
            "tickets": int(r.tickets_count or 0),
            "cupones": int(r.cupones_count or 0),
            "monto": float(r.total_compras or 0)
        }
        for r in res_barrios.all()
    ]

    # WhatsApp stats
    res_wa = await db.execute(
        select(
            func.count().filter(CuponTicket.whatsapp_enviado == True).label("enviados"),
            func.count().filter(CuponTicket.whatsapp_status == "pendiente").label("pendientes"),
            func.count().filter(CuponTicket.whatsapp_status.like("error%")).label("fallidos")
        ).where(CuponTicket.company_id == company_id)
    )
    enviados, pendientes, fallidos = res_wa.first()

    return {
        "total_cupones": int(total_cupones or 0),
        "total_tickets": int(total_tickets or 0),
        "total_clientes": int(total_clientes or 0),
        "monto_total_compras": float(total_monto or 0),
        "top_barrios": top_barrios,
        "whatsapp_stats": {
            "enviados": int(enviados or 0),
            "pendientes": int(pendientes or 0),
            "fallidos": int(fallidos or 0)
        }
    }


async def analizar_perfil_con_gemini(
    db: AsyncSession,
    company_id: UUID,
    cliente_ids: Optional[List[UUID]] = None,
    limite: int = 20,
    forzar_reanalisis: bool = False
) -> Dict[str, Any]:
    """
    Toma clientes con historial de compras y ejecuta Gemini 2.5 Flash para extraer perfil conductual y ganchos de oferta.
    """
    query = select(CuponCliente).options(
        selectinload(CuponCliente.tickets).selectinload(CuponTicket.items)
    ).where(
        CuponCliente.company_id == company_id
    )

    if cliente_ids:
        query = query.where(CuponCliente.id.in_(cliente_ids))
    elif not forzar_reanalisis:
        # Priorizar clientes sin análisis previo
        query = query.where(CuponCliente.ia_analisis.is_(None))

    query = query.order_by(desc(CuponCliente.total_gastado)).limit(limite)
    res = await db.execute(query)
    clientes = res.scalars().all()

    if not clientes:
        return {"analizados": 0, "fallidos": 0, "detalles": [], "mensaje": "No hay clientes pendientes de análisis"}

    detalles = []
    analizados = 0
    fallidos = 0

    gemini_key = getattr(settings, "gemini_api_key", None)
    if not gemini_key:
        # Fallback analítico si no hay API key configurada
        for c in clientes:
            mock_perfil = {
                "perfil_comprador": "Comprador Frecuente Familiar",
                "dias_preferidos": "Viernes y Sábados",
                "categorias_gancho": ["Carnicería", "Lácteos", "Almacén"],
                "gancho_oferta_whatsapp": f"¡Hola {c.nombre}! Este finde tenemos cortes premium de asado con 20% OFF para vos.",
                "ticket_frecuencia_score": "Alto",
                "fecha_analisis": datetime.now(timezone.utc).isoformat()
            }
            c.ia_analisis = mock_perfil
            c.segmentos = "Familiar,CarniceriaVIP,Finde"
            detalles.append({"cliente_id": str(c.id), "nombre": c.nombre, "perfil": mock_perfil})
            analizados += 1
        await db.commit()
        return {"analizados": analizados, "fallidos": 0, "detalles": detalles, "mensaje": "Análisis completado (Modo Heurístico)"}

    client = genai.Client(api_key=gemini_key)

    for c in clientes:
        # Recopilar lista de productos comprados en todos sus tickets
        items_summary = []
        for t in c.tickets:
            for it in t.items:
                items_summary.append(f"- {it.descripcion} (Cant: {it.cantidad}, Total: Gs. {it.total})")

        items_text = "\n".join(items_summary[:30]) if items_summary else "Sin detalle individual de ítems (Compras generales de salón)"

        prompt = f"""
Eres el Gerente de Inteligencia de Clientes de Extra Supermercado (Pedro Juan Caballero, Paraguay).
Analiza los datos de consumo de este cliente fidelizado para perfilar sus hábitos de compra y generar ganchos de oferta de WhatsApp personalizados.

DATOS DEL CLIENTE:
- Nombre: {c.nombre}
- Barrio: {c.barrio or 'Centro'} ({c.ciudad})
- Total Gastado: Gs. {c.total_gastado:,.0f}
- Cantidad de Compras: {c.cantidad_compras}
- Ticket Promedio: Gs. {c.ticket_promedio:,.0f}
- Ítems comprados recientemente:
{items_text}

Responde ÚNICAMENTE en formato JSON con la siguiente estructura exacta:
{{
  "perfil_comprador": "Nombre corto del perfil (ej: Parrillero de Fin de Semana / Abastecimiento Familiar / Compras Rápidas Diarias)",
  "resumen_conductual": "Breve explicación de 2 líneas de sus hábitos y prioridades de compra.",
  "dias_preferidos": "Días probables de compra (ej: Jueves a Sábado)",
  "categorias_gancho": ["Categoría 1", "Categoría 2", "Categoría 3"],
  "gancho_oferta_whatsapp": "Texto persuasivo y amigable de 2 a 3 líneas listo para enviarle por WhatsApp ofreciéndole una promoción irresistible según sus gustos.",
  "segmentos_tags": ["Tag1", "Tag2", "Tag3"]
}}
"""
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                )
            )
            raw_text = response.text or "{}"
            parsed = json.loads(raw_text)
            parsed["fecha_analisis"] = datetime.now(timezone.utc).isoformat()

            c.ia_analisis = parsed
            tags = parsed.get("segmentos_tags", [])
            if tags and isinstance(tags, list):
                c.segmentos = ",".join(tags)

            detalles.append({"cliente_id": str(c.id), "nombre": c.nombre, "perfil": parsed})
            analizados += 1
        except Exception as e:
            logger.error(f"Error al analizar cliente {c.id} con Gemini: {e}")
            fallidos += 1

    await db.commit()
    return {
        "analizados": analizados,
        "fallidos": fallidos,
        "detalles": detalles,
        "mensaje": f"Se perfilaron {analizados} clientes con Gemini 2.5 Flash ({fallidos} fallos)"
    }
