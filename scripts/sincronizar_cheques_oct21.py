import openpyxl, re, asyncio, argparse
from datetime import datetime, timezone, date
from decimal import Decimal
import uuid

from api.src.db import async_session_factory
from sqlalchemy import text

EXCEL_PATH = '/tmp/cheques_fuente_verdad.xlsx'

async def sincronizar(dry_run: bool = True):
    print(f'=== INICIANDO SINCRONIZACIÓN DE CHEQUES FUENTE DE VERDAD (dry_run={dry_run}) ===')
    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
    sheet = wb.active
    
    excel_items = []
    for r in range(8, sheet.max_row + 1):
        nro = sheet.cell(r, 4).value
        banco = sheet.cell(r, 5).value
        venc = sheet.cell(r, 6).value
        orden = sheet.cell(r, 7).value
        monto = sheet.cell(r, 8).value
        
        if nro is None or str(nro).strip() == '':
            continue
            
        m = re.search(r'\d+', str(nro))
        num_clean = m.group(0).lstrip('0') if m else str(nro).strip()
        
        try:
            monto_num = float(monto) if monto is not None else 0.0
        except:
            monto_num = 0.0
            
        venc_str = str(venc)[:10] if venc else ''
        if venc_str.startswith('2062-'):
            venc_str = '2026-' + venc_str[5:]
        if str(nro).strip() == '808284':
            venc_str = '2027-01-14'
            
        if num_clean and monto_num > 0:
            excel_items.append({
                'row': r,
                'nro_raw': str(nro).strip(),
                'num_clean': num_clean,
                'banco': str(banco).strip() if banco else '',
                'venc': venc_str,
                'orden': str(orden).strip() if orden else '',
                'monto': int(round(monto_num))
            })

    print(f'Total cheques reales leídos del Excel: {len(excel_items)}')
    
    async with async_session_factory() as db:
        res = await db.execute(text('SELECT id, company_id, numero, monto, fecha_pago, estado, beneficiario, bank_account_id, supplier_id FROM public.cheques'))
        all_db = res.fetchall()
        
        db_map = {}
        for c in all_db:
            m = re.search(r'\d+', str(c.numero))
            n = m.group(0).lstrip('0') if m else str(c.numero).strip()
            db_map.setdefault(n, []).append(c)
            
        a_revertir = []
        fechas_actualizadas = []
        ya_correctos = []
        faltantes = []
        
        for ex in excel_items:
            matches = db_map.get(ex['num_clean'], [])
            if not matches:
                faltantes.append(ex)
                continue
                
            active = [m for m in matches if m.estado in ('entregado', 'pendiente')]
            if active:
                c = active[0]
                venc_bd = str(c.fecha_pago) if c.fecha_pago else ''
                if ex['venc'] and venc_bd != ex['venc']:
                    fechas_actualizadas.append((ex, c, venc_bd))
                else:
                    ya_correctos.append((ex, c))
            else:
                cobs = [m for m in matches if m.estado == 'cobrado']
                if cobs:
                    a_revertir.append((ex, cobs[0]))
                else:
                    others = [m for m in matches if m.estado not in ('anulado',)]
                    if others:
                        a_revertir.append((ex, others[0]))
                    else:
                        faltantes.append(ex)
                        
        print(f'\n1. Cheques en estado COBRADO que pasarán a ENTREGADO: {len(a_revertir)}')
        monto_rev = sum(ex['monto'] for ex, c in a_revertir)
        print(f'   Monto total a revertir: Gs. {monto_rev:,.0f}')
        for ex, c in sorted(a_revertir, key=lambda x: x[0]['venc']):
            print(f'   - Nro {ex["nro_raw"]} | Monto: {ex["monto"]:>11,.0f} | Venc Excel: {ex["venc"]} | Venc BD previo: {c.fecha_pago} | {ex["orden"][:28]}')
            
        print(f'\n2. Cheques ya activos cuya fecha de vencimiento diferida se corregirá: {len(fechas_actualizadas)}')
        for ex, c, v_old in fechas_actualizadas:
            print(f'   - Nro {ex["nro_raw"]} | Fecha BD: {v_old} -> Nueva Fecha Excel: {ex["venc"]} | Benef: {ex["orden"][:28]}')
            
        print(f'\n3. Cheques activos con estado y fecha ya idénticos: {len(ya_correctos)}')
        print(f'4. Cheques que no existen en BD y se crearán: {len(faltantes)}')
        for ex in faltantes:
            print(f'   - Nro {ex["nro_raw"]} | Monto: {ex["monto"]:>11,.0f} | Venc: {ex["venc"]} | Benef: {ex["orden"]}')
            
        if not dry_run:
            print('\n--> APLICANDO CAMBIOS EN BASE DE DATOS...')
            now = datetime.now(timezone.utc)
            
            # Revertir cobrados a entregados
            for ex, c in a_revertir:
                venc_date = datetime.strptime(ex['venc'], '%Y-%m-%d').date() if ex['venc'] else None
                await db.execute(text('''
                    UPDATE public.cheques 
                    SET estado = 'entregado',
                        diferido = true,
                        fecha_pago = :fecha_pago,
                        estado_updated_at = :now,
                        updated_at = :now
                    WHERE id = :id
                '''), {
                    'id': c.id,
                    'fecha_pago': venc_date or c.fecha_pago,
                    'now': now
                })
                
                await db.execute(text('''
                    INSERT INTO public.cheque_historial 
                    (id, cheque_id, estado_anterior, estado_nuevo, user_nombre, notas, created_at)
                    VALUES 
                    (:id, :cheque_id, :est_ant, 'entregado', 'Alineación Cartera Oct-2026', :notas, :now)
                '''), {
                    'id': uuid.uuid4(),
                    'cheque_id': c.id,
                    'est_ant': c.estado,
                    'notas': f'Cheque diferido activo en tránsito alineado con planilla fuente de verdad (Vencimiento: {ex["venc"]})',
                    'now': now
                })

            # Actualizar fechas diferidas de los activos
            for ex, c, v_old in fechas_actualizadas:
                venc_date = datetime.strptime(ex['venc'], '%Y-%m-%d').date() if ex['venc'] else None
                await db.execute(text('''
                    UPDATE public.cheques 
                    SET fecha_pago = :fecha_pago,
                        diferido = true,
                        updated_at = :now
                    WHERE id = :id
                '''), {
                    'id': c.id,
                    'fecha_pago': venc_date,
                    'now': now
                })
                
                await db.execute(text('''
                    INSERT INTO public.cheque_historial 
                    (id, cheque_id, estado_anterior, estado_nuevo, user_nombre, notas, created_at)
                    VALUES 
                    (:id, :cheque_id, :est, :est, 'Alineación Cartera Oct-2026', :notas, :now)
                '''), {
                    'id': uuid.uuid4(),
                    'cheque_id': c.id,
                    'est': c.estado,
                    'notas': f'Actualización de fecha de vencimiento diferido: {v_old} -> {ex["venc"]}',
                    'now': now
                })

            # Crear cheques faltantes (808331)
            for ex in faltantes:
                c_id_res = await db.execute(text('SELECT id FROM public.companies LIMIT 1'))
                company_id = c_id_res.scalar()
                
                ba_res = await db.execute(text("""
                    SELECT id FROM public.bank_accounts 
                    WHERE UPPER(banco) LIKE '%CONTINENTAL%' AND activo = true 
                    LIMIT 1
                """))
                bank_acct_id = ba_res.scalar()
                
                sup_res = await db.execute(text("""
                    SELECT id FROM public.suppliers 
                    WHERE UPPER(razon_social) LIKE :q OR UPPER(nombre_fantasia) LIKE :q
                    LIMIT 1
                """), {'q': f'%{ex["orden"].upper()}%'})
                supplier_id = sup_res.scalar()
                
                new_id = uuid.uuid4()
                venc_date = datetime.strptime(ex['venc'], '%Y-%m-%d').date() if ex['venc'] else date.today()
                
                await db.execute(text('''
                    INSERT INTO public.cheques 
                    (id, company_id, numero, numero_confiable, banco_emisor, bank_account_id,
                     beneficiario, supplier_id, monto, moneda, fecha_emision, fecha_entrega,
                     fecha_pago, diferido, estado, concepto, notas, created_at, updated_at)
                    VALUES 
                    (:id, :cid, :num, true, :banco, :ba_id,
                     :benef, :sup_id, :monto, 'PYG', :f_emi, :f_emi,
                     :f_pago, true, 'entregado', 'Cheque diferido entregado a proveedor',
                     'Alta por alineación con Planilla Fuente de Verdad', :now, :now)
                '''), {
                    'id': new_id,
                    'cid': company_id,
                    'num': ex['nro_raw'],
                    'banco': ex['banco'] or 'CONTINENTAL',
                    'ba_id': bank_acct_id,
                    'benef': ex['orden'],
                    'sup_id': supplier_id,
                    'monto': ex['monto'],
                    'f_emi': date.today(),
                    'f_pago': venc_date,
                    'now': now
                })
                
                await db.execute(text('''
                    INSERT INTO public.cheque_historial 
                    (id, cheque_id, estado_anterior, estado_nuevo, user_nombre, notas, created_at)
                    VALUES 
                    (:id, :cheque_id, NULL, 'entregado', 'Alineación Cartera Oct-2026', 'Alta y entrega de cheque diferido', :now)
                '''), {
                    'id': uuid.uuid4(),
                    'cheque_id': new_id,
                    'now': now
                })
                print(f'   -> Cheque {ex["nro_raw"]} creado exitosamente con ID {new_id}')

            await db.commit()
            print('\n=== ¡CAMBIOS CONFIRMADOS Y PERSISTIDOS EXITOSAMENTE EN BD! ===')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true', help='Aplica los cambios en BD')
    args = parser.parse_args()
    asyncio.run(sincronizar(dry_run=not args.apply))
