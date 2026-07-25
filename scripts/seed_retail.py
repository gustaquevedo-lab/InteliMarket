"""Seed for Retail - store config, KPIs, cupones, eventos, heatmap"""
import asyncio
import asyncpg
from datetime import date, datetime, timedelta
from uuid import uuid4
from scripts.seed_data import DB, CID, BR_CENTRAL, BR_SUC1, P001, P002, P003, P004, P005, CUST02, SALE001, RT_STORE1, RT_KPI1, RT_COUP1, RT_EVENT1, RT_HEAT1


async def seed():
    conn = await asyncpg.connect(DB)
    try:
        # rt_store_config
        await conn.execute("""
            INSERT INTO rt_store_config (id, company_id, branch_id, nombre, metros_cuadrados, tipo, hora_apertura, hora_cierre, dias_abiertos, capacidad_horaria, config_pos, config_online, activo, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT (id) DO NOTHING
        """, RT_STORE1, CID, BR_CENTRAL, "DelEste Centro", 450.0, "retail", "08:00", "21:00", "1,2,3,4,5,6", 30, '{"modo_kiosko": true, "ticket_digital_default": true}', '{"slug_publico": "deleste-centro", "delivery_km_max": 15}', True, datetime.utcnow(), datetime.utcnow())

        # rt_kpi_snapshot
        yesterday = date.today() - timedelta(days=1)
        await conn.execute("""
            INSERT INTO rt_kpi_snapshot (id, company_id, branch_id, fecha, periodo, ventas_total, ventas_count, ticket_promedio, ventas_m2, margen_bruto, clientes_unicos, productos_vendidos, descuento_total, delta_ventas_pct, delta_ticket_pct, hora_pico, conversion_pct, calculated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            ON CONFLICT (id) DO NOTHING
        """, RT_KPI1, CID, BR_CENTRAL, yesterday, "dia", 28500000, 142, 200704, 63333.33, 7125000, 89, 385, 0, 12.5, 8.3, 18, 38.5, datetime.utcnow())

        # rt_coupon
        now = datetime.utcnow()
        july_start = now.replace(month=7, day=1, hour=0, minute=0, second=0, microsecond=0)
        july_end = now.replace(month=7, day=31, hour=23, minute=59, second=59, microsecond=0)
        if now.month >= 8:
            july_start = now.replace(year=now.year + 1, month=7, day=1, hour=0, minute=0, second=0, microsecond=0)
            july_end = now.replace(year=now.year + 1, month=7, day=31, hour=23, minute=59, second=59, microsecond=0)
        elif now.month == 7:
            pass
        else:
            july_start = now.replace(month=7, day=1, hour=0, minute=0, second=0, microsecond=0)
            july_end = now.replace(month=7, day=31, hour=23, minute=59, second=59, microsecond=0)
        await conn.execute("""
            INSERT INTO rt_coupon (id, company_id, codigo, nombre, descripcion, tipo, valor, compra_minima, aplicar_a, fecha_desde, fecha_hasta, usos_maximos, usos_por_cliente, usos_actuales, estado, canal, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            ON CONFLICT (id) DO NOTHING
        """, RT_COUP1, CID, "BIENVENIDO10", "10% OFF primera compra", "Descuento del 10% en la primera compra online", "porcentaje", 10.0, 50000, "todos", july_start, july_end, 1000, 1, 0, "activo", "online", datetime.utcnow(), datetime.utcnow())

        # rt_coupon_redemption
        redemp_id = uuid4()
        await conn.execute("""
            INSERT INTO rt_coupon_redemption (id, company_id, coupon_id, customer_id, sale_id, branch_id, monto_descuento, fecha)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO NOTHING
        """, redemp_id, CID, RT_COUP1, CUST02, SALE001, BR_CENTRAL, 25000, datetime.utcnow())

        # rt_calendar_event
        mother_day = date(2026, 5, 10)
        await conn.execute("""
            INSERT INTO rt_calendar_event (id, company_id, codigo, nombre, descripcion, fecha_evento, fecha_fin, categoria, icono, recurrente, activo, notas_planificacion, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (id) DO NOTHING
        """, RT_EVENT1, CID, "dia_madre", "Día de la Madre", "Celebración del Día de la Madre en Paraguay", mother_day, mother_day + timedelta(days=1), "festividad", "🎉", True, True, "Preparar campaña de regalos: perfumes, chocolates, electrodomésticos. Coordinar promos con proveedores.", datetime.utcnow())

        # rt_hour_heatmap
        today = date.today()
        await conn.execute("""
            INSERT INTO rt_hour_heatmap (id, company_id, branch_id, fecha, hora, ventas_total, ventas_count, clientes_count, duracion_promedio_min, personal_sugerido)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO NOTHING
        """, RT_HEAT1, CID, BR_CENTRAL, today, 10, 3200000, 18, 22, 12, 4)

        print("✅ Retail seeded")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
