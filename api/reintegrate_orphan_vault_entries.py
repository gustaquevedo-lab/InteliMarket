import asyncio
from decimal import Decimal
import uuid
from sqlalchemy import select, func
from api.src.db import async_session_factory
from api.src.caja.models import VaultEntry, CashRegisterMovement

TARGET_ORPHAN_TX_IDS = [
    uuid.UUID("adcdca3e-4dc0-4c5b-a03d-a90ca6b3e70e"),  # Boleta #42475275 (02/10)
    uuid.UUID("3945da16-f4ac-4081-ad57-e1dcae13298a"),  # Boleta #42475277 (05/10)
]

TARGET_MOVEMENT_IDS = [
    uuid.UUID("8a0fe345-ba6b-47a1-b35d-91add45b951c"),  # Retiro Boleta #42475275
    uuid.UUID("e72dcad6-6587-4231-a8fa-d79c1d1eadbd"),  # Retiro Boleta #42475277
]


async def reintegrate():
    async with async_session_factory() as db:
        print("=== REINTEGRACIÓN DE ENTRADAS HUÉRFANAS A BÓVEDA ===")

        # 1. Consultar saldo actual de bóveda
        saldo_antes_res = await db.execute(
            select(func.coalesce(func.sum(VaultEntry.monto_pyg), 0))
            .where(VaultEntry.estado == "en_boveda")
        )
        saldo_antes = Decimal(str(saldo_antes_res.scalar() or 0))
        print(f"Saldo actual en Bóveda (antes): ₲ {saldo_antes:,.0f}")

        # 2. Consultar las entradas huérfanas
        entries_res = await db.execute(
            select(VaultEntry).where(
                VaultEntry.bank_transaction_id.in_(TARGET_ORPHAN_TX_IDS),
                VaultEntry.estado == "depositado",
            ).order_by(VaultEntry.created_at.asc())
        )
        entries = list(entries_res.scalars().all())
        print(f"Entradas huérfanas detectadas: {len(entries)}")

        reintegradas_pyg = Decimal("0")
        fusionadas = 0
        restauradas = 0

        for ve in entries:
            monto_ve = Decimal(str(ve.monto_pyg or 0))
            reintegradas_pyg += monto_ve

            if ve.handoff_id:
                # Buscar si existe sobre activo en bóveda con el mismo handoff_id
                parent_res = await db.execute(
                    select(VaultEntry).where(
                        VaultEntry.handoff_id == ve.handoff_id,
                        VaultEntry.id != ve.id,
                        VaultEntry.company_id == ve.company_id,
                        VaultEntry.estado == "en_boveda",
                    ).order_by(VaultEntry.created_at.asc())
                )
                parent = parent_res.scalars().first()
                if parent:
                    parent.monto_pyg = (parent.monto_pyg or Decimal("0")) + monto_ve
                    if parent.observaciones and "Remanente divisa" in parent.observaciones:
                        parent.observaciones = (
                            f"Restaurado en bóveda tras anulación de depósito bancario huérfano. "
                            f"Ref original: {parent.observaciones}"
                        )
                    await db.delete(ve)
                    fusionadas += 1
                    print(f"  [FUSIÓN] Gs. {monto_ve:,.0f} reincorporados al sobre padre {parent.id} (handoff {ve.handoff_id})")
                    continue

            # Entrada sin hermano o sin handoff_id
            ve.estado = "en_boveda"
            ve.bank_transaction_id = None
            ve.fecha_deposito = None
            restauradas += 1
            print(f"  [RESTAURACIÓN] Entrada {ve.id} reactivada en estado 'en_boveda' por Gs. {monto_ve:,.0f}")

        # 3. Eliminar movimientos huérfanos de libro diario
        movs_res = await db.execute(
            select(CashRegisterMovement).where(
                CashRegisterMovement.id.in_(TARGET_MOVEMENT_IDS)
            )
        )
        movs = list(movs_res.scalars().all())
        for m in movs:
            print(f"  [LIBRO DIARIO] Eliminando retiro huérfano {m.id} por Gs. {Decimal(str(m.monto)):,.0f} ({m.observaciones[:40]}...)")
            await db.delete(m)

        await db.commit()

        # 4. Consultar saldo nuevo de bóveda
        saldo_despues_res = await db.execute(
            select(func.coalesce(func.sum(VaultEntry.monto_pyg), 0))
            .where(VaultEntry.estado == "en_boveda")
        )
        saldo_despues = Decimal(str(saldo_despues_res.scalar() or 0))
        print(f"\nTotal Gs. reintegrados: ₲ {reintegradas_pyg:,.0f}")
        print(f"Sobres fusionados con padres: {fusionadas}")
        print(f"Entradas reactivadas independientes: {restauradas}")
        print(f"Saldo final en Bóveda (después): ₲ {saldo_despues:,.0f}")
        print("✓ REINTEGRACIÓN COMPLETADA EXITOSAMENTE")


if __name__ == "__main__":
    asyncio.run(reintegrate())
