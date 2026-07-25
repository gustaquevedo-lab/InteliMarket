"""Seed for Loyalty - demo data"""
import asyncio
import asyncpg
from datetime import datetime, timedelta
from scripts.seed_data import DB, CID, LOY_CFG1, LOY_PTS1, LOY_PTS2, LOY_RW1, LOY_RW2, CUST01, CUST02, CUST05
from uuid import uuid4


async def seed():
    conn = await asyncpg.connect(DB)
    try:
        await conn.execute("""
            INSERT INTO loyalty_config (id, company_id, puntos_por_guarani, guarani_por_punto,
               vencimiento_dias, canje_minimo_puntos, bienvenida_puntos, cumpleanos_puntos,
               crear_en_venta, activo)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO NOTHING
        """, LOY_CFG1, CID, 5, 100, 365, 500, 100, 200, True, True)

        await conn.execute("""
            INSERT INTO loyalty_points (id, company_id, customer_id, tipo, puntos, descripcion, vence_en)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO NOTHING
        """, LOY_PTS1, CID, CUST01, 'earned', 1250, "Compra VEN-001233", datetime.now() + timedelta(days=365))

        await conn.execute("""
            INSERT INTO loyalty_points (id, company_id, customer_id, tipo, puntos, descripcion, vence_en)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO NOTHING
        """, LOY_PTS2, CID, CUST02, 'earned', 85, "Compra VEN-001234", datetime.now() + timedelta(days=365))

        await conn.execute("""
            INSERT INTO loyalty_points (id, company_id, customer_id, tipo, puntos, descripcion)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO NOTHING
        """, uuid4(), CID, CUST05, 'redeemed', 500, "Canje descuento")

        await conn.execute("""
            INSERT INTO loyalty_rewards (id, company_id, nombre, descripcion, puntos_requeridos,
               tipo_recompensa, valor_recompensa, stock, activo)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO NOTHING
        """, LOY_RW1, CID, "Gs. 50.000 de descuento",
           "Descuento de Gs. 50.000 en tu próxima compra", 500, 'discount', 50000, 50, True)

        await conn.execute("""
            INSERT INTO loyalty_rewards (id, company_id, nombre, descripcion, puntos_requeridos,
               tipo_recompensa, stock, activo)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO NOTHING
        """, LOY_RW2, CID, "Envío gratis", "Envío gratuito en tu próximo pedido", 300, 'shipping', 100, True)

        print("✅ Loyalty seeded")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
