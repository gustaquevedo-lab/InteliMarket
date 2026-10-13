import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

async def check_evelin_sales():
    async with async_session_factory() as db:
        print("=== AUDITORIA EXHAUSTIVA DE EVELIN HERRERO ===")

        # 1. Sesiones de Evelin
        res_sess = await db.execute(text("""
            SELECT cs.id, cs.register_id, cr.nombre as caja_nombre, cr.codigo as caja_codigo,
                   cs.user_id, cs.cajero_nombre, cs.monto_apertura, cs.fecha_apertura, cs.fecha_cierre, cs.estado
            FROM cash_sessions cs
            JOIN cash_registers cr ON cs.register_id = cr.id
            WHERE cs.cajero_nombre ILIKE '%evelin%' OR cs.user_id IN (
                SELECT id FROM users WHERE nombre ILIKE '%evelin%' OR email ILIKE '%evelin%'
            )
            ORDER BY cs.fecha_apertura DESC;
        """))
        sessions = res_sess.fetchall()
        cols_s = list(res_sess.keys())
        print(f"Total sesiones encontradas para Evelin: {len(sessions)}")
        for s in sessions:
            print(dict(zip(cols_s, s)))

        # 2. Ventas en la sesión ACTIVA de Evelin (914e7eaf-23c2-49e6-9ed0-6fa838b9d891)
        res_active_v = await db.execute(text("""
            SELECT s.id, s.numero, s.numero_interno, s.total, s.condicion, s.estado, s.created_at
            FROM sales s
            WHERE s.session_id = '914e7eaf-23c2-49e6-9ed0-6fa838b9d891'
            ORDER BY s.created_at ASC;
        """))
        active_sales = res_active_v.fetchall()
        print(f"\n--- VENTAS EN LA SESIÓN ACTIVA ACTUAL ({len(active_sales)} ventas) ---")
        sandbox_in_active = 0
        real_in_active = 0
        for sa in active_sales:
            num = str(sa[1] or "")
            if num.startswith("001-013-"):
                real_in_active += 1
                print(f"   [FISCAL REAL] Factura {sa[1]} | Venta #{sa[2]} | Total: {sa[3]:,.0f} Gs | Hora: {sa[6].strftime('%H:%M:%S')}")
            else:
                sandbox_in_active += 1
                print(f"   ⚠️ [SANDBOX/OTRO] Numero: {sa[1]} | Venta #{sa[2]} | Total: {sa[3]:,.0f} Gs | Hora: {sa[6].strftime('%H:%M:%S')}")

        print(f"\nResumen sesión activa de Evelin: {real_in_active} Fiscales Reales | {sandbox_in_active} Sandbox")

        # 3. Verificar si hay alguna venta en todo el sistema con user_id de Evelin que sea sandbox
        res_all_user_sales = await db.execute(text("""
            SELECT s.id, s.numero, s.session_id, s.total, s.created_at
            FROM sales s
            WHERE s.user_id IN (SELECT id FROM users WHERE nombre ILIKE '%evelin%' OR email ILIKE '%evelin%')
              AND (s.numero NOT LIKE '001-%' OR s.numero IS NULL)
              AND s.created_at >= '2026-08-31 00:00:00';
        """))
        sandbox_user_sales = res_all_user_sales.fetchall()
        print(f"\nVentas sandbox de hoy creadas con el usuario de Evelin en general: {len(sandbox_user_sales)}")
        for sa in sandbox_user_sales:
            print(f"   • ID: {sa[0]} | Numero: {sa[1]} | Session: {sa[2]} | Total: {sa[3]:,.0f} Gs | Hora: {sa[4]}")

asyncio.run(check_evelin_sales())
