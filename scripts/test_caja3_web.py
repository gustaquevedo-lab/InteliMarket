import winrm

s = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

def ps(cmd):
    encoded_cmd = f"powershell -NoProfile -NonInteractive -Command \"{cmd}\""
    r = s.run_cmd(encoded_cmd)
    return r.std_out.decode('cp1252', errors='replace').strip(), r.std_err.decode('cp1252', errors='replace').strip()

print("=== TEST CONEXIÓN A FRONTEND (PUERTO 5173) DESDE CAJA 3 ===")
cmd = "(Invoke-WebRequest -Uri 'http://192.168.0.10:5173' -UseBasicParsing -TimeoutSec 3).StatusCode"
out, err = ps(cmd)
print("Status 5173:", out or err)

print("=== TEST CONEXIÓN A API (PUERTO 8000) DESDE CAJA 3 ===")
cmd2 = "(Invoke-WebRequest -Uri 'http://192.168.0.10:8000/api/health' -UseBasicParsing -TimeoutSec 3).Content"
out2, err2 = ps(cmd2)
print("API Health:", out2 or err2)
