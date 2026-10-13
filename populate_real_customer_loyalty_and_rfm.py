import asyncio
import uuid
from sqlalchemy import text
from api.src.db import engine

async def main():
    async with engine.begin() as conn:
        # 1. Total customers
        res = await conn.execute(text("SELECT COUNT(*) FROM customers"))
        total_customers = res.scalar()
        print(f"Total customers in DB: {total_customers}")

        # 2. Sales grouped by customer
        res = await conn.execute(text("""
            SELECT 
                customer_id,
                COUNT(*) as total_tx,
                COALESCE(SUM(total), 0) as total_spent,
                MAX(COALESCE(fecha, created_at)) as last_purchase
            FROM sales
            WHERE customer_id IS NOT NULL AND estado = 'confirmado'
            GROUP BY customer_id
        """))
        customer_sales = res.fetchall()
        print(f"Customers with real sales: {len(customer_sales)}")

        # 3. Populate loyalty points table for active company
        company_res = await conn.execute(text("SELECT id FROM companies LIMIT 1"))
        company_row = company_res.fetchone()
        company_id = str(company_row[0]) if company_row else "00000000-0000-0000-0000-000000000010"

        # Check existing points
        pts_count = (await conn.execute(text("SELECT COUNT(*) FROM loyalty_points"))).scalar()
        print(f"Existing loyalty_points rows: {pts_count}")

        # Insert loyalty points for each customer with sales
        inserted = 0
        for row in customer_sales:
            cid = str(row[0])
            tx = int(row[1])
            spent = float(row[2])
            # 1 pt per Gs 1.000
            points = max(50, int(spent / 1000))

            # Insert into loyalty_points if not exists
            check = await conn.execute(text("SELECT id FROM loyalty_points WHERE customer_id = :cid LIMIT 1"), {"cid": cid})
            if not check.fetchone():
                await conn.execute(text("""
                    INSERT INTO loyalty_points (id, company_id, customer_id, tipo, puntos, descripcion, created_at)
                    VALUES (:id, :company_id, :cid, 'suma', :pts, 'Puntos acumulados por compras históricas ExtraClub', NOW())
                """), {
                    "id": str(uuid.uuid4()),
                    "company_id": company_id,
                    "cid": cid,
                    "pts": points
                })
                inserted += 1

        print(f"Inserted {inserted} loyalty points records based on real sales transactions.")

        # 4. Summary of RFM segmentation from real sales
        rfm_summary = await conn.execute(text("""
            WITH stats AS (
                SELECT 
                    customer_id,
                    COUNT(*) as tx,
                    COALESCE(SUM(total), 0) as spent,
                    EXTRACT(DAY FROM NOW() - MAX(COALESCE(fecha, created_at))) as days_since
                FROM sales
                WHERE customer_id IS NOT NULL AND estado = 'confirmado'
                GROUP BY customer_id
            )
            SELECT
                CASE 
                    WHEN days_since <= 15 AND (tx >= 10 OR spent >= 3000000) THEN 'Champions (VIP Platino)'
                    WHEN days_since <= 30 AND tx >= 4 THEN 'Leales Recurrentes (Oro/Plata)'
                    WHEN days_since <= 45 THEN 'Potenciales / Nuevos'
                    ELSE 'En Riesgo de Fuga'
                END as rfm_segment,
                COUNT(*) as customer_count,
                SUM(spent) as total_volume,
                AVG(spent) as avg_volume
            FROM stats
            GROUP BY 1
            ORDER BY total_volume DESC
        """))
        print("\n--- RESUMEN RFM REAL DE SUPERMERCADO ---")
        for r in rfm_summary.fetchall():
            print(f"Segmento: {r[0]} | Clientes: {r[1]} | Volumen Total: Gs. {int(r[2]):,} | Ticket Promedio: Gs. {int(r[3]):,}")

if __name__ == "__main__":
    asyncio.run(main())
