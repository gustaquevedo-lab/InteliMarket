import winrm

s = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

def ps(cmd):
    encoded_cmd = f"powershell -NoProfile -NonInteractive -Command \"{cmd}\""
    r = s.run_cmd(encoded_cmd)
    return r.std_out.decode('cp1252', errors='replace').strip(), r.std_err.decode('cp1252', errors='replace').strip()

print("=== 1. MATAR PROCESOS DE INTELIMARKET EN CAJA 3 ===")
out, err = ps("Get-Process | Where-Object { $_.ProcessName -like '*InteliMarket*' } | Stop-Process -Force -ErrorAction SilentlyContinue")
print("Procesos matados.")

print("\n=== 2. LOCALIZAR ARCHIVOS DE INTELIMARKET Y CACHE ===")
out, err = ps("""
Get-ChildItem -Path "C:\\Users\\caja 3\\AppData\\Roaming" -Directory | Where-Object { $_.Name -like "*inteli*" -or $_.Name -like "*pos*" } | Select-Object FullName
""")
print("Directorios de AppData:", out or err)

print("\n=== 3. LOCALIZAR EL EJECUTABLE DE INTELIMARKET POS ===")
out, err = ps("""
Get-ChildItem -Path "C:\\Users\\caja 3\\AppData\\Local\\Programs", "C:\\Program Files", "C:\\Program Files (x86)", "C:\\" -Filter "*InteliMarket*.exe" -Recurse -Depth 3 -ErrorAction SilentlyContinue | Select-Object FullName
""")
print("Ejecutables encontrados:", out or err)

print("\n=== 4. VER CONFIG / URLS EN EL PAQUETE ===")
out, err = ps("""
Get-ChildItem -Path "C:\\Users\\caja 3\\AppData\\Local" -Filter "*inteli*" -Recurse -Depth 3 -ErrorAction SilentlyContinue | Select-Object FullName
""")
print("Archivos en Local:", out or err)
