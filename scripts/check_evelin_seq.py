import asyncio
import pymysql
from api.src.config import settings
from api.src.db import async_session_factory
from sqlalchemy import text

COMPANY_ID = "00000000-0000-0000-0000-000000000010"

async def check_evelin_legacy_and_sync():
    conn = pymysql.connect(
        host=settings.nemuha_mysql_host or '127.0.0.1',
        port=settings.nemuha_mysql_port or 3306,
        user=settings.nemuha_mysql_user or 'root',
        password=settings.nemuha_mysql_password or '',
        database=settings.nemuha_mysql_database or 'comercial_extra_py',
        cursorclass=pymysql.cursors.DictCursor
    )

    with conn.cursor() as cur:
        # 1. Secuencia de punto 13 / 013 en MySQL
        cur.execute("SELECT * FROM con_secuencia_fatura WHERE boca_emissao IN ('013', '13', '001-013');")
        sec_013 = cur.fetchall()
        print("=== SECUENCIA EN MYSQL (LEGACY) PARA PUNTO 013 ===")
        for s in sec_013:
            print(s)

        # 2. Últimas facturas emitidas en MySQL en punto 13
        cur.execute("""
            SELECT v.ID_VENDA, v.ID_CAIXA_CHICA, v.CD_VENDA, v.NR_FATURA, v.VL_TOTAL, v.DT_VENDA, v.BO_CANCELADO
            FROM ven_venda v
            WHERE v.NR_FATURA LIKE '%013-%' OR v.NR_FATURA LIKE '%-013-%'
            ORDER BY v.ID_VENDA DESC
            LIMIT 10;
        """)
        facturas_013 = cur.fetchall()
        print("\n=== ULTIMAS FACTURAS EN MYSQL PUNTO 013 ===")
        for f in facturas_013:
            print(f)

        # 3. Sesión de Evelyn en MySQL (Turno 2210)
        cur.execute("""
            SELECT fcc.*, u.NM_USUARIO, u.LOGIN 
            FROM fin_caixa_chica fcc
            LEFT JOIN sys_usuario u ON fcc.ID_USUARIO = u.id_usuario
            WHERE fcc.ID_CAIXA_CHICA = 2210 OR u.NM_USUARIO LIKE '%EVELIN%' OR u.LOGIN LIKE '%EVEL%'
            ORDER BY fcc.ID_CAIXA_CHICA DESC
            LIMIT 5;
        """)
        sesiones_evelin = cur.fetchall()
        print("\n=== SESION DE EVELYN EN MYSQL ===")
        for ses in sesiones_evelin:
            print(ses)

    conn.close()

    # 4. Sincronizar en Postgres
    async with async_session_factory() as db:
        res = await db.execute(text("""
            SELECT id, establecimiento, punto_emision, tipo_documento, numero_actual, numero_final, activo
            FROM punto_emision_secuencias
            WHERE punto_emision = '013';
        """))
        print("\n=== SECUENCIAS ACTUALES EN POSTGRES (PUNTO 013) ===")
        for r in res.fetchall():
            print(dict(r._mapping))

asyncio.run(check_evelin_legacy_and_sync())
