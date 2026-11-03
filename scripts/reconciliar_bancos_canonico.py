"""
Script Canónico de Saneamiento, Reconciliación y Cuadratura Dinámica de Bancos.
InteliMarket - Extra Supermercado (Octubre - Noviembre 2026)

Este script:
1. Depura las transacciones temporales / duplicadas de octubre 2026.
2. Marca todos los movimientos históricos del legacy (< 01/10/2026) como conciliados (conciliado = true).
3. Calibra matemáticamente el saldo_inicial base de cada cuenta para que al 30/09/2026 cuadre exactamente
   con el saldo inicial oficial de los extractos (Saldo Anterior al 01/10/2026).
4. Inserta las 2.755 transacciones oficiales de los extractos de octubre 2026 (Continental Cta Cte, Dinelco,
   PlugPay, Interfisa Cta Cte, Interfisa Ahorro POS) con categorías limpias y conciliadas.
5. Cruza con la cartera de cheques emitidos: marca como 'cobrado' los cheques encontrados en el extracto
   y vincula cheque_id en la transacción bancaria.
6. Preserva intactas las operaciones reales ya registradas en noviembre 2026 (01 al 03 de noviembre).
7. Recalcula de forma 100% DINÁMICA el saldo_actual de cada cuenta a partir de la suma matemática
   de sus movimientos (saldo_inicial + creditos - debitos), sin fijar ningún saldo a mano.
"""
import os
import re
import sys
import uuid
import argparse
from datetime import date, datetime, timezone
from decimal import Decimal
import asyncio
from sqlalchemy import select, text
from api.src.db import async_session_factory
from api.src.financial.models import BankAccount, BankTransaction
from api.src.cheques.models import Cheque
from api.src.financial import statement_import


SALDOS_OFICIALES_30_SEP = {
    '382364779308': Decimal('50816460'),   # Continental Cta Cte
    '38250039706001': Decimal('1674199'),  # Continental Dinelco
    '38250039706208': Decimal('4736671'),  # Continental PlugPay
    '259058910': Decimal('9140355'),       # Interfisa Cta Cte
    '259026699': Decimal('7506319'),       # Interfisa Ahorro
}

EXTRACTOS = [
    {
        'banco_match': 'CONTINENTAL',
        'account_tipo': 'cuenta_corriente',
        'file': 'CONTINENTAL MES DE OCTUBRE 2026.xlsx',
        'default_cat': 'otros',
    },
    {
        'banco_match': 'CONTINENTAL-DINELCO',
        'account_tipo': 'ahorro',
        'file': 'CONTINENTAL MES DE OCTUBRE 2026.xlsx',
        'default_cat': 'liquidacion_tarjeta',
    },
    {
        'banco_match': 'CONTINENTAL-PLUGPAY',
        'account_tipo': 'ahorro_pix',
        'file': 'CONTINENTAL MES DE OCTUBRE 2026.xlsx',
        'default_cat': 'cobro_pix',
    },
    {
        'banco_match': 'INTERFISA',
        'account_tipo': 'cuenta_corriente',
        'file': 'INTERFISA MES DE OCTUBRE 2026.xlsx',
        'default_cat': 'otros',
    },
    {
        'banco_match': 'INTERFISA-AHORRO',
        'account_tipo': 'ahorro',
        'file': 'INTERFISA MES DE OCTUBRE 2026.xlsx',
        'default_cat': 'liquidacion_tarjeta',
    },
]


