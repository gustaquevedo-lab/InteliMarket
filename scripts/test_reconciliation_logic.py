import asyncio, asyncpg

async def test_reconciliation():
    conn = await asyncpg.connect('postgresql://intelimarket:password@localhost:5432/intelimarket')
    
    sessions = await conn.fetch('''
        SELECT cs.id, cs.register_id, cs.cajero_nombre, cs.fecha_apertura, cs.fecha_cierre,
               cs.monto_apertura, cs.monto_apertura_brl, cs.monto_apertura_usd,
               cs.monto_cierre, cc.monto_efectivo, cc.monto_efectivo_brl, cc.monto_efectivo_usd,
               cc.diferencia, cc.diferencia_brl, cc.diferencia_usd
        FROM cash_sessions cs
        JOIN cash_counts cc ON cs.id = cc.session_id
        WHERE cs.fecha_apertura >= '2026-08-31'
        ORDER BY cs.fecha_apertura ASC;
    ''')
    
    print(f"{'FECHA':11} | {'CAJERO':18} | {'TASA':4} | {'ANT DIF GS':11} | {'ANT DIF BRL':11} | {'BRL EN GS':11} | {'CONSOLIDADA GS':14}")
    print("-" * 95)
    for s in sessions:
        sid = s['id']
        rate_row = await conn.fetchrow('''
            SELECT round((s.total / NULLIF(sp.monto, 0))::numeric, 0) as tasa, count(*) as cnt
            FROM sales s
            JOIN sale_payments sp ON s.id = sp.sale_id
            WHERE s.session_id = $1 AND sp.moneda = 'BRL' AND sp.monto > 0 AND (s.total / sp.monto) BETWEEN 900 AND 1500
            GROUP BY round((s.total / NULLIF(sp.monto, 0))::numeric, 0)
            ORDER BY count(*) DESC
            LIMIT 1;
        ''', sid)
        tasa_brl = float(rate_row['tasa']) if rate_row else 1105.0
        
        ant_dif_gs = float(s['diferencia'] or 0)
        ant_dif_brl = float(s['diferencia_brl'] or 0)
        ant_dif_usd = float(s['diferencia_usd'] or 0)
        
        brl_en_gs = ant_dif_brl * tasa_brl
        
        diferencia_consolidada_gs = ant_dif_gs + brl_en_gs
        
        cajero = (s['cajero_nombre'] or '—')[:18]
        fecha_str = s['fecha_apertura'].strftime('%d/%m %H:%M')
        
        print(f"{fecha_str:11} | {cajero:18} | {tasa_brl:4.0f} | {ant_dif_gs:+11,.0f} | {ant_dif_brl:+11.2f} | {brl_en_gs:+11,.0f} | {diferencia_consolidada_gs:+14,.0f}")
        
    await conn.close()

if __name__ == "__main__":
    asyncio.run(test_reconciliation())
