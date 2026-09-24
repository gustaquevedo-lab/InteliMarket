import asyncio
import asyncpg
from zoneinfo import ZoneInfo
from datetime import datetime

TZ = ZoneInfo('America/Asuncion')

async def main():
    conn = await asyncpg.connect('postgresql://intelimarket:password@localhost:5432/intelimarket')
    
    sessions = await conn.fetch('''
        SELECT 
            cs.id, cs.user_id, cs.cajero_nombre, cr.nombre as caja_nombre, cr.codigo as caja_codigo,
            cs.estado, cs.monto_apertura, cs.monto_apertura_brl, cs.monto_apertura_usd,
            cs.fecha_apertura, cs.fecha_cierre, cs.monto_cierre, cs.observaciones,
            u.rol as user_rol
        FROM cash_sessions cs
        JOIN cash_registers cr ON cr.id = cs.register_id
        LEFT JOIN users u ON u.id = cs.user_id
        WHERE (cs.fecha_apertura AT TIME ZONE 'America/Asuncion')::date = '2026-09-06'
        ORDER BY cs.fecha_apertura ASC
    ''')
    
    print(f"=== SESIONES DE CAJA REGISTRADAS HOY (06/09/2026): {len(sessions)} ===\n")
    
    for s in sessions:
        sid = s['id']
        fa_py = s['fecha_apertura'].astimezone(TZ).strftime('%H:%M:%S')
        fc_py = s['fecha_cierre'].astimezone(TZ).strftime('%H:%M:%S') if s['fecha_cierre'] else 'EN CURSO'
        
        sales_summary = await conn.fetchrow('''
            SELECT 
                count(id) as total_tickets,
                coalesce(sum(total), 0) as total_cobrado,
                array_agg(DISTINCT substring(numero from 5 for 3)) as puntos_emision,
                array_agg(DISTINCT user_id::text) as usuarios_en_ventas
            FROM sales
            WHERE session_id = $1 AND estado IN ('confirmado', 'completada', 'completado', 'pagado')
        ''', sid)
        
        payments = await conn.fetch('''
            SELECT sp.forma_pago, sp.moneda, count(*), coalesce(sum(sp.monto), 0) as total_monto
            FROM sale_payments sp
            JOIN sales s ON s.id = sp.sale_id
            WHERE s.session_id = $1 AND s.estado IN ('confirmado', 'completada', 'completado', 'pagado')
            GROUP BY sp.forma_pago, sp.moneda
            ORDER BY sum(sp.monto) DESC
        ''', sid)
        
        count_row = await conn.fetchrow('''
            SELECT monto_efectivo, monto_efectivo_brl, monto_efectivo_usd, monto_total, diferencia
            FROM cash_counts
            WHERE session_id = $1
            ORDER BY created_at DESC LIMIT 1
        ''', sid)
        
        print(f"🔹 ID: {str(sid)[:8].upper()} | Cajero/a: {s['cajero_nombre']} (Rol: {s['user_rol']})")
        print(f"   Terminal: {s['caja_nombre']} ({s['caja_codigo']}) | Estado: {s['estado']}")
        print(f"   Horario (PY): {fa_py} -> {fc_py}")
        brl_ap = s['monto_apertura_brl'] or 0
        usd_ap = s['monto_apertura_usd'] or 0
        print(f"   Apertura: PYG {s['monto_apertura']:,.0f} | BRL {brl_ap:,.2f} | USD {usd_ap:,.2f}")
        print(f"   Tickets cobrados: {sales_summary['total_tickets']} | Total recaudado: PYG {sales_summary['total_cobrado']:,.0f}")
        print(f"   Puntos de emision en ventas: {sales_summary['puntos_emision']}")
        print(f"   Usuarios en ventas: {sales_summary['usuarios_en_ventas']}")
        
        p_list = [f"{p['forma_pago']} ({p['moneda']}): {p['total_monto']:,.0f}" for p in payments]
        print(f"   Medios de pago: {', '.join(p_list) if p_list else 'Sin cobros'}")
        
        if count_row:
            brl_c = count_row['monto_efectivo_brl'] or 0
            print(f"   Arqueo Declarado: PYG {count_row['monto_efectivo']:,.0f} | BRL {brl_c:,.2f} | Dif Consolidada: PYG {count_row['diferencia']:,.0f}")
        print("-" * 70)
        
    # Verificar si hubo ventas hoy que NO tienen session_id o tienen session_id fuera de hoy
    orphan_sales = await conn.fetchrow('''
        SELECT 
            count(id) as huerfanas,
            coalesce(sum(total), 0) as total_huerfano
        FROM sales
        WHERE (fecha AT TIME ZONE 'America/Asuncion')::date = '2026-09-06'
          AND estado IN ('confirmado', 'completada', 'completado', 'pagado')
          AND session_id IS NULL
    ''')
    print(f"\n🔍 Ventas huérfanas hoy (session_id IS NULL): {orphan_sales['huerfanas']} (Total: PYG {orphan_sales['total_huerfano']:,.0f})")

    # Verificar ventas totales hoy
    total_sales_today = await conn.fetchrow('''
        SELECT 
            count(id) as total_tickets,
            coalesce(sum(total), 0) as total_facturado
        FROM sales
        WHERE (fecha AT TIME ZONE 'America/Asuncion')::date = '2026-09-06'
          AND estado IN ('confirmado', 'completada', 'completado', 'pagado')
    ''')
    print(f"📊 Ventas totales emitidas hoy en el supermercado: {total_sales_today['total_tickets']} tickets (Total: PYG {total_sales_today['total_facturado']:,.0f})")

    await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
