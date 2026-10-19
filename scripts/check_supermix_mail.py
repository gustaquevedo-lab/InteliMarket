import asyncio
import asyncpg
import imaplib
import email
from email.header import decode_header
import xml.etree.ElementTree as ET
import zipfile
import io

def decode_mime(h):
    if not h: return ""
    parts = decode_header(h)
    out = []
    for c, enc in parts:
        if isinstance(c, bytes):
            out.append(c.decode(enc or 'utf-8', errors='replace'))
        else:
            out.append(str(c))
    return "".join(out)

async def check_supermix_all():
    db_url = ''
    with open('/home/intellihouse/intelimarket/.env') as f:
        for line in f:
            if line.startswith('DATABASE_URL='):
                db_url = line.strip().split('=', 1)[1].strip("'\"")
                break
    clean_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')
    conn = await asyncpg.connect(clean_url)
    cfg = await conn.fetchrow("SELECT * FROM purchase_inbox_configs WHERE activo = true")
    await conn.close()

    client = imaplib.IMAP4_SSL(cfg['imap_host'], cfg['imap_port'])
    client.login(cfg['imap_user'], cfg['imap_password'])
    client.select(cfg['imap_folder'] or 'INBOX')

    # Search by sender 800357540
    status, msg_nums = client.search(None, 'FROM', '"800357540"')
    ids = msg_nums[0].split()
    print(f"Total correos de 800357540 (SUPER MIX): {len(ids)}")

    results = []
    for mid in ids:
        res, data = client.fetch(mid, '(RFC822)')
        if res != 'OK': continue
        raw = data[0][1]
        msg = email.message_from_bytes(raw)
        subj = decode_mime(msg.get('Subject', ''))
        date_str = msg.get('Date', '')

        # Look for XML or ZIP attachments
        xml_data = None
        for part in msg.walk():
            fname = part.get_filename() or ''
            fname_dec = decode_mime(fname)
            ctype = part.get_content_type()
            payload = part.get_payload(decode=True)
            if not payload: continue

            if fname_dec.lower().endswith('.xml') or 'xml' in ctype:
                xml_data = payload
                break
            elif fname_dec.lower().endswith('.zip'):
                try:
                    with zipfile.ZipFile(io.BytesIO(payload)) as zf:
                        for zname in zf.namelist():
                            if zname.lower().endswith('.xml'):
                                xml_data = zf.read(zname)
                                break
                except Exception:
                    pass

        dte_info = {}
        if xml_data:
            try:
                root = ET.fromstring(xml_data)
                # Parse basic SIFEN DTE info
                # Namespace often http://ekuatia.set.gov.py/sifen/xsd
                ns = {'s': 'http://ekuatia.set.gov.py/sifen/xsd'}
                # Try finding dNumTim, dEst, dPunExp, dNumDoc, dTotGralOpe
                timbrado = root.find('.//{*}dNumTim')
                est = root.find('.//{*}dEst')
                punto = root.find('.//{*}dPunExp')
                num = root.find('.//{*}dNumDoc')
                tot = root.find('.//{*}dTotGralOpe')
                cdc = root.find('.//{*}Id')
                fecha_emi = root.find('.//{*}dFeEmiDE')

                num_fac = f"{est.text if est is not None else '001'}-{punto.text if punto is not None else '001'}-{int(num.text) if num is not None and num.text.isdigit() else (num.text if num is not None else '')}"
                dte_info = {
                    'timbrado': timbrado.text if timbrado is not None else None,
                    'numero_factura': num_fac,
                    'total': tot.text if tot is not None else None,
                    'fecha_emision': fecha_emi.text if fecha_emi is not None else None,
                    'cdc': cdc.text if cdc is not None else None,
                }
            except Exception as e:
                dte_info = {'error': str(e)}

        results.append({
            'mid': mid.decode(),
            'subject': subj,
            'date': date_str,
            'dte': dte_info
        })

    print(f"\n=== FACTURAS ELECTRÓNICAS EXTRAÍDAS DE CORREOS DE SUPER MIX ({len(results)}) ===")
    for r in results:
        print(r)

    client.logout()

if __name__ == '__main__':
    asyncio.run(check_supermix_all())