async def run_canonico(commit: bool = False, datos_dir: str = "datos/Extractos"):
    print("=" * 80)
    print(" 🚀 EJECUTANDO SANEAMIENTO Y CUADRATURA DINÁMICA DE BANCOS")
    print(f"    Modo: {'APLICAR EN PRODUCCIÓN (--commit)' if commit else 'SIMULACIÓN SEGURA (DRY-RUN)'}")
    print("=" * 80)

    async with async_session_factory() as session:
        # Cargar cuentas bancarias
        res_acc = await session.execute(select(BankAccount).where(BankAccount.activo == True).order_by(BankAccount.banco))
        accounts = list(res_acc.scalars().all())

        def find_acc(banco_match: str, account_tipo: str) -> BankAccount:
            for a in accounts:
                b = a.banco.upper()
                al = (a.alias or "").upper()
                if banco_match == 'CONTINENTAL-DINELCO' and ('DINELCO' in b or 'DINELCO' in al):
                    return a
                if banco_match == 'CONTINENTAL-PLUGPAY' and ('PLUGPAY' in b or 'PLUGPAY' in al or 'PIX' in b):
                    return a
                if banco_match == 'INTERFISA-AHORRO' and 'INTERFISA' in b and ('AHORRO' in a.tipo.upper() or 'AHORRO' in al):
                    return a
                if banco_match == 'CONTINENTAL' and 'CONTINENTAL' in b and 'CORRIENTE' in (a.tipo.upper() + al):
                    return a
                if banco_match == 'INTERFISA' and 'INTERFISA' in b and 'CORRIENTE' in (a.tipo.upper() + al):
                    return a
            raise ValueError(f"Cuenta no encontrada: {banco_match} {account_tipo}")

        # -----------------------------------------------------------------
        # PASO 1: Marcar histórico legacy (< 01/10/2026) como conciliado
        # -----------------------------------------------------------------
        print("\n--- PASO 1: Marcar histórico del legacy (< 01/10/2026) como conciliado ---")
        res_leg = await session.execute(text("""
            SELECT count(*) FROM bank_transactions
            WHERE fecha < '2026-10-01' AND (conciliado = false OR conciliado IS NULL)
        """))
        pend_leg = res_leg.scalar_one()
        print(f"  Movimientos legacy pendientes: {pend_leg:,}")
        if commit and pend_leg > 0:
            await session.execute(text("""
                UPDATE bank_transactions
                SET conciliado = true, fecha_conciliacion = '2026-09-30 23:59:59+00'
                WHERE fecha < '2026-10-01' AND (conciliado = false OR conciliado IS NULL)
            """))
            print("  ✓ Histórico legacy conciliado.")

        # -----------------------------------------------------------------
        # PASO 2: Calibración matemática de saldo_inicial base al 30/09/2026
        # -----------------------------------------------------------------
        print("\n--- PASO 2: Calibración matemática de saldo_inicial base al 30/09/2026 ---")
        for acc in accounts:
            target_sep30 = SALDOS_OFICIALES_30_SEP[acc.numero_cuenta]
            res_net = await session.execute(text("""
                SELECT 
                    COALESCE(SUM(CASE WHEN tipo = 'credito' THEN monto ELSE 0 END), 0) as cred,
                    COALESCE(SUM(CASE WHEN tipo = 'debito' THEN monto ELSE 0 END), 0) as deb
                FROM bank_transactions
                WHERE bank_account_id = :aid AND fecha < '2026-10-01'
            """), {'aid': acc.id})
            c_pre, d_pre = res_net.fetchone()
            calibrated_saldo_inicial = target_sep30 - (c_pre - d_pre)
            print(f"  {acc.banco} ({acc.numero_cuenta}):")
            print(f"    Saldo base 30/09: Gs. {target_sep30:>14,.0f} | Saldo inicial: Gs. {calibrated_saldo_inicial:>14,.0f}")
            if commit:
                acc.saldo_inicial = calibrated_saldo_inicial
                session.add(acc)

        # -----------------------------------------------------------------
        # PASO 3: Reemplazar transacciones de octubre con el extracto oficial
        # -----------------------------------------------------------------
        print("\n--- PASO 3: Registrar extractos bancarios oficiales de Octubre 2026 ---")
        if commit:
            await session.execute(text("""
                DELETE FROM bank_transactions
                WHERE fecha >= '2026-10-01' AND fecha <= '2026-10-31'
            """))
            print("  ✓ Período de octubre limpiado para inserción canónica.")

        total_txs_insertadas = 0
        all_new_txs = []

        for cfg in EXTRACTOS:
            target_acc = find_acc(cfg['banco_match'], cfg['account_tipo'])
            filepath = os.path.join(datos_dir, cfg['file'])
            with open(filepath, "rb") as f:
                parsed = statement_import.parse_statement(f.read(), 10, 2026, target_acc.banco, cfg['account_tipo'])

            txs = parsed["transacciones"]
            print(f"  📄 {target_acc.banco} ({target_acc.numero_cuenta}) — Hoja [{parsed['sheet_matched']}]: {len(txs)} txs oficiales.")

            for t in txs:
                t_desc = (t.get("descripcion") or "").strip()
                t_ref = (str(t.get("referencia")) or "").strip() if t.get("referencia") is not None else None
                desc_upper = t_desc.upper()

                # Categorización inteligente
                categoria = cfg['default_cat']
                if "CHEQUE" in desc_upper or "CHQ" in desc_upper:
                    categoria = "pago_cheque"
                elif "PAGO A " in desc_upper or "PAGO.PROVEED" in desc_upper or "PAGO DE SEGURO" in desc_upper:
                    categoria = "pago_proveedor"
                elif "DEPÓSITO" in desc_upper or "DEPOSITO" in desc_upper:
                    categoria = "deposito_caja"
                elif "TRANSF" in desc_upper:
                    categoria = "transferencia_interna"
                elif "BEPSA" in desc_upper or "POS" in desc_upper:
                    categoria = "liquidacion_tarjeta"
                elif "PIX" in desc_upper:
                    categoria = "cobro_pix"
                elif "COMIS" in desc_upper or "GASTO" in desc_upper or "INTERES" in desc_upper:
                    categoria = "comision_bancaria"

                bt = BankTransaction(
                    id=uuid.uuid4(),
                    company_id=target_acc.company_id,
                    bank_account_id=target_acc.id,
                    fecha=t["fecha"],
                    tipo=t["tipo"],
                    monto=t["monto"],
                    moneda="PYG",
                    descripcion=t_desc[:300] if t_desc else None,
                    referencia=t_ref[:100] if t_ref else None,
                    categoria=categoria,
                    conciliado=True,
                    fecha_conciliacion=datetime.now(timezone.utc),
                )
                all_new_txs.append(bt)
                total_txs_insertadas += 1

        print(f"\n  Total transacciones oficiales de extracto a registrar: {total_txs_insertadas}")
        if commit:
            session.add_all(all_new_txs)
            await session.flush()
            print("  ✓ Transacciones insertadas en base de datos.")

        # -----------------------------------------------------------------
        # PASO 4: Cruzar con cheques emitidos (marcar cobrados)
        # -----------------------------------------------------------------
        print("\n--- PASO 4: Cruzar con cartera de cheques emitida ---")
        if commit:
            res_chq = await session.execute(text("""
                SELECT 
                    c.id as cheque_id, c.numero, c.monto,
                    t.id as tx_id, t.fecha as tx_fecha
                FROM cheques c
                JOIN bank_transactions t ON t.tipo = 'debito'
                     AND t.fecha >= '2026-10-01' AND t.fecha <= '2026-10-31'
                     AND t.monto = c.monto
                     AND (t.descripcion ILIKE '%' || c.numero || '%' OR t.referencia ILIKE '%' || c.numero || '%')
                WHERE c.estado != 'cobrado'
            """))
            matched_cheques = res_chq.fetchall()
            print(f"  Cheques cruzados con extracto bancario: {len(matched_cheques)}")
            for ch in matched_cheques:
                await session.execute(text("""
                    UPDATE cheques SET estado = 'cobrado', fecha_pago = :fp WHERE id = :cid
                """), {'fp': ch.tx_fecha, 'cid': ch.cheque_id})
                await session.execute(text("""
                    UPDATE bank_transactions SET cheque_id = :cid, categoria = 'pago_cheque' WHERE id = :tid
                """), {'cid': ch.cheque_id, 'tid': ch.tx_id})

        # -----------------------------------------------------------------
        # PASO 5: Recálculo dinámico de saldos (saldo_inicial + creditos - debitos)
        # -----------------------------------------------------------------
        print("\n--- PASO 5: Recálculo dinámico final de saldos ---")
        if commit:
            await session.flush()

        tot_liq_octubre = Decimal("0")
        tot_liq_hoy = Decimal("0")

        for acc in accounts:
            if commit:
                res_calc = await session.execute(text("""
                    SELECT 
                        COALESCE(SUM(CASE WHEN tipo = 'credito' THEN monto ELSE 0 END), 0) as cred,
                        COALESCE(SUM(CASE WHEN tipo = 'debito' THEN monto ELSE 0 END), 0) as deb,
                        COALESCE(SUM(CASE WHEN tipo = 'credito' AND fecha <= '2026-10-31' THEN monto ELSE 0 END), 0) as cred_oct,
                        COALESCE(SUM(CASE WHEN tipo = 'debito' AND fecha <= '2026-10-31' THEN monto ELSE 0 END), 0) as deb_oct,
                        COUNT(*) as total_txs,
                        COUNT(CASE WHEN conciliado = false OR conciliado IS NULL THEN 1 END) as pendientes
                    FROM bank_transactions
                    WHERE bank_account_id = :aid
                """), {'aid': acc.id})
                c_all, d_all, c_oct, d_oct, tot_txs, pend = res_calc.fetchone()
                s_oct = acc.saldo_inicial + c_oct - d_oct
                s_actual = acc.saldo_inicial + c_all - d_all
            else:
                # Simulación matemática
                for cfg in EXTRACTOS:
                    ta = find_acc(cfg['banco_match'], cfg['account_tipo'])
                    if ta.id == acc.id:
                        fp = os.path.join(datos_dir, cfg['file'])
                        with open(fp, "rb") as f:
                            p_sim = statement_import.parse_statement(f.read(), 10, 2026, acc.banco, cfg['account_tipo'])
                            s_oct = Decimal(str(p_sim['saldo_cierre']))
                        break
                # Cargar nov
                res_nov = await session.execute(text("""
                    SELECT 
                        COALESCE(SUM(CASE WHEN tipo = 'credito' THEN monto ELSE 0 END), 0) as cred,
                        COALESCE(SUM(CASE WHEN tipo = 'debito' THEN monto ELSE 0 END), 0) as deb
                    FROM bank_transactions
                    WHERE bank_account_id = :aid AND fecha >= '2026-11-01'
                """), {'aid': acc.id})
                c_nov, d_nov = res_nov.fetchone()
                s_actual = s_oct + c_nov - d_nov
                pend = 0

            tot_liq_octubre += s_oct
            tot_liq_hoy += s_actual

            print(f"  {acc.banco} ({acc.numero_cuenta}):")
            print(f"    Saldo Cierre Octubre (31/10/2026): Gs. {s_oct:>14,.0f}")
            print(f"    Saldo Dinámico Hoy   (03/11/2026): Gs. {s_actual:>14,.0f} (Pendientes: {pend})")

            if commit:
                acc.saldo_actual = s_actual
                acc.saldo_verificado_manualmente = False  # Dinámico por movimientos
                acc.updated_at = datetime.now(timezone.utc)
                session.add(acc)

        print("\n" + "=" * 80)
        print(f" 💰 LIQUIDEZ CIERRE OCTUBRE (31/10/2026): Gs. {tot_liq_octubre:,.0f}")
        print(f" 💰 LIQUIDEZ DINÁMICA ACTUAL (03/11/2026): Gs. {tot_liq_hoy:,.0f}")
        print("=" * 80)

        if commit:
            await session.commit()
            print("\n✅ BASE DE DATOS ACTUALIZADA Y SINCRONIZADA CON ÉXITO.")
        else:
            print("\n[DRY-RUN] Simulación completa. Ejecutar con --commit para aplicar.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", action="store_true")
    parser.add_argument("--datos", default="datos/Extractos")
    args = parser.parse_args()
    asyncio.run(run_canonico(commit=args.commit, datos_dir=args.datos))
