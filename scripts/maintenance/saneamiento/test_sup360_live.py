import asyncio, uuid
from api.src.db import async_session_factory
from api.src.purchases.supplier_360_service import get_supplier_360
from sqlalchemy import text

async def check():
    async with async_session_factory() as session:
        res = await session.execute(text("SELECT id, razon_social FROM suppliers WHERE razon_social ILIKE '%GONZALITO%'"))
        sup = res.fetchone()
        print('=== TEST PROVEEDOR 360 PARA:', sup[1], '===')
        
        cid = uuid.UUID('00000000-0000-0000-0000-000000000010')
        data = await get_supplier_360(session, cid, sup[0])
        kpis = data['kpis']
        print('--- KPIS CHEQUES DIFERIDOS ---')
        print(f"Cheques diferidos pendientes monto: Gs. {kpis['cheques_diferidos_pendientes_monto']:,.0f}")
        print(f"Cheques diferidos pendientes count: {kpis['cheques_diferidos_pendientes_count']}")
        print(f"Cheques compensados/cobrados monto: Gs. {kpis['cheques_compensados_monto']:,.0f}")
        print(f"Exposición financiera total: Gs. {kpis['exposicion_financiera_total']:,.0f}")
        print(f"Total cheques en listado 360: {len(data['cheques'])}")
        
        pend = [c for c in data['cheques'] if c['estado'] == 'pendiente']
        print(f"\nMuestra de cheques diferidos pendientes ({len(pend)}):")
        for p in pend[:5]:
            print(f"   Nº {p['numero']} | Vence: {p['fecha_pago']} ({p['dias_restantes']}d) | Gs. {p['monto']:,.0f}")

if __name__ == '__main__':
    asyncio.run(check())
