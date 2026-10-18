import openpyxl, re, difflib
import asyncio
from decimal import Decimal
from sqlalchemy import select, text
from api.src.db import async_session_factory

def clean_name(s: str) -> str:
    if not s: return ''
    s = s.upper()
    for noise in ['S.A.C.E.I.', 'S.A.C.I.', 'S.A.', 'S.R.L.', 'E.A.S.', 'SOCIEDAD ANONIMA', 'SA', 'SRL', 'EAS', '.', ',', '-', '/', '(', ')', '"', "'", '1/3', '2/3', '3/3', '1/2', '2/2']:
        s = s.replace(noise, ' ')
    return re.sub(r'\s+', ' ', s).strip()

CUSTOM_ALIASES = {
    'PECHUGON': 'DISTRIBUIDORA SAN GABRIEL DEL PARAGUAY S.A.',
    'PECHUGÓN': 'DISTRIBUIDORA SAN GABRIEL DEL PARAGUAY S.A.',
    'SAN GABRIEL': 'DISTRIBUIDORA SAN GABRIEL DEL PARAGUAY S.A.',
    'CARNES MONGES': 'CARNE PEDRO JUAN CABALLERO',
    'SP PLASTICOS': 'PLASTICO SP MAYORISTA',
    'SP PLÁSTICOS': 'PLASTICO SP MAYORISTA',
    'PINGUINO': 'PINGUINO IMPORTADORA Y EXPORTADORA S.R.L.',
    'PINGÜINO': 'PINGUINO IMPORTADORA Y EXPORTADORA S.R.L.',
    'PAPA IVAR': 'PAPA IVAR COMPANY SRL',
    'VERDULERIA C Y G': 'VERDULERÍA C Y G ',
    'MOLINO DE ARROZ LA ESPANOLA': 'MOLINO DE ARROCEROS LA ESPAÑOLA S.A',
    'MO. ARROCEROS LA ESPANOLA': 'MOLINO DE ARROCEROS LA ESPAÑOLA S.A',
    'MO. DE ARROZ KRIS-TAL': 'MOLINOS DE ARROZ KRIS-TAL SRL',
    'DIST. SANTA MARIA': 'DISTRIBUIDORA SANTA MARIA E.A.S.',
    'SANTA MARIA EAS': 'DISTRIBUIDORA SANTA MARIA E.A.S.',
    'DIST. DANIELITO': 'DISTRIBUIDORA DANIELITO ',
    'PROVEEDORES DE CARNE PJC': 'PROVEEDOR DE CARNES PEDRO JUAN ',
    'PROVEEDOR DE CARNES PJC': 'PROVEEDOR DE CARNES PEDRO JUAN ',
}

async def check():
    async with async_session_factory() as session:
        res = await session.execute(text('SELECT id, razon_social, nombre_fantasia FROM suppliers'))
        suppliers = res.fetchall()
        sup_by_clean = {clean_name(s[1]): s[0] for s in suppliers}
        for s in suppliers:
            if s[2]:
                sup_by_clean[clean_name(s[2])] = s[0]

        wb = openpyxl.load_workbook('Datos/CHEQUES A PLAZO EXTRA PARAGUAY.xlsx', data_only=True)
        ws = wb['26']
        matched = 0
        total = 0
        unmatched_samples = set()
        for r in ws.iter_rows(values_only=True):
            if len(r) > 8 and isinstance(r[3], (int, float)) and r[3] > 1000:
                total += 1
                b = str(r[7]).strip() if r[7] else ''
                cb = clean_name(b)
                
                target_name = None
                for k, v in CUSTOM_ALIASES.items():
                    if k in cb:
                        target_name = clean_name(v)
                        break
                
                if target_name and target_name in sup_by_clean:
                    matched += 1
                elif cb in sup_by_clean:
                    matched += 1
                else:
                    found = False
                    for s_clean, sid in sup_by_clean.items():
                        if s_clean and (cb in s_clean or s_clean in cb or difflib.SequenceMatcher(None, cb, s_clean).ratio() >= 0.75):
                            matched += 1
                            found = True
                            break
                    if not found:
                        unmatched_samples.add(b)

        print(f'Mapeo final: {matched} de {total} cheques ({matched/total*100:.1f}%)')
        print(f'No mapeados: {total - matched}')
        print('Muestra de no mapeados:', list(unmatched_samples)[:8])

if __name__ == '__main__':
    asyncio.run(check())
