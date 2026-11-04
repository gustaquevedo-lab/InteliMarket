"""
Saneamiento de Conciliaciones Indebidas de Noviembre 2026
Regla Contable Estricta:
- Un movimiento del extracto bancario DEBE registrarse en bank_transactions para reflejar el saldo bancario real.
- Pero SOLO puede estar 'conciliado = True' si existe una contrapartida formal registrada en el ERP (Gasto, Factura, OP, Cheque en cartera, Depósito de Bóveda).
- Si NO existe registro en el ERP (como Río Seguros ₲ 2.000.000, transferencias directas sin OP, retenciones o comisiones no cargadas), DEBE permanecer en 'conciliado = False' (Pendiente de Conciliación) para que Tesorería cargue el comprobante correspondiente.
"""
import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

async def corregir():
    async with async_session_factory() as db:
        print("=" * 80)
        print("🔧 SANEAMIENTO DE CONCILIACIONES INDEBIDAS — NOVIEMBRE 2026")
        print("=" * 80)

        # 1. Identificar transacciones sin contraparte en ERP y pasarlas a conciliado = False
        # Interfisa Cta Cte: Rio Seguros (2.000.000), Transf (776.500), Transf (690.000), SIPAP (351.200)
        # Dinelco: 10 créditos de extracto
        # PlugPay: 1 crédito de extracto
        # Interfisa Ahorro: 1 débito y 1 crédito de extracto
        
        # Primero actualizamos las 4 de Interfisa Cta Cte
        res_icte = await db.execute(text("""
            UPDATE bank_transactions
            SET conciliado = false, fecha_conciliacion = null
            WHERE bank_account_id = 'a8835482-cdb6-40d2-9310-1ac67936425b'
              AND fecha >= '2026-11-01'
              AND descripcion NOT ILIKE '%AMROGROUP%'
              AND descripcion NOT ILIKE '%CHACOMER%'
            RETURNING id, fecha, monto, descripcion;
        """))
        rows_icte = res_icte.fetchall()
        print(f"\n✓ Interfisa Cta Cte: {len(rows_icte)} transacciones desmarcadas a PENDIENTES DE CONCILIACIÓN:")
        for r in rows_icte:
            print(f"   - {r.fecha} | Gs. {r.monto:,.0f} | {r.descripcion}")

        # Dinelco (10 créditos de extracto sin calce de lote)
        res_din = await db.execute(text("""
            UPDATE bank_transactions
            SET conciliado = false, fecha_conciliacion = null
            WHERE bank_account_id = 'ad6991e3-281d-49b8-aee7-65a00d421214'
              AND fecha >= '2026-11-01'
            RETURNING id, fecha, monto, descripcion;
        """))
        rows_din = res_din.fetchall()
        print(f"\n✓ Continental Dinelco: {len(rows_din)} transacciones desmarcadas a PENDIENTES:")
        for r in rows_din:
            print(f"   - {r.fecha} | Gs. {r.monto:,.0f} | {r.descripcion}")

        # PlugPay (1 crédito de extracto sin calce)
        res_plug = await db.execute(text("""
            UPDATE bank_transactions
            SET conciliado = false, fecha_conciliacion = null
            WHERE bank_account_id = '2fe1c1ec-d3c8-4446-ab85-5239a4418e1c'
              AND fecha >= '2026-11-01'
            RETURNING id, fecha, monto, descripcion;
        """))
        rows_plug = res_plug.fetchall()
        print(f"\n✓ Continental PlugPay: {len(rows_plug)} transacciones desmarcadas a PENDIENTES:")
        for r in rows_plug:
            print(f"   - {r.fecha} | Gs. {r.monto:,.0f} | {r.descripcion}")

        # Interfisa Ahorro (1 débito y 1 crédito sin calce)
        res_iah = await db.execute(text("""
            UPDATE bank_transactions
            SET conciliado = false, fecha_conciliacion = null
            WHERE bank_account_id = '3b7d6fb5-0b21-4b94-b793-4d0f88d7e51a'
              AND fecha >= '2026-11-01'
            RETURNING id, fecha, monto, descripcion;
        """))
        rows_iah = res_iah.fetchall()
        print(f"\n✓ Interfisa Ahorro: {len(rows_iah)} transacciones desmarcadas a PENDIENTES:")
        for r in rows_iah:
            print(f"   - {r.fecha} | Gs. {r.monto:,.0f} | {r.descripcion}")

        await db.commit()
        tot_corregidas = len(rows_icte) + len(rows_din) + len(rows_plug) + len(rows_iah)
        print("\n" + "=" * 80)
        print(f"🎯 TOTAL TRANSACCIONES SANEADAS A PENDIENTES: {tot_corregidas}")
        print("=" * 80)

if __name__ == "__main__":
    asyncio.run(corregir())
