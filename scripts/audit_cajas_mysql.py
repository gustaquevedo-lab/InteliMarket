import asyncio
import pymysql
from api.src.config import settings
from api.src.db import async_session_factory
from sqlalchemy import text

async def clean_test_sessions():
    async with async_session_factory() as db:
        # 1. Borrar cash_handoffs vinculados a las sesiones de prueba
        await db.execute(text("""
            DELETE FROM cash_handoffs 
            WHERE session_id IN (
                SELECT id FROM cash_sessions 
                WHERE cajero_nombre IN ('TOMASA', 'EVELIN HERRERO', 'NILDA AQUINO') 
                   OR observaciones ILIKE '%prueba%' 
                   OR observaciones ILIKE '%sandbox%'
            );
        """))
        # 2. Borrar cash_counts
        await db.execute(text("""
            DELETE FROM cash_counts 
            WHERE session_id IN (
                SELECT id FROM cash_sessions 
                WHERE cajero_nombre IN ('TOMASA', 'EVELIN HERRERO', 'NILDA AQUINO') 
                   OR observaciones ILIKE '%prueba%' 
                   OR observaciones ILIKE '%sandbox%'
            );
        """))
        # 3. Borrar sesiones de prueba
        await db.execute(text("""
            DELETE FROM cash_sessions 
            WHERE cajero_nombre IN ('TOMASA', 'EVELIN HERRERO', 'NILDA AQUINO') 
               OR observaciones ILIKE '%prueba%' 
               OR observaciones ILIKE '%sandbox%';
        """))
        await db.commit()
        print(">>> SESIONES DE PRUEBA LIMPIADAS EN POSTGRESQL <<<")


async def audit_mysql():
    conn = pymysql.connect(
        host=settings.nemuha_mysql_host or '127.0.0.1',
        port=settings.nemuha_mysql_port or 3306,
        user=settings.nemuha_mysql_user or 'root',
        password=settings.nemuha_mysql_password or '',
        database=settings.nemuha_mysql_database or 'comercial_extra_py',
        cursorclass=pymysql.cursors.DictCursor
    )

    with conn.cursor() as cur:
        print("\n=== TABLAS DE CAJA EN MYSQL LEGACY ===")
        cur.execute("SHOW TABLES LIKE '%caixa%';")
        for t in cur.fetchall():
            print(t)
        
        print("\n=== ULTIMOS REGISTROS EN fin_caixa_chica (Sesiones/Cajas del legacy) ===")
        cur.execute("""
            SELECT fcc.ID_CAIXA_CHICA, fcc.ID_USUARIO, u.NM_USUARIO, fcc.DT_ABERTURA, fcc.HR_ABERTURA, 
                   fcc.DT_FECHAMENTO, fcc.HR_FECHAMENTO, fcc.VL_SALDO_INICIAL, fcc.ST_STATUS
            FROM fin_caixa_chica fcc 
            LEFT JOIN bs_usuario u ON fcc.ID_USUARIO = u.ID_USUARIO 
            ORDER BY fcc.ID_CAIXA_CHICA DESC 
            LIMIT 15;
        """)
        for r in cur.fetchall():
            print(r)

    conn.close()

if __name__ == "__main__":
    asyncio.run(clean_test_sessions())
    asyncio.run(audit_mysql())
