"""
Ajuste de Arqueo Físico en Bóveda Central (Tesorería)
Saldo objetivo indicado por Gerencia: Gs. 2.317.862
"""
import asyncio
import uuid
from decimal import Decimal
from sqlalchemy import text
from api.src.db import async_session_factory
from api.src.caja.service import _deduct_from_vault_fifo, get_vault_dashboard

async def main():
    async with async_session_factory() as db:
        cid = uuid.UUID("00000000-0000-0000-0000-000000000010")
        
        # 1. Corregir e7e0776a (remanente de divisa que duplicó el monto_pyg de Tomasa)
        await db.execute(text("""
            UPDATE vault_entries 
            SET monto_pyg = 0 
            WHERE id = 'e7e0776a-2227-4b8c-b144-10d09cf856f8';
        """))
        
        # 2. Calcular monto actual disponible en PYG
        res_pyg = await db.execute(text("""
            SELECT COALESCE(SUM(monto_pyg), 0) 
            FROM vault_entries 
            WHERE company_id = :cid AND estado = 'en_boveda';
        """), {"cid": cid})
        saldo_actual = Decimal(str(res_pyg.scalar() or 0))
        target = Decimal("2317862")
        diferencia = saldo_actual - target
        print(f"Saldo PYG antes de ajuste: Gs. {saldo_actual:,.0f}")
        print(f"Saldo Objetivo Real:       Gs. {target:,.0f}")
        print(f"Diferencia a deducir:      Gs. {diferencia:,.0f}")
        
        if diferencia > 0:
            await _deduct_from_vault_fifo(
                db=db,
                company_id=cid,
                monto_pyg=diferencia,
                monto_brl=Decimal("0"),
                estado_terminal="ajuste",
                observaciones="Ajuste de arqueo físico en Bóveda Central (Saldo Real ₲ 2.317.862)",
                user_id=None
            )
            print(f"✓ Deducidos Gs. {diferencia:,.0f} vía FIFO en vault_entries")
        
        await db.commit()
        
        # Verificar nuevo estado
        dash = await get_vault_dashboard(db, str(cid))
        print("\n" + "="*60)
        print("ESTADO FINAL DE BÓVEDA CENTRAL:")
        print(f"  Saldo en Bóveda PYG: Gs. {dash['saldo_en_boveda_pyg']:,.0f}")
        print(f"  Saldo en Bóveda USD: US$ {dash['saldo_en_boveda_usd']:,.2f}")
        print(f"  Saldo en Bóveda BRL: R$ {dash['saldo_en_boveda_brl']:,.2f}")
        print("="*60)

if __name__ == "__main__":
    asyncio.run(main())
