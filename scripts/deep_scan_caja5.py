import winrm

s = winrm.Session('192.168.0.15', auth=('Caja 5', 'caja5'), transport='ntlm')

def ps(cmd):
    encoded = f'powershell -NoProfile -NonInteractive -Command "{cmd}"'
    r = s.run_cmd(encoded)
    out = r.std_out.decode('cp1252', errors='replace').strip()
    err = r.std_err.decode('cp1252', errors='replace').strip()
    return out, err

# 1. Ver estructura completa de win-unpacked
print("=== ESTRUCTURA DE WIN-UNPACKED ===")
out, _ = ps(r"Get-ChildItem C:\InteliMarket\win-unpacked -Recurse -File | Select-Object -ExpandProperty FullName")
print(out[:3000])

# 2. Ver el main.cjs o main.js que carga Electron
print("\n=== CONTENIDO DE MAIN.JS/MAIN.CJS EN InteliMarket ===")
for f in ['main.cjs', 'main.js', 'preload.cjs', 'preload.js']:
    out2, _ = ps(fr"if (Test-Path 'C:\InteliMarket\win-unpacked\resources\app\{f}') {{ Get-Content 'C:\InteliMarket\win-unpacked\resources\app\{f}' }}")
    if out2:
        print(f"=== {f} ===")
        print(out2[:2000])

# 3. Buscar referencias en el asar.unpacked
print("\n=== ARCHIVOS EN ASAR.UNPACKED ===")
out3, _ = ps(r"Get-ChildItem 'C:\InteliMarket\win-unpacked\resources\app.asar.unpacked' -Recurse -File -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName")
print(out3)

# 4. Ver si hay un .env en la raiz del win-unpacked
print("\n=== .ENV O CONFIG EN WIN-UNPACKED ===")
out4, _ = ps(r"Get-ChildItem 'C:\InteliMarket\win-unpacked' -File | Select-Object -ExpandProperty FullName")
print(out4)
