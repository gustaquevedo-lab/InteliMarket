#!/usr/bin/env python3
"""
Sincronización Bidireccional Intelimarket (PostgreSQL) <-> Extra Club (cPanel MySQL)
- Sincroniza clientes y puntos reales de lealtad (loyalty_points) hacia cPanel MySQL.
- Actualiza niveles (PLATA, ORO, PLATINUM) según puntaje real acumulado.
- Importa nuevos socios registrados desde la web hacia PostgreSQL customers.
"""
import os, sys, re, asyncio, pymysql
from sqlalchemy import text
from api.src.db import engine

MYSQL_HOST = 'superextra.com.py'
MYSQL_USER = 'superex_clubuser'
MYSQL_PASS = 'ClubExtra2026Pass'
MYSQL_DB   = 'superex_extraclub'

def clean_doc(doc_str):
    if not doc_str:
        return ""
    doc_clean = str(doc_str).split('-')[0]
    return re.sub(r'[^0-9]', '', doc_clean)

def determine_level(pts):
    if pts >= 20000:
        return 'PLATINUM'
    elif pts >= 5000:
        return 'ORO'
    return 'PLATA'

async def sync():
    print("[1/3] Conectando a PostgreSQL Intelimarket...")
    async with engine.connect() as conn:
        query = text("""
            SELECT 
                c.id::text as customer_id,
                c.ruc,
                c.ci,
                c.razon_social,
                c.nombre_fantasia,
                c.direccion,
                c.telefono,
                c.ciudad,
                c.extra_club_numero,
                COALESCE(SUM(lp.puntos), 0) as total_puntos
            FROM customers c
            LEFT JOIN loyalty_points lp ON lp.customer_id = c.id
            WHERE c.activo = true 
              AND ((c.ruc IS NOT NULL AND length(trim(c.ruc)) >= 4) OR (c.ci IS NOT NULL AND length(trim(c.ci)) >= 4))
            GROUP BY c.id, c.ruc, c.ci, c.razon_social, c.nombre_fantasia, c.direccion, c.telefono, c.ciudad, c.extra_club_numero;
        """)
        res = await conn.execute(query)
        pg_customers = [dict(r._mapping) for r in res.fetchall()]

    print(f"-> Clientes activos en PostgreSQL: {len(pg_customers)}")

    print("[2/3] Conectando a MySQL cPanel...")
    m_conn = pymysql.connect(
        host=MYSQL_HOST,
        user=MYSQL_USER,
        password=MYSQL_PASS,
        database=MYSQL_DB,
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )

    batch_data = []
    seen_docs = set()

    for c in pg_customers:
        raw_doc = c['ruc'] or c['ci']
        doc = clean_doc(raw_doc)
        if not doc or len(doc) < 4 or doc in seen_docs:
            continue
        seen_docs.add(doc)

        nombre = (c['razon_social'] or c['nombre_fantasia'] or 'CLIENTE EXTRA').strip()
        tel = re.sub(r'[^0-9]', '', c['telefono'] or '')
        dir_c = (c['direccion'] or '').strip()
        ciudad = (c['ciudad'] or 'Pedro Juan Caballero').strip()
        pts = int(c['total_puntos'])
        nivel = determine_level(pts)
        
        # Ahorro estimado proporcional a beneficios
        ahorro = float(pts * 10) if pts > 0 else 0.0

        if c.get('extra_club_numero') and len(str(c['extra_club_numero'])) < 40 and not str(c['extra_club_numero']).startswith(('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', '-')):
            num_socio = str(c['extra_club_numero'])
        else:
            try:
                num_socio = f"EC-{int(doc):08d}"
            except:
                num_socio = f"EC-{doc}"

        batch_data.append((
            num_socio,
            doc,
            nombre,
            tel,
            dir_c,
            'Centro',
            ciudad,
            'INTELIMARKET',
            'ACTIVO',
            pts,
            nivel,
            ahorro
        ))

    print(f"-> Sincronizando {len(batch_data)} clientes con sus puntos reales hacia MySQL...")
    upsert_sql = """
        INSERT INTO extraclub_socios (
            numero_socio, documento, nombre_completo, telefono_whatsapp, 
            direccion, barrio, ciudad, origen_normalizacion, estado, 
            puntos_acumulados, nivel_socio, ahorro_acumulado
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE 
            nombre_completo = VALUES(nombre_completo),
            telefono_whatsapp = IF(VALUES(telefono_whatsapp) != '', VALUES(telefono_whatsapp), telefono_whatsapp),
            direccion = IF(VALUES(direccion) != '', VALUES(direccion), direccion),
            ciudad = IF(VALUES(ciudad) != '', VALUES(ciudad), ciudad),
            puntos_acumulados = VALUES(puntos_acumulados),
            nivel_socio = VALUES(nivel_socio),
            ahorro_acumulado = VALUES(ahorro_acumulado);
    """

    with m_conn.cursor() as cur:
        chunk_size = 500
        for i in range(0, len(batch_data), chunk_size):
            chunk = batch_data[i:i+chunk_size]
            cur.executemany(upsert_sql, chunk)
            m_conn.commit()

        # [3/3] Sincronización Inversa: Leer nuevos registros web para llevarlos a PostgreSQL
        cur.execute("SELECT documento, nombre_completo, telefono_whatsapp, direccion, ciudad FROM extraclub_socios WHERE origen_normalizacion = 'WEB_REGISTER'")
        web_registers = cur.fetchall()

    m_conn.close()

    if web_registers:
        print(f"[3/3] Sincronizando {len(web_registers)} registros nuevos de la web hacia Intelimarket...")
        async with engine.begin() as conn:
            for w in web_registers:
                w_doc = w['documento']
                w_nom = w['nombre_completo']
                w_tel = w['telefono_whatsapp']
                w_dir = w['direccion']
                w_ciu = w['ciudad']
                await conn.execute(text("""
                    INSERT INTO customers (
                        company_id, tipo, ruc, razon_social, nombre_fantasia, 
                        direccion, telefono, ciudad, activo, extra_club_numero
                    ) VALUES (
                        '00000000-0000-0000-0000-000000000010', 'FISICA', :ruc, :nombre, :nombre,
                        :dir, :tel, :ciudad, true, :ec_num
                    )
                    ON CONFLICT (ruc) DO UPDATE SET 
                        telefono = EXCLUDED.telefono,
                        direccion = EXCLUDED.direccion;
                """), {
                    'ruc': w_doc,
                    'nombre': w_nom,
                    'dir': w_dir,
                    'tel': w_tel,
                    'ciudad': w_ciu,
                    'ec_num': f"EC-{int(w_doc):08d}" if w_doc.isdigit() else f"EC-{w_doc}"
                })

    print("SYNC_SUCCESS: Clientes y Puntos Reales sincronizados bidireccionalmente al 100%.")

if __name__ == '__main__':
    asyncio.run(sync())
