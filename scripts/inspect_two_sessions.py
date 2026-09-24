import asyncio
from api.src.db import async_session_factory
from api.src.caja.service import get_session_reconciliation_data

async def inspect(sid, name):
    async with async_session_factory() as db:
        res = await get_session_reconciliation_data(db, sid)
        if not res:
            print(f"No se encontro sesion {sid}")
            return
        print(f"=== INSPECCION DETALLADA: {name} ({sid}) ===")
        print(f"Total Ventas Cobradas: PYG {res['total_cobrado_gs']:,.0f}")
        print(f"Ventas Efectivo Total Gs: PYG {res['ventas_ef_total_gs']:,.0f}")
        print(f"Fondo Pyg: {res['fondo_pyg']:,.0f} | Fondo Brl: {res['fondo_brl']} | Fondo Total Gs: {res['fondo_total_gs']:,.0f}")
        print(f"Total Drops / Retiros Gs: {res['total_drops_gs']:,.0f}")
        print(f"Total Esperado Gaveta: PYG {res['esperado_total_gs']:,.0f}")
        print(f"Total Contado Gaveta: PYG {res['contado_total_gs']:,.0f} (Pyg: {res['contado_pyg']:,.0f}, Brl: {res['contado_brl']})")
        print(f"Diferencia Consolidada: PYG {res['diferencia_consolidada_gs']:,.0f}")
        print("Terminales operadas:", res.get("terminales_operadas"))
        print("Medios de pago:")
        for m in res["medios_pago_detallados"]:
            print(f"  {m['label']}: {m['monto_formateado']}")
        print()

async def main():
    await inspect("0b798186-0a17-4482-a55f-e47238486729", "ZUNILDA")
    await inspect("16f7a374-8add-41f3-bd20-c960a6c3cf1b", "MARISTELA")

if __name__ == "__main__":
    asyncio.run(main())
