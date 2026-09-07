import asyncio, asyncpg, uuid

async def check_liz():
    conn = await asyncpg.connect('postgresql://intelimarket:password@localhost:5432/intelimarket')
    sid = uuid.UUID('b3cf7fa8-dba3-4859-90d6-4bbac9e72f1c')
    
    sess = await conn.fetchrow('SELECT * FROM cash_sessions WHERE id = $1', sid)
    reg_id = sess['register_id']
    f_ape = sess['fecha_apertura']
    f_cie = sess['fecha_cierre']
    
    movs = await conn.fetch('''
        SELECT * FROM cash_register_movements
        WHERE register_id = $1 AND fecha BETWEEN $2 AND $3
    ''', reg_id, f_ape, f_cie)
    print('MOVS IN RANGE:', [dict(m) for m in movs])
    
    all_movs = await conn.fetch('''
        SELECT * FROM cash_register_movements
        WHERE fecha::date = '2026-08-31'
    ''')
    print('ALL MOVS 31/08:', [dict(m) for m in all_movs])
    
    # ¿Y qué tenía antes el registro en CashCount de diferencia?
    # Originalmente antes de nuestro script, ¿qué diferencia tenía?
    # En la terminal al principio vimos:
    # "2026-08-31 10:35 LIZ CENTURION ID: b3cf7fa8 Ape: 500000.0 ApeBRL: 0.0 CntPYG: 8167173.0 CntBRL: 942.0 DifPYG: -2354.0 DifBRL: 1.56"
    # ¡DifPYG era -2.354! ¿Por qué era -2.354 si cobró 13.402.542 y contó 8.167.173?
    # ¿De dónde salía -2.354?
    # 500.000 + ? = 8.167.173 - (-2.354) = 8.169.527.
    # 8.169.527 - 500.000 = 7.669.527 cobrado en efectivo.
    # Pero en sales_payments tenemos 13.402.542.
    # ¿Será que hubo ventas canceladas o sincronizadas dobles?
    sales = await conn.fetch('''
        SELECT estado, count(*), sum(total)
        FROM sales
        WHERE session_id = $1
        GROUP BY estado
    ''', sid)
    print('SALES BY ESTADO:', [dict(s) for s in sales])
    
    await conn.close()

if __name__ == '__main__':
    asyncio.run(check_liz())
