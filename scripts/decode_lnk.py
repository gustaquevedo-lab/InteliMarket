import winrm
import base64
import re

s = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

cmd = r'powershell -NoProfile -Command "[Convert]::ToBase64String([System.IO.File]::ReadAllBytes(\"C:\Users\Public\Desktop\Intelimarket POS.lnk\"))"'
r = s.run_cmd(cmd)
b64 = r.std_out.decode().strip()

if b64:
    raw = base64.b64decode(b64)
    print("Longitud bytes del acceso directo:", len(raw))
    # Extraer todas las cadenas imprimibles
    matches = re.findall(rb'[a-zA-Z0-9_\-\.:\\/ ]{4,}', raw)
    for m in matches:
        s_val = m.decode('ascii', errors='ignore')
        if any(k in s_val.lower() for k in ['http', 'pos', 'exe', 'inteli', 'c:\\', '192.', '100.']):
            print("Encontrado en LNK:", s_val)
else:
    print("Error leyendo LNK:", r.std_err.decode())
