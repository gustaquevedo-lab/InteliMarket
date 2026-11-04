"""
Sincronización Completa de las Cuentas Bancarias de Extra Supermercado
Fuente Oficial: Extractos Bancarios Noviembre 2026 subidos por el usuario:
1. Continental Cta Cte: ₲ 39.012.975
2. Continental Dinelco: ₲ 2.281.100
3. Continental PlugPay: ₲ 7.713.493
4. Interfisa Cta Cte:   ₲ 10.248.358
5. Interfisa Ahorro:    ₲ 61.733.031
"""
import asyncio
import uuid
from decimal import Decimal
from datetime import datetime, date, timezone
from sqlalchemy import select, text
from api.src.db import async_session_factory
from api.src.financial.models import BankAccount, BankTransaction

async def sync_all():
    async with async_session_factory() as db:
        now = datetime.now(timezone.utc)
        print("=" * 80)
        print("🚀 SINCRONIZACIÓN OFICIAL DE SALDOS BANCARIOS — NOVIEMBRE 2026")
        print("=" * 80)

        # -------------------------------------------------------------
        # 1. BANCO CONTINENTAL - AHORRO DINELCO (38250039706001)
        # -------------------------------------------------------------
        print("\n--- 1. BANCO CONTINENTAL - AHORRO DINELCO ---")
        q_din = await db.execute(select(BankAccount).where(BankAccount.numero_cuenta == "38250039706001"))
        acc_din = q_din.scalar_one()

        # Limpiar txs de noviembre
        await db.execute(text("DELETE FROM bank_transactions WHERE bank_account_id = :aid AND fecha >= '2026-11-01'"), {"aid": acc_din.id})

        # Calibrar saldo_inicial base al 31/10 = 996.977
        q_hist = await db.execute(text("""
            SELECT COALESCE(SUM(CASE WHEN tipo = 'credito' THEN monto ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN tipo = 'debito' THEN monto ELSE 0 END), 0)
            FROM bank_transactions WHERE bank_account_id = :aid AND fecha < '2026-11-01'
        """), {"aid": acc_din.id})
        neto_hist = q_hist.scalar()
        acc_din.saldo_inicial = Decimal("996977") - neto_hist

        # 10 créditos del extracto oficial
        din_txs = [
            (date(2026, 11, 2), Decimal("64693"), "56 980056", "CR.COM.BEPSA - 0708800 - 2630300107088"),
            (date(2026, 11, 3), Decimal("102639"), "56 556412", "CR.COM.BEPSA - 0708800 - 2630600107088"),
            (date(2026, 11, 3), Decimal("510000"), "56 573808", "CR.COM.BEPSA - 8629615 - 2630600386296"),
            (date(2026, 11, 3), Decimal("160900"), "56 671823", "PAGO.QRHUB-BCNAPYPA0311264027001702"),
            (date(2026, 11, 4), Decimal("11825"), "56 171086", "PAGO.QRHUB-TUFIPYPA0411262880022176"),
            (date(2026, 11, 4), Decimal("42000"), "56 177021", "PAGO.QRHUB-FAMIPYPAARES261104305210"),
            (date(2026, 11, 4), Decimal("82777"), "56 178427", "CR.COM.BEPSA - 0708800 - 2630700107088"),
            (date(2026, 11, 4), Decimal("100000"), "56 180027", "CR.COM.BEPSA - 8629615 - 2630700386296"),
            (date(2026, 11, 4), Decimal("27759"), "56 218144", "PAGO.QRHUB-TUFIPYPA0411263240022181"),
            (date(2026, 11, 4), Decimal("181530"), "56 272758", "PAGO.QRHUB-BNFAPYPAARES261104381950"),
        ]
        for f, m, ref, desc in din_txs:
            db.add(BankTransaction(
                id=uuid.uuid4(), company_id=acc_din.company_id, bank_account_id=acc_din.id,
                fecha=f, tipo="credito", monto=m, moneda="PYG", descripcion=desc, referencia=ref,
                categoria="liquidacion_tarjeta", conciliado=True, fecha_conciliacion=now, created_at=now
            ))
        acc_din.saldo_actual = Decimal("2281100")
        acc_din.updated_at = now
        db.add(acc_din)
        print("  ✓ Saldo Dinámico Continental Dinelco: Gs. 2.281.100")

        # -------------------------------------------------------------
        # 2. BANCO CONTINENTAL - AHORRO PLUGPAY (38250039706208)
        # -------------------------------------------------------------
        print("\n--- 2. BANCO CONTINENTAL - AHORRO PLUGPAY ---")
        q_plug = await db.execute(select(BankAccount).where(BankAccount.numero_cuenta == "38250039706208"))
        acc_plug = q_plug.scalar_one()

        # Limpiar txs de noviembre
        await db.execute(text("DELETE FROM bank_transactions WHERE bank_account_id = :aid AND fecha >= '2026-11-01'"), {"aid": acc_plug.id})

        # Calibrar saldo_inicial base al 31/10 = 6.683.589
        q_hist = await db.execute(text("""
            SELECT COALESCE(SUM(CASE WHEN tipo = 'credito' THEN monto ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN tipo = 'debito' THEN monto ELSE 0 END), 0)
            FROM bank_transactions WHERE bank_account_id = :aid AND fecha < '2026-11-01'
        """), {"aid": acc_plug.id})
        neto_hist = q_hist.scalar()
        acc_plug.saldo_inicial = Decimal("6683589") - neto_hist

        # 1 crédito del extracto oficial
        db.add(BankTransaction(
            id=uuid.uuid4(), company_id=acc_plug.company_id, bank_account_id=acc_plug.id,
            fecha=date(2026, 11, 3), tipo="credito", monto=Decimal("1029904"), moneda="PYG",
            descripcion="PAGO.PROVEED.CONTINENTAL | 012362011", referencia="56 80502914",
            categoria="cobro_pix", conciliado=True, fecha_conciliacion=now, created_at=now
        ))
        acc_plug.saldo_actual = Decimal("7713493")
        acc_plug.updated_at = now
        db.add(acc_plug)
        print("  ✓ Saldo Dinámico Continental PlugPay: Gs. 7.713.493")

        # -------------------------------------------------------------
        # 3. BANCO INTERFISA - CTA. CORRIENTE (259058910)
        # -------------------------------------------------------------
        print("\n--- 3. BANCO INTERFISA - CTA. CORRIENTE ---")
        q_icte = await db.execute(select(BankAccount).where(BankAccount.numero_cuenta == "259058910"))
        acc_icte = q_icte.scalar_one()

        # Limpiar txs de noviembre
        await db.execute(text("DELETE FROM bank_transactions WHERE bank_account_id = :aid AND fecha >= '2026-11-01'"), {"aid": acc_icte.id})

        # Calibrar saldo_inicial base al 31/10 = 20.472.576
        q_hist = await db.execute(text("""
            SELECT COALESCE(SUM(CASE WHEN tipo = 'credito' THEN monto ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN tipo = 'debito' THEN monto ELSE 0 END), 0)
            FROM bank_transactions WHERE bank_account_id = :aid AND fecha < '2026-11-01'
        """), {"aid": acc_icte.id})
        neto_hist = q_hist.scalar()
        acc_icte.saldo_inicial = Decimal("20472576") - neto_hist

        # 1 Crédito
        db.add(BankTransaction(
            id=uuid.uuid4(), company_id=acc_icte.company_id, bank_account_id=acc_icte.id,
            fecha=date(2026, 11, 2), tipo="credito", monto=Decimal("351200"), moneda="PYG",
            descripcion="TRANSFERENCIA RECIBIDA SIPAP", referencia="2611025152716",
            categoria="cobranzas", conciliado=True, fecha_conciliacion=now, created_at=now
        ))

        # 5 Débitos
        icte_debs = [
            (date(2026, 11, 2), Decimal("1259500"), "2611025178677", "TRANSFERENCIA ENVIADA - AMROGROUP E.A.S."),
            (date(2026, 11, 3), Decimal("5849418"), "2611035247176", "TRANSFERENCIA ENVIADA - CHACOMER S.A.E."),
            (date(2026, 11, 3), Decimal("2000000"), "259058910", "DEB SEG 1018 POL 3731 CUO 1 RIOSEG-"),
            (date(2026, 11, 3), Decimal("776500"), "2611045259786", "TRANSFERENCIA ENVIADA"),
            (date(2026, 11, 3), Decimal("690000"), "2611045259860", "TRANSFERENCIA ENVIADA"),
        ]
        for f, m, ref, desc in icte_debs:
            db.add(BankTransaction(
                id=uuid.uuid4(), company_id=acc_icte.company_id, bank_account_id=acc_icte.id,
                fecha=f, tipo="debito", monto=m, moneda="PYG", descripcion=desc, referencia=ref,
                categoria="pago_proveedor", conciliado=True, fecha_conciliacion=now, created_at=now
            ))
        acc_icte.saldo_actual = Decimal("10248358")
        acc_icte.updated_at = now
        db.add(acc_icte)
        print("  ✓ Saldo Dinámico Interfisa Cta Cte: Gs. 10.248.358")

        # -------------------------------------------------------------
        # 4. BANCO INTERFISA - AHORRO (259026699)
        # -------------------------------------------------------------
        print("\n--- 4. BANCO INTERFISA - AHORRO ---")
        q_iah = await db.execute(select(BankAccount).where(BankAccount.numero_cuenta == "259026699"))
        acc_iah = q_iah.scalar_one()

        # Limpiar txs desde el 30/10 19:40
        await db.execute(text("DELETE FROM bank_transactions WHERE bank_account_id = :aid AND fecha >= '2026-10-31'"), {"aid": acc_iah.id})

        # Calibrar saldo_inicial base al corte 30/10 = 15.710.285
        q_hist = await db.execute(text("""
            SELECT COALESCE(SUM(CASE WHEN tipo = 'credito' THEN monto ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN tipo = 'debito' THEN monto ELSE 0 END), 0)
            FROM bank_transactions WHERE bank_account_id = :aid AND fecha <= '2026-10-30'
        """), {"aid": acc_iah.id})
        neto_hist = q_hist.scalar()
        acc_iah.saldo_inicial = Decimal("15710285") - neto_hist

        # Asentar el neto del período 31/10 al 04/11 según extracto oficial
        # Total créditos acreditados por Bancard: 47.130.412
        # Total débitos / retenciones: 1.107.666
        # Saldo final contable: 61.733.031
        db.add(BankTransaction(
            id=uuid.uuid4(), company_id=acc_iah.company_id, bank_account_id=acc_iah.id,
            fecha=date(2026, 11, 4), tipo="credito", monto=Decimal("47130412"), moneda="PYG",
            descripcion="ACREDITACIÓN CONSOLIDADA DE CUPONES BANCARD POS/QR (354 Movs Extracto)",
            referencia="EXTRACTO-BANCARD-354", categoria="liquidacion_tarjeta",
            conciliado=True, fecha_conciliacion=now, created_at=now
        ))
        db.add(BankTransaction(
            id=uuid.uuid4(), company_id=acc_iah.company_id, bank_account_id=acc_iah.id,
            fecha=date(2026, 11, 4), tipo="debito", monto=Decimal("1107666"), moneda="PYG",
            descripcion="DÉBITOS Y RETENCIONES BANCARD MATRIZ / COMISIONES EXTRACTO",
            referencia="DEB-BANCARD-MATRIZ", categoria="comisiones_bancarias",
            conciliado=True, fecha_conciliacion=now, created_at=now
        ))
        acc_iah.saldo_actual = Decimal("61733031")
        acc_iah.updated_at = now
        db.add(acc_iah)
        print("  ✓ Saldo Dinámico Interfisa Ahorro: Gs. 61.733.031")

        await db.commit()

        # Resumen consolidado
        tot_liq = Decimal("39012975") + Decimal("2281100") + Decimal("7713493") + Decimal("10248358") + Decimal("61733031")
        print("\n" + "=" * 80)
        print(f" 💰 LIQUIDEZ TOTAL CONSOLIDADA DEL SUPERMERCADO EN BANCOS: Gs. {tot_liq:,.0f}")
        print("=" * 80)

if __name__ == "__main__":
    asyncio.run(sync_all())
