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

async def check():
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

    for mid in ['2436', '2437', '2438']:
        res, data = client.fetch(mid, '(RFC822)')
        if res != 'OK': continue
        msg = email.message_from_bytes(data[0][1])
        subj = decode_mime(msg.get('Subject', ''))

        for part in msg.walk():
            fname = decode_mime(part.get_filename() or '')
            payload = part.get_payload(decode=True)
            if not payload: continue
            if fname.lower().endswith('.xml') or 'xml' in part.get_content_type():
                root = ET.fromstring(payload)
                tipo_doc = root.find('.//{*}iTiDE')
                desc_doc = root.find('.//{*}dDesTiDE')
                tot = root.find('.//{*}dTotGralOpe')
                num = root.find('.//{*}dNumDoc')
                cdc = root.find('.//{*}Id')
                print(f"MID {mid} ({subj}): tipo={tipo_doc.text if tipo_doc is not None else 'None'} ({desc_doc.text if desc_doc is not None else ''}) num={num.text if num is not None else ''} tot={tot.text if tot is not None else ''}")

    client.logout()

if __name__ == '__main__':
    asyncio.run(check())
