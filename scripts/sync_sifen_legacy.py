"""
ETL de Sincronización SIFEN Legacy Ultra-Rápido con asyncpg + pymysql
"""
import asyncio
import time
from datetime import datetime, timezone
import pymysql
import asyncpg

MYSQL_CONFIG = {
    'host': '127.0.0.1',
    'user': 'etl',
    'password': 'etl',
    'database': 'columbia',
    'charset': 'utf8mb4',
    'cursorclass': pymysql.cursors.DictCursor
}

PG_DSN = 'postgresql://intelimarket:intelimarket_dev@localhost:5432/intelimarket'

async def main():
    print("🚀 Iniciando Sincronización SIFEN Legacy (Ultra-Rápida)...")
    t0 = time.time()

    pg_conn = await asyncpg.connect(PG_DSN)

    # 1. Asegurar esquema
    print("📦 Asegurando columnas e índices en PostgreSQL...")
    await pg_conn.execute("ALTER TABLE sales ADD COLUMN IF NOT EXISTS factura_numero VARCHAR(30);")
    await pg_conn.execute("ALTER TABLE sales ADD COLUMN IF NOT EXISTS link_qr VARCHAR(1000);")
    await pg_conn.execute("ALTER TABLE sales ADD COLUMN IF NOT EXISTS timbrado VARCHAR(20);")
    await pg_conn.execute("ALTER TABLE sales ADD COLUMN IF NOT EXISTS codigo_hash VARCHAR(100);")
    await pg_conn.execute("CREATE INDEX IF NOT EXISTS idx_sales_cdc ON sales(cdc);")
    await pg_conn.execute("CREATE INDEX IF NOT EXISTS idx_sales_factura_num ON sales(factura_numero);")
    await pg_conn.execute("CREATE INDEX IF NOT EXISTS idx_sales_sifen_estado ON sales(sifen_estado);")

    await pg_conn.execute("""
        CREATE TABLE IF NOT EXISTS credit_notes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000010',
            branch_id UUID,
            customer_id UUID,
            sale_id UUID,
            numero VARCHAR(30) NOT NULL,
            factura_numero VARCHAR(30),
            factura_referencia VARCHAR(30),
            fecha TIMESTAMP WITH TIME ZONE NOT NULL,
            concepto VARCHAR(255),
            monto NUMERIC(18,2) NOT NULL DEFAULT 0,
            iva_10 NUMERIC(18,2) DEFAULT 0,
            iva_5 NUMERIC(18,2) DEFAULT 0,
            exentas NUMERIC(18,2) DEFAULT 0,
            cdc VARCHAR(50),
            link_qr VARCHAR(1000),
            timbrado VARCHAR(20) DEFAULT '17090459',
            codigo_hash VARCHAR(100),
            sifen_estado VARCHAR(30) DEFAULT 'aprobado',
            sifen_fecha_respuesta TIMESTAMP WITH TIME ZONE,
            vendedor_codigo VARCHAR(20),
            vendedor_nombre VARCHAR(150),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    """)
    await pg_conn.execute("CREATE INDEX IF NOT EXISTS idx_nc_cdc ON credit_notes(cdc);")
    await pg_conn.execute("CREATE INDEX IF NOT EXISTS idx_nc_numero ON credit_notes(numero);")
    await pg_conn.execute("CREATE INDEX IF NOT EXISTS idx_nc_fecha ON credit_notes(fecha);")

    # 2. Conectar a MySQL
    my_conn = pymysql.connect(**MYSQL_CONFIG)
    my_cur = my_conn.cursor()

    # 3. Sincronizar Notas de Crédito
    print("🔄 Sincronizando Notas de Crédito (In-Memory Map)...")
    my_cur.execute("""
        SELECT NUMFAC, CDC, LINKQR, NUMEROTIMBRADO, CODIGOHASH, FECHAFIRMA 
        FROM feenvios 
        WHERE NUMFAC LIKE 'NC%' AND CDC IS NOT NULL AND CDC != '0';
    """)
    nc_fe_rows = my_cur.fetchall()
    nc_fe_map = {}
    for r in nc_fe_rows:
        num = str(r['NUMFAC']).replace('NC', '').strip()
        nc_fe_map[num] = r
    print(f"   -> Encontrados {len(nc_fe_map):,} CDCs de Notas de Crédito")

    my_cur.execute("""
        SELECT 
            IDNOTACREDITO,
            NUMNOTACRED,
            NUMFAC as FAC_REFERENCIA,
            FECHA,
            HORA,
            CONCEPTO,
            MONTO,
            IDCLIENTE,
            IDVENDEDOR
        FROM notacredito
    """)
    nc_rows = my_cur.fetchall()
    print(f"   -> Encontradas {len(nc_rows):,} Notas de Crédito en total")

    await pg_conn.execute("TRUNCATE TABLE credit_notes;")
    nc_data = []
    for r in nc_rows:
        num_str = str(r['NUMNOTACRED'])
        fe_info = nc_fe_map.get(num_str) or nc_fe_map.get(str(int(float(num_str)))) if num_str.replace('.', '', 1).isdigit() else None
        
        fecha_val = r['HORA'] or r['FECHA']
        if isinstance(fecha_val, datetime):
            fecha_dt = fecha_val.replace(tzinfo=timezone.utc)
        elif isinstance(fecha_val, str) and fecha_val != '0000-00-00 00:00:00':
            try:
                fecha_dt = datetime.fromisoformat(fecha_val).replace(tzinfo=timezone.utc)
            except:
                fecha_dt = datetime(2026, 1, 1, tzinfo=timezone.utc)
        else:
            fecha_dt = datetime(2026, 1, 1, tzinfo=timezone.utc)

        monto_val = float(r['MONTO'] or 0)
        cdc_val = fe_info['CDC'] if fe_info else None
        link_qr_val = fe_info['LINKQR'] if fe_info else None
        timbrado_val = (fe_info['NUMEROTIMBRADO'] if fe_info else '17090459') or '17090459'
        hash_val = fe_info['CODIGOHASH'] if fe_info else None

        nc_data.append((
            str(r['IDNOTACREDITO']),
            num_str,
            str(r['FAC_REFERENCIA']),
            fecha_dt,
            r['CONCEPTO'] or 'Nota de Crédito SIFEN',
            monto_val,
            monto_val / 11.0 if monto_val > 0 else 0, # IVA 10%
            cdc_val,
            link_qr_val,
            timbrado_val,
            hash_val,
            'aprobado' if cdc_val else 'emitido',
            str(r['IDVENDEDOR']) if r['IDVENDEDOR'] else None
        ))

    await pg_conn.copy_records_to_table(
        'credit_notes',
        records=nc_data,
        columns=[
            'numero', 'factura_numero', 'factura_referencia', 'fecha', 'concepto', 'monto', 'iva_10',
            'cdc', 'link_qr', 'timbrado', 'codigo_hash', 'sifen_estado', 'vendedor_codigo'
        ]
    )
    print(f"✅ {len(nc_data):,} Notas de Crédito importadas con éxito a PostgreSQL.")

    # 4. Verificación de muestra (Factura del PDF de Gustavo)
    sample = await pg_conn.fetchrow("""
        SELECT s.numero, s.factura_numero, s.cdc, s.link_qr, s.total, s.sifen_estado,
               c.razon_social as cliente, c.ruc as cliente_ruc
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE s.numero = '2972675';
    """)
    print("\n🔍 Verificación de muestra (Factura #001-001-0259884):")
    if sample:
        print("   Venta ID:", sample['numero'])
        print("   Factura:", sample['factura_numero'])
        print("   Cliente:", sample['cliente'], f"(RUC: {sample['cliente_ruc']})")
        print("   CDC:", sample['cdc'])
        print("   Link QR:", sample['link_qr'])
        print("   Total Gs:", sample['total'])
        print("   Estado SIFEN:", sample['sifen_estado'])

    sample_nc = await pg_conn.fetchrow("""
        SELECT numero, factura_numero, factura_referencia, cdc, monto, concepto, sifen_estado 
        FROM credit_notes 
        WHERE cdc IS NOT NULL 
        LIMIT 1;
    """)
    print("\n🔍 Verificación de muestra (Nota de Crédito SIFEN):")
    if sample_nc:
        print("   NC Número:", sample_nc['factura_numero'])
        print("   CDC:", sample_nc['cdc'])
        print("   Monto Gs:", sample_nc['monto'])
        print("   Concepto:", sample_nc['concepto'])
        print("   Estado SIFEN:", sample_nc['sifen_estado'])

    await pg_conn.close()
    my_cur.close()
    my_conn.close()

    print(f"\n🎉 Sincronización SIFEN finalizada en {time.time() - t0:.2f}s.")

if __name__ == '__main__':
    asyncio.run(main())
