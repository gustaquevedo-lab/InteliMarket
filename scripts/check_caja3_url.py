import winrm

s = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

def ps(cmd):
    encoded_cmd = f"powershell -NoProfile -NonInteractive -Command \"{cmd}\""
    r = s.run_cmd(encoded_cmd)
    return r.std_out.decode('cp1252', errors='replace').strip(), r.std_err.decode('cp1252', errors='replace').strip()

print("=== BUSCAR POS-CONFIG.JSON EN CAJA 3 ===")
out, err = ps("""
Get-ChildItem -Path C:\\ -Filter "pos-config.json" -Recurse -Depth 4 -ErrorAction SilentlyContinue | ForEach-Object {
    $_.FullName
    Get-Content $_.FullName
}
""")
print(out or err)

print("=== TEST CURL A 5174 Y 5173 DESDE CAJA 3 ===")
print("5174:", ps("(Invoke-WebRequest -Uri 'http://192.168.0.10:5174/pos' -UseBasicParsing -TimeoutSec 3).StatusCode"))
print("5173:", ps("(Invoke-WebRequest -Uri 'http://192.168.0.10:5173/pos' -UseBasicParsing -TimeoutSec 3).StatusCode"))
print("100.83.91.76:5174:", ps("try { (Invoke-WebRequest -Uri 'http://100.83.91.76:5174/pos' -UseBasicParsing -TimeoutSec 3).StatusCode } catch { $_.Exception.Message }"))
