import asyncio
from sqlalchemy import text
from api.src.db import engine

async def main():
    async with engine.begin() as conn:
        print("Iniciando saneamiento de clientes vs proveedores...")

        # 1. Marcar como 'proveedor' a los que coinciden con suppliers
        res = await conn.execute(text("""
            UPDATE customers c
            SET tipo = 'proveedor'
            WHERE EXISTS (
                SELECT 1 FROM suppliers s 
                WHERE (c.ruc = s.ruc AND c.ruc IS NOT NULL AND c.ruc != '') 
                   OR LOWER(TRIM(c.razon_social)) = LOWER(TRIM(s.razon_social))
            )
            OR c.razon_social ILIKE '%3SV AGUARAY%'
            OR c.razon_social ILIKE '%40 COMERCIAL%'
            OR c.razon_social ILIKE '%ABV CON DE ALIN%'
            OR c.razon_social ILIKE '%CASA GONZALITO%'
            OR c.razon_social ILIKE '%FORTIN S.A%'
            OR c.razon_social ILIKE '%PAPA IVAR%'
            OR c.razon_social ILIKE '%DISTRIBUIDORA GLORIA%'
            OR c.razon_social ILIKE '%BEBIDAS DEL PARAGUAY%'
        """))
        print(f"Proveedores B2B identificados y marcados en customers: {res.rowcount}")

        # 2. Resumen de tipos en customers
        counts = await conn.execute(text("SELECT tipo, COUNT(*) FROM customers GROUP BY tipo ORDER BY 2 DESC"))
        print("\nDistribución resultante en customers:")
        for r in counts.fetchall():
            print(f"Tipo: {r[0]} -> {r[1]} registros")

if __name__ == "__main__":
    asyncio.run(main())
