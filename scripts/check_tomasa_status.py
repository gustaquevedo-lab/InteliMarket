import asyncio
import pymysql
from api.src.config import settings
from api.src.db import async_session_factory
from sqlalchemy import text

async def check_tomasa():
    # 1. Consultar MySQL (Legacy)
    conn = pymysql.connect(
        host=settings.nemuha_mysql_host or '127.0.0.1',
        port=settings.nemuha_mysql_port or 3306,
        user=settings.nemuha_mysql_user or 'root',
        password=settings.nemuha_mysql_password or '',
        database=settings.nemuha_mysql_database or 'comercial_extra_py',
        cursorclass=pymysql.cursors.DictCursor
    )

    with conn.cursor() as cur:
        # Sesión de Tomasa en MySQL
        cur.execute("""
            SELECT fcc.ID_CAIXA_CHICA, fcc.ID_USUARIO, fcc.STATUS_CAIXA, fcc.DT_ABERTURA, fcc.DT_FECHAMENTO,
                   fcc.VL_ABERTURA_GUARANI, fcc.VL_FECHAMENTO_GUARANI, fcc.VL_MOVIMENTADO_GUARANI,
                   u.NM_USUARIO, u.LOGIN 
            FROM fin_caixa_chica fcc
            JOIN sys_usuario u ON fcc.ID_USUARIO = u.id_usuario
            WHERE u.NM_USUARIO LIKE '%TOMASA%' OR u.LOGIN LIKE '%TOMA%'
            ORDER BY fcc.ID_CAIXA_CHICA DESC
            LIMIT 5;
        """)
        sesiones_tomasa = cur.fetchall()
        print("=== SESIONES DE TOMASA EN MYSQL ===")
        for s in sesiones_tomasa:
            print(s)

        # Secuencia fiscal de Punto 014 (Caja 4) en MySQL
        cur.execute("SELECT * FROM con_secuencia_fatura WHERE boca_emissao IN ('014', '14', '001-014');")
        sec_014 = cur.fetchall()
        print("\n=== SECUENCIA EN MYSQL PUNTO 014 (CAJA 4) ===")
        for s in sec_014:
            print(s)

        # Últimas facturas en MySQL emitidas en Punto 014
        cur.execute("""
            SELECT v.ID_VENDA, v.ID_CAIXA_CHICA, v.CD_VENDA, v.NR_FATURA, v.VL_TOTAL, v.DT_VENDA, v.BO_CANCELADO
            FROM ven_venda v
            WHERE v.NR_FATURA LIKE '%014-%' OR v.NR_FATURA LIKE '%-014-%'
            ORDER BY v.ID_VENDA DESC
            LIMIT 5;
        """)
        facturas_014 = cur.fetchall()
        print("\n=== ULTIMAS FACTURAS EN MYSQL PUNTO 014 ===")
        for f in facturas_014:
            print(f)

    conn.close()

    # 2. Consultar Postgres
    async with async_session_factory() as db:
        res = await db.execute(text("""
            SELECT id, establecimiento, punto_emision, tipo_documento, numero_actual, numero_final, activo
            FROM punto_emision_secuencias
            WHERE punto_emision = '014';
        """))
        print("\n=== SECUENCIAS EN POSTGRES PUNTO 014 ===")
        for r in res.fetchall():
            print(dict(r._mapping))

asyncio.run(check_tomasa())
