import winrm
import sys

s = winrm.Session('192.168.0.13', auth=('Caja 3', 'caja3'), transport='ntlm')

def run_ps(cmd):
    encoded_cmd = f"powershell -NoProfile -NonInteractive -Command \"{cmd}\""
    r = s.run_cmd(encoded_cmd)
    out = r.std_out.decode('cp1252', errors='replace').strip()
    err = r.std_err.decode('cp1252', errors='replace').strip()
    return out, err

print("=== 1. IMPRESORAS EN CAJA 3 ===")
out, err = run_ps("Get-Printer | Format-Table Name, DriverName, PortName -AutoSize")
print(out or err)

print("\n=== 2. PROCESOS DE INTELIMARKET / ELECTRON ===")
out, err = run_ps("Get-Process | Where-Object { $_.ProcessName -like '*inteli*' -or $_.ProcessName -like '*electron*' } | Format-Table Id, ProcessName, Path -AutoSize")
print(out or err)

print("\n=== 3. CERRAR Y REINICIAR INTELIMARKET EN CAJA 3 ===")
out, err = run_ps("Stop-Process -Name *intelimarket*, *electron* -Force -ErrorAction SilentlyContinue")
print("Procesos detenidos.")

print("\n=== 4. VERIFICAR ARCHIVOS DE INTELIMARKET ===")
out, err = run_ps("Get-ChildItem -Path 'C:\\' -Recurse -Filter 'InteliMarket-POS.exe' -ErrorAction SilentlyContinue | Select-Object FullName")
print("Ejecutable encontrado:", out or err)

