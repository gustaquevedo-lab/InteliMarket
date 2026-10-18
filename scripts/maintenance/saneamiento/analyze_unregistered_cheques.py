import openpyxl
import datetime
from decimal import Decimal
import asyncio
from sqlalchemy import select, text
from api.src.db import async_session_factory

async def check():
    wb = openpyxl.load_workbook('Datos/CHEQUES A PLAZO EXTRA PARAGUAY.xlsx', data_only=True)
    ws = wb['26']
    excel_cheques = []
    for r in ws.iter_rows(values_only=True):
        if len(r) > 8 and isinstance(r[3], (int, float)) and r[3] > 1000:
            num = str(int(r[3]))
            banco = str(r[4]).strip().upper() if r[4] else 'CONTINENTAL'
            femision = r[5].date() if isinstance(r[5], datetime.datetime) else (r[5] if isinstance(r[5], datetime.date) else None)
            fvenc = r[6].date() if isinstance(r[6], datetime.datetime) else (r[6] if isinstance(r[6], datetime.date) else None)
            beneficiario = str(r[7]).strip() if r[7] else ''
            monto = None
            for val in r[8:]:
                if isinstance(val, (int, float)) and val > 0:
                    monto = Decimal(str(int(val)))
                    break
            if monto:
                excel_cheques.append({
                    'numero': num, 'banco': banco, 'emision': femision,
                    'vencimiento': fvenc, 'beneficiario': beneficiario, 'monto': monto
                })

    async with async_session_factory() as session:
        res = await session.execute(text('SELECT numero FROM cheques WHERE numero_confiable = True'))
        already_in_db = {r[0] for r in res.fetchall()}

        not_in_db = [c for c in excel_cheques if c['numero'] not in already_in_db]
        print(f'Total cheques no registrados en BD: {len(not_in_db)}')

        today = datetime.date(2026, 9, 24)

        # Cheques cruzados con bank_transactions
        res_tx = await session.execute(text('''
            SELECT referencia, round(monto) as monto, fecha, descripcion, banco 
            FROM bank_transactions t
            JOIN bank_accounts b ON b.id = t.bank_account_id
            WHERE t.referencia IS NOT NULL
        '''))
        tx_by_ref = {}
        for r in res_tx.fetchall():
            tx_by_ref[str(r[0]).strip()] = r

        ya_debitados_en_banco = []
        vencidos_sin_debito_en_banco = []
        por_vencer_futuros = []

        for c in not_in_db:
            venc = c['vencimiento']
            num = c['numero']
            
            if num in tx_by_ref:
                tx_match = tx_by_ref[num]
                ya_debitados_en_banco.append((c, tx_match))
            elif venc and venc < today:
                vencidos_sin_debito_en_banco.append(c)
            else:
                por_vencer_futuros.append(c)

        print(f'1. YA DEBITADOS / COBRADOS EN BANCO: {len(ya_debitados_en_banco)}')
        monto_cobrados = sum(c['monto'] for c, _ in ya_debitados_en_banco)
        print(f'   Monto cobrado en banco: Gs. {monto_cobrados:,.0f}')

        print(f'2. VENCIDOS HISTÓRICOS (fecha vencimiento anterior a hoy, sin débito identificado en extracto): {len(vencidos_sin_debito_en_banco)}')
        monto_venc = sum(c['monto'] for c in vencidos_sin_debito_en_banco)
        print(f'   Monto vencidos históricos: Gs. {monto_venc:,.0f}')

        print(f'3. POR VENCER (FUTUROS, vencimiento posterior a hoy): {len(por_vencer_futuros)}')
        monto_futuros = sum(c['monto'] for c in por_vencer_futuros)
        print(f'   Monto futuros por vencer: Gs. {monto_futuros:,.0f}')

        if por_vencer_futuros:
            print('\n--- MUESTRA DE CHEQUES QUE REALMENTE VENCEN A FUTURO ---')
            for c in sorted(por_vencer_futuros, key=lambda x: x['vencimiento'] or datetime.date(2099, 1, 1))[:15]:
                print(f"   Nº {c['numero']} | Vence: {c['vencimiento']} | Prov: {c['beneficiario']} | Gs. {c['monto']:,.0f}")

        if ya_debitados_en_banco:
            print('\n--- MUESTRA DE CHEQUES YA DEBITADOS EN BANCO ---')
            for c, tx in ya_debitados_en_banco[:5]:
                print(f"   Nº {c['numero']} | Debitado el: {tx[2]} ({tx[3]}) | Prov: {c['beneficiario']} | Gs. {c['monto']:,.0f}")

if __name__ == '__main__':
    asyncio.run(check())
