import winrm

s = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

def ps(cmd):
    encoded_cmd = f"powershell -NoProfile -NonInteractive -Command \"{cmd}\""
    r = s.run_cmd(encoded_cmd)
    return r.std_out.decode('cp1252', errors='replace').strip(), r.std_err.decode('cp1252', errors='replace').strip()

print("=== VERIFICAR RESPUESTA EN TIEMPO REAL DESDE CAJA 3 ===")
cmd = "(Invoke-WebRequest -Uri 'http://192.168.0.10:5173/api/v1/auth/pos-staff' -UseBasicParsing).Content"
out, err = ps(cmd)
print("Respuesta API:", out[:200] if out else err)
