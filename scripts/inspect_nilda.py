import asyncio
from api.src.db import async_session_factory
from api.src.caja.service import get_session_reconciliation_data

async def main():
    async with async_session_factory() as db:
        res = await get_session_reconciliation_data(db, 'cd9bb35b-027b-4882-af6a-c60f2ee28c3c')
        if not res:
            print("No encontrada")
            return
        print("=== ESTADO ACTUAL CAJA NILDA (EN CURSO) ===")
        print(f"Tickets: {res['total_ventas_count']}")
        print(f"Total Cobrado: PYG {res['total_cobrado_gs']:,.0f}")
        print(f"Fondo Inicial Pyg: {res['fondo_pyg']:,.0f} | Brl: {res['fondo_brl']}")
        print(f"Ventas Efectivo Gs: PYG {res['ventas_ef_total_gs']:,.0f}")
        print(f"Esperado en gaveta Gs: PYG {res['esperado_total_gs']:,.0f}")
        print("Medios de pago:")
        for m in res['medios_pago_detallados']:
            print(f"  {m['label']}: {m['monto_formateado']}")

if __name__ == '__main__':
    asyncio.run(main())
