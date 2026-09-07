import asyncio
import pymysql
import uuid
from decimal import Decimal
from api.src.config import settings
from api.src.db import async_session_factory
from sqlalchemy import text

COMPANY_ID = "00000000-0000-0000-0000-000000000010"

async def audit_wholesale_gaps():
    print("=== AUDITORÍA COMPLETA DE ESCALAS Y PRECIOS MAYORISTAS ===")
    
    # 1. Conectar a MySQL
    conn = pymysql.connect(
        host=settings.nemuha_mysql_host or '127.0.0.1',
        port=settings.nemuha_mysql_port or 3306,
        user=settings.nemuha_mysql_user or 'root',
        password=settings.nemuha_mysql_password or '',
        database=settings.nemuha_mysql_database or 'comercial_extra_py',
        cursorclass=pymysql.cursors.DictCursor
    )

    with conn.cursor() as cur:
        # A. Escalas desde est_produto (tabla maestra de productos con campos atacado directos)
        cur.execute("""
            SELECT ID_PRODUTO, DS_PRODUTO, VL_PRECO_VENDA_VAREJO, VL_PRECO_VENDA_ATACADO, QTD_PARA_PRECO_ATACADO
            FROM est_produto
            WHERE VL_PRECO_VENDA_ATACADO > 0 
              AND QTD_PARA_PRECO_ATACADO >= 2 
              AND VL_PRECO_VENDA_ATACADO < VL_PRECO_VENDA_VAREJO;
        """)
        escalas_est_produto = cur.fetchall()

        # B. Escalas desde ven_preco_quantidade_produto
        cur.execute("""
            SELECT ID_PRODUTO, QTD_PRODUTO, VL_PRECO_VENDA_VAREJO, VL_PRECO_VENDA_ATACADO
            FROM ven_preco_quantidade_produto
            WHERE QTD_PRODUTO >= 2;
        """)
        escalas_ven_qtd = cur.fetchall()

        # C. Códigos en est_produto
        pass

    conn.close()

    print(f"MySQL: {len(escalas_est_produto)} productos con escala en est_produto.")
    print(f"MySQL: {len(escalas_ven_qtd)} registros en ven_preco_quantidade_produto.")


    # 2. Analizar en Postgres
    async with async_session_factory() as db:
        # Cargar todos los productos de Postgres por SKU y por codigo_barra
        res_p = await db.execute(text("SELECT id, sku, codigo_barra, nombre, precio_venta FROM products;"))
        prods_by_sku = {}
        prods_by_bc = {}
        for r in res_p.fetchall():
            pid, sku, bc, nom, pv = r
            if sku:
                prods_by_sku[str(sku).strip()] = (pid, nom, pv)
            if bc:
                prods_by_bc[str(bc).strip()] = (pid, nom, pv)

        # Cargar todas las escalas en sp_tiered_prices
        res_t = await db.execute(text("SELECT product_id, min_qty, precio_unitario, activo FROM sp_tiered_prices WHERE price_list_id IS NULL;"))
        postgres_tiers = {}
        for r in res_t.fetchall():
            pid, mq, pu, act = r
            postgres_tiers[(pid, int(mq))] = (pu, act)

        # A. Verificar si faltan escalas de est_produto
        missing_est_produto = []
        for ep in escalas_est_produto:
            sku_str = str(ep['ID_PRODUTO']).strip()
            min_qty = int(ep['QTD_PARA_PRECO_ATACADO'])
            precio_atacado = Decimal(str(ep['VL_PRECO_VENDA_ATACADO']))

            if sku_str in prods_by_sku:
                pid, nom, pv = prods_by_sku[sku_str]
                if (pid, min_qty) not in postgres_tiers:
                    missing_est_produto.append((sku_str, nom, min_qty, precio_atacado, pv))

        # B. Verificar si faltan escalas de ven_preco_quantidade_produto
        missing_ven_qtd = []
        for v in escalas_ven_qtd:
            sku_str = str(v['ID_PRODUTO']).strip()
            min_qty = int(v['QTD_PRODUTO'])
            p_escala = Decimal(str(v['VL_PRECO_VENDA_VAREJO']))
            if p_escala <= 0:
                p_escala = Decimal(str(v['VL_PRECO_VENDA_ATACADO']))

            if sku_str in prods_by_sku:
                pid, nom, pv = prods_by_sku[sku_str]
                if p_escala > 0 and p_escala < (pv or Decimal("9999999")):
                    if (pid, min_qty) not in postgres_tiers:
                        missing_ven_qtd.append((sku_str, nom, min_qty, p_escala, pv))

        # C. Verificar productos en promoción activa (Escalas en HOLD)
        res_hold = await db.execute(text("""
            SELECT p.codigo_barra, p.nombre, pr.nombre as promo_nombre, pr.tipo, pr.valido_hasta
            FROM promotions pr
            CROSS JOIN LATERAL unnest(pr.producto_ids) as promo_pid
            JOIN products p ON p.id = promo_pid
            WHERE pr.activo = true AND pr.estado = 'activa';
        """))
        hold_promos = res_hold.fetchall()

    print("\n" + "="*50)
    print("=== RESULTADOS DEL ANÁLISIS DE BRECHAS ===")
    print("="*50)
    print(f"1. Escalas pendientes de est_produto (tabla maestra): {len(missing_est_produto)}")
    if missing_est_produto:
        for m in missing_est_produto[:5]:
            print(f"   - SKU {m[0]}: {m[1]} | Min: {m[2]} un | Precio Escala: {m[3]} (Base: {m[4]})")

    print(f"\n2. Escalas pendientes de ven_preco_quantidade_produto: {len(missing_ven_qtd)}")
    if missing_ven_qtd:
        for m in missing_ven_qtd[:5]:
            print(f"   - SKU {m[0]}: {m[1]} | Min: {m[2]} un | Precio Escala: {m[3]} (Base: {m[4]})")

    print(f"\n3. Productos en Promoción Activa (Escalas en HOLD intencional): {len(hold_promos)}")
    for h in hold_promos[:5]:
        print(f"   - Barra {h[0]}: {h[1]} | Promo: '{h[2]}' ({h[3]})")

asyncio.run(audit_wholesale_gaps())
