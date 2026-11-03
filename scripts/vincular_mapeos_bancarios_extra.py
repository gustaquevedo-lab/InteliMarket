"""
Script Canónico para Vincular Cuentas Bancarias a los Medios de Pago Electrónicos.
InteliMarket - Extra Supermercado (00000000-0000-0000-0000-000000000010)

Mapeos asignados:
1. Red Bancard (Crédito, Débito, QR, PIX) -> Banco Interfisa Ahorro (259026699)
2. Red Dinelco (Crédito, Débito, QR, PIX, Adelanto) -> Banco Continental Dinelco (38250039706001)
3. PlugPay / PIX Brasil -> Banco Continental PlugPay (38250039706208)
4. Transferencias Bancarias SIPAP -> Banco Interfisa Cta Cte (259058910)
"""
import asyncio
import uuid
from decimal import Decimal
from sqlalchemy import select, update
from api.src.db import async_session_factory
from api.src.financial.models import BankAccount
from api.src.caja.models import PaymentMethodBankMapping

COMPANY_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")

CUENTAS_DESTINO = {
    "INTERFISA_AHORRO": "259026699",
    "CONTINENTAL_DINELCO": "38250039706001",
    "CONTINENTAL_PLUGPAY": "38250039706208",
    "INTERFISA_CTE": "259058910",
    "CONTINENTAL_CTE": "382364779308",
}

CANAL_TO_CUENTA = {
    # Bancard
    "BANCARD_CREDITO": ("INTERFISA_AHORRO", Decimal("2.80"), 2, "habiles"),
    "BANCARD_DEBITO": ("INTERFISA_AHORRO", Decimal("1.50"), 1, "habiles"),
    "BANCARD_QR": ("INTERFISA_AHORRO", Decimal("0.80"), 1, "habiles"),
    "BANCARD_PIX": ("INTERFISA_AHORRO", Decimal("1.20"), 0, "habiles"),
    "TARJETA_BANCARD": ("INTERFISA_AHORRO", Decimal("1.50"), 1, "habiles"),
    
    # Dinelco
    "DINELCO_CREDITO": ("CONTINENTAL_DINELCO", Decimal("2.80"), 2, "habiles"),
    "DINELCO_DEBITO": ("CONTINENTAL_DINELCO", Decimal("1.50"), 1, "habiles"),
    "DINELCO_QR": ("CONTINENTAL_DINELCO", Decimal("0.80"), 1, "habiles"),
    "DINELCO_PIX": ("CONTINENTAL_DINELCO", Decimal("1.20"), 0, "habiles"),
    "ADELANTO_DINELCO": ("CONTINENTAL_DINELCO", Decimal("0.00"), 1, "habiles"),
    "TARJETA_DINELCO": ("CONTINENTAL_DINELCO", Decimal("1.50"), 1, "habiles"),
    
    # PlugPay
    "PLUGPAY_PIX": ("CONTINENTAL_PLUGPAY", Decimal("1.20"), 0, "habiles"),
    "PLUGPAY_CREDITO": ("CONTINENTAL_PLUGPAY", Decimal("2.80"), 2, "habiles"),
    "PIX": ("CONTINENTAL_PLUGPAY", Decimal("1.20"), 0, "habiles"),
    
    # SIPAP
    "TRANSFERENCIA": ("INTERFISA_CTE", Decimal("0.00"), 0, "habiles"),
}


async def main():
    async with async_session_factory() as db:
        # 1. Obtener cuentas bancarias
        q_accs = await db.execute(select(BankAccount).where(BankAccount.company_id == COMPANY_ID))
        accounts_by_num = {acc.numero_cuenta: acc for acc in q_accs.scalars().all()}
        print(f"Cuentas bancarias cargadas: {len(accounts_by_num)}")
        for num, acc in accounts_by_num.items():
            print(f"  - {acc.banco} ({acc.numero_cuenta}): {acc.id}")

        cuenta_ids = {}
        for alias, num in CUENTAS_DESTINO.items():
            if num in accounts_by_num:
                cuenta_ids[alias] = accounts_by_num[num].id
            else:
                print(f"ALERTA: Cuenta {alias} ({num}) no encontrada en DB!")

        # 2. Consultar mapeos actuales
        q_maps = await db.execute(
            select(PaymentMethodBankMapping).where(PaymentMethodBankMapping.company_id == COMPANY_ID)
        )
        mappings = list(q_maps.scalars().all())
        print(f"\nMapeos actuales para Extra Supermercado: {len(mappings)}")

        actualizados = 0
        for m in mappings:
            canal = m.canal_key
            if canal in CANAL_TO_CUENTA:
                target_alias, com_pct, plazo_dias, tipo_plazo = CANAL_TO_CUENTA[canal]
                target_id = cuenta_ids.get(target_alias)
                if target_id:
                    m.bank_account_id = target_id
                    m.comision_porcentaje = com_pct
                    m.plazo_acreditacion_dias = plazo_dias
                    m.tipo_plazo = tipo_plazo
                    m.activo = True
                    actualizados += 1
                    print(f"  ✓ {canal} -> {target_alias} ({accounts_by_num[CUENTAS_DESTINO[target_alias]].banco}) | Com: {com_pct}% | D+{plazo_dias} {tipo_plazo}")

        await db.commit()
        print(f"\nTotal de canales vinculados exitosamente: {actualizados}")


if __name__ == "__main__":
    asyncio.run(main())
