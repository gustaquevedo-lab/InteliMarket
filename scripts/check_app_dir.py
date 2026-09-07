import winrm

s = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

def ps(cmd):
    encoded_cmd = f"powershell -NoProfile -NonInteractive -Command \"{cmd}\""
    r = s.run_cmd(encoded_cmd)
    return r.std_out.decode('cp1252', errors='replace').strip(), r.std_err.decode('cp1252', errors='replace').strip()

print("=== ARCHIVOS EN C:\\InteliMarket\\win-unpacked ===")
out, err = ps("Get-ChildItem -Path 'C:\\InteliMarket\\win-unpacked' | Select-Object Name, Length")
print(out or err)

print("\n=== CONTENIDO DE POS-CONFIG.JSON SI EXISTE ===")
out2, err2 = ps("""
if (Test-Path 'C:\\InteliMarket\\win-unpacked\\pos-config.json') {
    Get-Content 'C:\\InteliMarket\\win-unpacked\\pos-config.json'
} else {
    'NO EXISTE pos-config.json'
}
""")
print(out2 or err2)
