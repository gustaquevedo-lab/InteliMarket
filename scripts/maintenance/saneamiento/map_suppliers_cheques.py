import openpyxl, re, difflib
import asyncio
from decimal import Decimal
from sqlalchemy import select, text
from api.src.db import async_session_factory

def clean_name(s: str) -> str:
    if not s: return ''
    s = s.upper()
    for noise in ['S.A.C.E.I.', 'S.A.C.I.', 'S.A.', 'S.R.L.', 'E.A.S.', 'SOCIEDAD ANONIMA', 'SA', 'SRL', 'EAS', '.', ',', '-', '/', '(', ')', '"', "'"]:
        s = s.replace(noise, ' ')
    return re.sub(r'\s+', ' ', s).strip()

async def run():
    async with async_session_factory() as session:
        res = await session.execute(text('SELECT id, razon_social, nombre_fantasia, ruc FROM suppliers'))
        suppliers = res.fetchall()
        sup_map = []
        for sid, rz, nf, ruc in suppliers:
            sup_map.append({
                'id': str(sid),
                'rz': rz,
                'nf': nf or '',
                'clean_rz': clean_name(rz),
                'clean_nf': clean_name(nf or ''),
            })

        wb = openpyxl.load_workbook('Datos/CHEQUES A PLAZO EXTRA PARAGUAY.xlsx', data_only=True)
        ws = wb['26']
        b_counts = {}
        b_montos = {}
        for r in ws.iter_rows(values_only=True):
            if len(r) > 8 and isinstance(r[3], (int, float)) and r[3] > 1000:
                b = str(r[7]).strip() if r[7] else ''
                m = Decimal(str(int(r[8]))) if isinstance(r[8], (int, float)) and r[8] > 0 else Decimal('0')
                b_counts[b] = b_counts.get(b, 0) + 1
                b_montos[b] = b_montos.get(b, Decimal('0')) + m

        print(f'=== TOP 25 BENEFICIARIOS POR MONTO EN EXCEL 2026 ===')
        for b, m in sorted(b_montos.items(), key=lambda x: x[1], reverse=True)[:25]:
            # find best supplier
            cb = clean_name(b)
            best_sup = None
            best_score = 0.0
            for sup in sup_map:
                if cb == sup['clean_rz'] or cb == sup['clean_nf']:
                    best_sup = sup
                    best_score = 1.0
                    break
                elif cb in sup['clean_rz'] or sup['clean_rz'] in cb:
                    score = 0.95
                else:
                    score = max(
                        difflib.SequenceMatcher(None, cb, sup['clean_rz']).ratio(),
                        difflib.SequenceMatcher(None, cb, sup['clean_nf']).ratio()
                    )
                if score > best_score:
                    best_score = score
                    best_sup = sup

            match_str = f"-> MATCH: {best_sup['rz']} ({best_score:.2f})" if best_score >= 0.6 else "-> SIN MATCH"
            print(f'Gs. {m:>14,.0f} | {b_counts[b]:>3} chq | {b:<40} {match_str}')

if __name__ == '__main__':
    asyncio.run(run())
