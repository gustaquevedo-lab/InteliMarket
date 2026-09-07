import asyncio
import pymysql
from api.src.config import settings
from api.src.db import async_session_factory
from sqlalchemy import text

COMPANY_ID = "00000000-0000-0000-0000-000000000010"

async def sync_everything_live():
    # 1. Conectar a MySQL para obtener las ventas de hoy y sus cajas
    conn = pymysql.connect(
        host=settings.nemuha_mysql_host or '127.0.0.1',
        port=settings.nemuha_mysql_port or 3306,
        user=settings.nemuha_mysql_user or 'root',
        password=settings.nemuha_mysql_password or '',
        database=settings.nemuha_mysql_database or 'comercial_extra_py',
        cursorclass=pymysql.cursors.DictCursor
    )

    with conn.cursor() as cur:
        # Traer todas las ventas recientes con su ID_CAIXA_CHICA y datos fiscales
        print("Leyendo ventas y sesiones en MySQL...")
        cur.execute("""
            SELECT ID_VENDA, ID_CAIXA_CHICA, CD_VENDA, NR_FATURA, NR_SERIE, VL_TOTAL, BO_FATURADO, BO_CANCELADO, DT_VENDA
            FROM ven_venda
            WHERE DT_VENDA >= '2026-08-01' OR ID_CAIXA_CHICA IN (2209, 2210, 2211);
        """)
        ventas_mysql = cur.fetchall()
        print(f"Total ventas recientes leídas de MySQL: {len(ventas_mysql)}")

        # Traer la última numeración fiscal real por serie/punto de emisión en MySQL
        cur.execute("""
            SELECT NR_SERIE, MAX(NR_FATURA) as max_factura
            FROM ven_venda
            WHERE NR_FATURA IS NOT NULL AND NR_FATURA > 0
            GROUP BY NR_SERIE;
        """)
        series_mysql = cur.fetchall()
        print(f"Numeraciones por serie en MySQL: {series_mysql}")

    conn.close()

    # 2. En PostgreSQL: actualizar Sale.session_id y punto_emision_secuencias
    async with async_session_factory() as db:
        # A. Mapeo de fin_caixa_chica -> session_id en Postgres
        res = await db.execute(text("""
            SELECT source_pk, target_id 
            FROM nemuha_record_map 
            WHERE company_id = :comp AND source_table = 'fin_caixa_chica';
        """), {"comp": COMPANY_ID})
        caixa_to_session = {row.source_pk: row.target_id for row in res.fetchall()}

        # B. Mapeo de ven_venda -> sale_id en Postgres
        res_v = await db.execute(text("""
            SELECT source_pk, target_id 
            FROM nemuha_record_map 
            WHERE company_id = :comp AND source_table = 'ven_venda';
        """), {"comp": COMPANY_ID})
        venda_to_sale = {row.source_pk: row.target_id for row in res_v.fetchall()}

        # C. Vincular masivamente Sale.session_id
        linked_count = 0
        for v in ventas_mysql:
            sale_id = venda_to_sale.get(v["ID_VENDA"])
            session_id = caixa_to_session.get(v["ID_CAIXA_CHICA"])
            if sale_id and session_id:
                await db.execute(text("""
                    UPDATE sales 
                    SET session_id = :sid, 
                        total = :tot,
                        estado = :st
                    WHERE id = :sale_id;
                """), {
                    "sid": session_id,
                    "tot": float(v["VL_TOTAL"]),
                    "st": "cancelado" if v["BO_CANCELADO"] else "confirmado",
                    "sale_id": sale_id
                })
                linked_count += 1

        await db.commit()
        print(f"Ventas vinculadas a sesiones de caja: {linked_count}")

        # D. Sincronizar numeraciones de punto_emision_secuencias
        for s in series_mysql:
            serie = s["NR_SERIE"]
            max_num = s["max_factura"]
            if serie and max_num:
                punto = str(serie).zfill(3)
                await db.execute(text("""
                    UPDATE punto_emision_secuencias
                    SET numero_actual = :num,
                        updated_at = now()
                    WHERE punto_emision = :pto AND tipo_documento = 'factura';
                """), {"num": max_num, "pto": punto})
                print(f"Punto de emisión {punto}: número actualizado a {max_num}")

        await db.commit()

if __name__ == "__main__":
    asyncio.run(sync_everything_live())
